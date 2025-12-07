import { create } from 'zustand'
import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  getDoc,
  getDocs,
  where
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createNotification } from '../lib/notifications'
import type { File as FileModel, FileType, FileVersion } from '../types'
import { generateId } from '../lib/utils'
import toast from 'react-hot-toast'

interface FileState {
  files: FileModel[]
  selectedFile: FileModel | null
  uploading: boolean
  uploadProgress: number
  deleting: boolean
  error: string | null
  unsubscribes: Map<string, Unsubscribe> // Changed from single unsubscribe to Map

  subscribeToFiles: (projectId: string) => void
  loadFiles: (projectId: string) => void
  uploadFile: (projectId: string, file: File, existingFileId?: string) => Promise<void>
  uploadSequence: (projectId: string, files: File[], name: string, fps?: number, existingFileId?: string) => Promise<void>
  deleteFile: (projectId: string, fileId: string) => Promise<void>
  selectFile: (file: FileModel | null) => void
  switchVersion: (fileId: string, version: number) => Promise<void>
  setSequenceViewMode: (projectId: string, fileId: string, mode: 'video' | 'carousel' | 'grid') => Promise<void>
  updateFrameCaption: (projectId: string, fileId: string, version: number, frameNumber: number, caption: string) => Promise<void>
  setModelThumbnail: (projectId: string, fileId: string, version: number, dataUrl: string, cameraState: { position: [number, number, number], target: [number, number, number] }) => Promise<void>
  renameFile: (projectId: string, fileId: string, newName: string) => Promise<void>
  reorderSequenceFrames: (projectId: string, fileId: string, version: number, newOrder: number[]) => Promise<void>
  deleteSequenceFrames: (projectId: string, fileId: string, version: number, indicesToDelete: number[]) => Promise<void>
  cleanup: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  selectedFile: null,
  uploading: false,
  uploadProgress: 0,
  deleting: false,
  error: null,
  unsubscribes: new Map(),

  subscribeToFiles: (projectId: string) => {
    // Check if already subscribed to this project
    if (get().unsubscribes.has(projectId)) {
      console.log(`📂 Already subscribed to files for project ${projectId}`)
      return
    }

    const q = query(
      collection(db, 'projects', projectId, 'files'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectFiles = snapshot.docs.map(doc => ({
        id: doc.id,
        projectId,
        ...doc.data()
      })) as FileModel[]

      // Merge with existing files from other projects
      const currentFiles = get().files
      const otherProjectFiles = currentFiles.filter(f => f.projectId !== projectId)
      const allFiles = [...otherProjectFiles, ...projectFiles]

      set({ files: allFiles, error: null })
    }, (error) => {
      const errorMessage = 'Lỗi tải file: ' + error.message
      set({ error: errorMessage })
      toast.error(errorMessage)
    })

    // Store the unsubscribe function
    const unsubscribes = new Map(get().unsubscribes)
    unsubscribes.set(projectId, unsubscribe)
    set({ unsubscribes })
  },

  // Alias for compatibility with FilesList component
  loadFiles: (projectId: string) => {
    get().subscribeToFiles(projectId)
  },

  uploadFile: async (projectId: string, file: File, existingFileId?: string) => {
    console.log('🚀 Upload started:', { projectId, fileName: file.name, size: file.size, existingFileId })
    set({ uploading: true, uploadProgress: 0, error: null })

    try {
      const fileId = existingFileId || generateId()
      console.log('📁 Generated fileId:', fileId)

      // Determine file type
      let fileType: FileType = 'image'
      if (file.type.startsWith('video/')) fileType = 'video'
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) fileType = 'model'
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf'
      console.log('🏷️ File type determined:', fileType)

      // Get current version
      let currentVersion = 1
      if (existingFileId) {
        const existingFile = get().files.find(f => f.id === existingFileId)
        if (existingFile) {
          currentVersion = existingFile.currentVersion + 1
        }
      }
      console.log('🔢 Version:', currentVersion)

      // Upload to Storage
      const storagePath = `projects/${projectId}/${fileId}/v${currentVersion}/${file.name}`
      console.log('☁️ Storage path:', storagePath)

      const storageRef = ref(storage, storagePath)
      console.log('⬆️ Starting upload to storage (resumable)...')
      const uploadTask = uploadBytesResumable(storageRef, file)

      const url: string = await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', (snapshot) => {
          try {
            const progress = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0
            set({ uploadProgress: progress })
          } catch (e) {
            // ignore
          }
        }, (err) => {
          reject(err)
        }, async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(downloadUrl)
          } catch (e) {
            reject(e)
          }
        })
      })
      console.log('✅ Upload completed, getting download URL...')
      console.log('🔗 Download URL obtained:', url)
      console.log('🔗 Download URL obtained:', url)

      // Create version metadata
      const newVersion: FileVersion = {
        url,
        version: currentVersion,
        uploadedAt: Timestamp.now(),
        metadata: {
          size: file.size,
          type: file.type,
          name: file.name,
          lastModified: file.lastModified
        }
      }

      // Generate thumbnail for PDF
      if (fileType === 'pdf') {
        try {
          console.log('🖼️ Generating PDF thumbnail...')
          // Dynamic import to avoid loading pdfjs if not needed
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

          const arrayBuffer = await file.arrayBuffer()
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
          const page = await pdf.getPage(1)

          const viewport = page.getViewport({ scale: 1 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.height = viewport.height
          canvas.width = viewport.width

          if (context) {
            // @ts-ignore - render signature mismatch in types but works in runtime
            await page.render({ canvasContext: context, viewport }).promise
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7)

            // Upload thumbnail
            const thumbRef = ref(storage, `projects/${projectId}/${fileId}/v${currentVersion}/thumbnail.jpg`)
            const thumbBlob = await (await fetch(thumbnailUrl)).blob()
            await uploadBytes(thumbRef, thumbBlob)
            const thumbUrl = await getDownloadURL(thumbRef)

            newVersion.thumbnailUrl = thumbUrl
            console.log('✅ PDF thumbnail generated and uploaded:', thumbUrl)
          }
        } catch (err) {
          console.error('⚠️ Failed to generate PDF thumbnail:', err)
          // Continue without thumbnail
        }
      }
      console.log('📝 Version metadata created:', newVersion)

      // Update or create Firestore doc
      if (existingFileId) {
        console.log('🔄 Updating existing file...')
        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const existingFile = get().files.find(f => f.id === existingFileId)
        await updateDoc(fileRef, {
          versions: [...(existingFile?.versions || []), newVersion],
          currentVersion
        })
        console.log('✅ Existing file updated')
        toast.success(`Đã tải phiên bản ${currentVersion} của ${existingFile?.name}`)
      } else {
        console.log('📄 Creating new file document...')
        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const newFileData = {
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          type: fileType,
          versions: [newVersion],
          currentVersion,
          createdAt: Timestamp.now()
        }
        console.log('📋 New file data:', newFileData)
        await setDoc(fileRef, newFileData)
        console.log('✅ New file created')
        toast.success(`Đã tải lên ${file.name}`)

        // Create notification for new file upload
        const projectDoc = await getDoc(doc(db, 'projects', projectId))
        if (projectDoc.exists()) {
          const projectData = projectDoc.data()
          await createNotification({
            type: 'upload',
            projectId,
            fileId,
            message: `File mới "${newFileData.name}" đã được tải lên`,
            adminEmail: projectData.adminEmail
          })
        }
      }

      console.log('🎉 Upload process completed successfully!')
    } catch (error: any) {
      console.error('❌ Upload failed:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })

      const errorMessage = 'Tải file thất bại: ' + (error.message || 'Lỗi không xác định')
      set({ error: errorMessage })
      toast.error(errorMessage)
      throw error
    } finally {
      // finalize
      set({ uploading: false, uploadProgress: 0 })
    }
  },

  selectFile: (file: FileModel | null) => {
    set({ selectedFile: file })
  },

  uploadSequence: async (projectId: string, files: File[], name: string, fps: number = 24, existingFileId?: string) => {
    console.log('🎬 Sequence upload started:', { projectId, name, frameCount: files.length, fps, existingFileId })
    set({ uploading: true, uploadProgress: 0, error: null })

    try {
      const fileId = existingFileId || generateId()
      console.log('📁 Generated fileId:', fileId)

      // Sort files by name to ensure correct frame order
      const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name))

      // Get current version
      let currentVersion = 1
      if (existingFileId) {
        const existingFile = get().files.find(f => f.id === existingFileId)
        if (existingFile) {
          currentVersion = existingFile.currentVersion + 1
        }
      }
      console.log('🔢 Version:', currentVersion)

      // Upload all frames to Storage (track progress across all frames)
      const sequenceUrls: string[] = []
      let totalSize = 0
      for (const f of sortedFiles) totalSize += f.size

      let uploadedSoFar = 0

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i]

        const storagePath = `projects/${projectId}/${fileId}/v${currentVersion}/frames/${String(i).padStart(4, '0')}_${file.name}`
        console.log(`⬆️ Uploading frame ${i + 1}/${sortedFiles.length}: ${storagePath}`)

        const storageRef = ref(storage, storagePath)
        const uploadTask = uploadBytesResumable(storageRef, file)

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', (snapshot) => {
            const currentFileTransferred = snapshot.bytesTransferred
            const progress = totalSize ? Math.round(((uploadedSoFar + currentFileTransferred) / totalSize) * 100) : 0
            set({ uploadProgress: progress })
          }, (err) => reject(err), async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref)
              sequenceUrls.push(url)
              // after successful upload of this file, increment uploadedSoFar by file.size
              uploadedSoFar += file.size
              // ensure progress moves forward to at least the finished files
              const progressNow = totalSize ? Math.round((uploadedSoFar / totalSize) * 100) : 0
              set({ uploadProgress: progressNow })
              resolve()
            } catch (e) {
              reject(e)
            }
          })
        })
      }

      console.log('✅ All frames uploaded, getting URLs...')

      // Create version metadata
      const newVersion: FileVersion = {
        url: sequenceUrls[0], // First frame as thumbnail
        sequenceUrls,
        frameCount: sequenceUrls.length,
        version: currentVersion,
        uploadedAt: Timestamp.now(),
        metadata: {
          size: totalSize,
          type: 'image/sequence',
          name: name,
          lastModified: Date.now(),
          duration: sequenceUrls.length / fps // duration in seconds
        }
      }
      console.log('📝 Version metadata created:', newVersion)

      // Update or create Firestore doc
      if (existingFileId) {
        console.log('🔄 Updating existing sequence...')
        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const existingFile = get().files.find(f => f.id === existingFileId)
        await updateDoc(fileRef, {
          versions: [...(existingFile?.versions || []), newVersion],
          currentVersion
        })
        console.log('✅ Existing sequence updated')
        toast.success(`Đã tải phiên bản ${currentVersion} của ${existingFile?.name}`)
      } else {
        console.log('📄 Creating new sequence document...')
        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const newFileData = {
          name,
          type: 'sequence' as const,
          versions: [newVersion],
          currentVersion,
          sequenceViewMode: 'video' as const, // Default view mode
          createdAt: Timestamp.now()
        }
        console.log('📋 New sequence data:', newFileData)
        await setDoc(fileRef, newFileData)
        console.log('✅ New sequence created')
        toast.success(`Đã tải lên sequence "${name}" với ${sequenceUrls.length} frames`)

        // Create notification for new sequence upload
        const projectDoc = await getDoc(doc(db, 'projects', projectId))
        if (projectDoc.exists()) {
          const projectData = projectDoc.data()
          await createNotification({
            type: 'upload',
            projectId,
            fileId,
            message: `Image sequence "${name}" (${sequenceUrls.length} frames) đã được tải lên`,
            adminEmail: projectData.adminEmail
          })
        }
      }

      console.log('🎉 Sequence upload completed successfully!')
    } catch (error: any) {
      console.error('❌ Sequence upload failed:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })

      const errorMessage = 'Tải sequence thất bại: ' + (error.message || 'Lỗi không xác định')
      set({ error: errorMessage })
      toast.error(errorMessage)
      throw error
    } finally {
      set({ uploading: false })
    }
  },

  deleteFile: async (projectId: string, fileId: string) => {
    set({ deleting: true, error: null })

    try {
      const file = get().files.find(f => f.id === fileId)
      if (!file) {
        throw new Error('File không tồn tại')
      }

      // Delete all file versions from Storage
      for (const version of file.versions) {
        try {
          if (file.type === 'sequence' && version.sequenceUrls) {
            // Delete all frames in sequence
            for (let i = 0; i < version.sequenceUrls.length; i++) {
              const framePath = `projects/${projectId}/${fileId}/v${version.version}/frames/${String(i).padStart(4, '0')}_*`
              // Note: We can't use wildcards in deleteObject, so we construct the path pattern
              // In practice, Firebase Storage will delete the entire folder when we delete the parent
              console.log(`🗑️ Would delete frame: ${framePath}`)
            }
            // Delete the entire version folder (will remove all frames)
            const versionFolderPath = `projects/${projectId}/${fileId}/v${version.version}/`
            console.log(`🗑️ Deleting sequence folder: ${versionFolderPath}`)
          } else {
            // Single file deletion
            const storagePath = `projects/${projectId}/${fileId}/v${version.version}/${version.metadata.name}`
            const storageRef = ref(storage, storagePath)
            await deleteObject(storageRef)
            console.log(`🗑️ Deleted storage file: ${storagePath}`)
          }
        } catch (storageError: any) {
          // Continue even if storage deletion fails (file might not exist)
          console.warn(`⚠️ Failed to delete storage file: ${storageError.message}`)
        }
      }

      // Delete all comments associated with this file
      const commentsQuery = query(
        collection(db, 'projects', projectId, 'comments'),
        where('fileId', '==', fileId)
      )
      const commentsSnapshot = await getDocs(commentsQuery)
      const deleteCommentPromises = commentsSnapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      )
      await Promise.all(deleteCommentPromises)
      console.log(`🗑️ Deleted ${commentsSnapshot.size} comments`)

      // Delete the file document from Firestore
      await deleteDoc(doc(db, 'projects', projectId, 'files', fileId))
      console.log(`✅ File deleted successfully: ${fileId}`)

      toast.success(`Đã xóa file "${file.name}"`)
    } catch (error: any) {
      console.error('❌ Delete failed:', error)
      const errorMessage = 'Xóa file thất bại: ' + (error.message || 'Lỗi không xác định')
      set({ error: errorMessage })
      toast.error(errorMessage)
      throw error
    } finally {
      set({ deleting: false })
    }
  },

  switchVersion: async (fileId: string, version: number) => {
    const file = get().files.find(f => f.id === fileId)
    if (!file) return

    try {
      await updateDoc(doc(db, 'projects', file.projectId, 'files', fileId), {
        currentVersion: version
      })
      toast.success(`Chuyển sang v${version}`)
    } catch (error: any) {
      toast.error('Lỗi chuyển version: ' + error.message)
    }
  },

  setSequenceViewMode: async (projectId: string, fileId: string, mode: 'video' | 'carousel' | 'grid') => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'files', fileId), {
        sequenceViewMode: mode
      })
      const modeName = mode === 'video' ? 'Video' : mode === 'carousel' ? 'Carousel' : 'Grid'
      toast.success(`Đã đặt chế độ xem: ${modeName}`)
    } catch (error: any) {
      console.error('Failed to update sequence view mode:', error)
      toast.error('Lỗi cập nhật chế độ xem')
    }
  },

  updateFrameCaption: async (projectId: string, fileId: string, version: number, frameNumber: number, caption: string) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]
      const versionIndex = versions.findIndex(v => v.version === version)

      if (versionIndex >= 0) {
        const currentVersion = versions[versionIndex]
        const frameCaptions = { ...(currentVersion.frameCaptions || {}) }

        if (caption) {
          frameCaptions[frameNumber] = caption
        } else {
          delete frameCaptions[frameNumber]
        }

        versions[versionIndex] = {
          ...currentVersion,
          frameCaptions
        }

        await updateDoc(fileRef, { versions })
        toast.success('Đã lưu chú thích')
      }
    } catch (error: any) {
      console.error('Failed to update frame caption:', error)
      toast.error('Lỗi lưu chú thích')
    }
  },

  setModelThumbnail: async (projectId: string, fileId: string, version: number, dataUrl: string, cameraState: { position: [number, number, number], target: [number, number, number] }) => {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Upload to Storage
      const storagePath = `projects/${projectId}/${fileId}/v${version}/thumbnail.png`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, blob)
      const thumbnailUrl = await getDownloadURL(storageRef)

      // Update file document
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]
      const versionIndex = versions.findIndex(v => v.version === version)

      if (versionIndex >= 0) {
        versions[versionIndex] = {
          ...versions[versionIndex],
          thumbnailUrl,
          cameraState
        }

        await updateDoc(fileRef, { versions })
        toast.success('Đã lưu thumbnail')
      }
    } catch (error: any) {
      console.error('Error setting model thumbnail:', error)
      toast.error('Lỗi khi lưu thumbnail')
      throw error
    }
  },

  renameFile: async (projectId: string, fileId: string, newName: string) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      await updateDoc(fileRef, {
        name: newName,
        updatedAt: Timestamp.now()
      })
      toast.success('Đổi tên file thành công')
    } catch (error: any) {
      console.error('Error renaming file:', error)
      toast.error('Lỗi khi đổi tên file: ' + error.message)
      throw error
    }
  },

  reorderSequenceFrames: async (projectId: string, fileId: string, version: number, newOrder: number[]) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]
      const versionIndex = versions.findIndex(v => v.version === version)

      if (versionIndex >= 0 && versions[versionIndex].sequenceUrls) {
        const currentVersion = versions[versionIndex]
        const oldUrls = currentVersion.sequenceUrls || []
        const oldCaptions = currentVersion.frameCaptions || {}

        // Reorder URLs based on new order
        const newUrls = newOrder.map(i => oldUrls[i])

        // Reorder captions - need to map old frame numbers to new positions
        const newCaptions: Record<number, string> = {}
        newOrder.forEach((oldIndex, newIndex) => {
          if (oldCaptions[oldIndex]) {
            newCaptions[newIndex] = oldCaptions[oldIndex]
          }
        })

        versions[versionIndex] = {
          ...currentVersion,
          sequenceUrls: newUrls,
          url: newUrls[0], // Update thumbnail to first frame
          frameCaptions: newCaptions
        }

        await updateDoc(fileRef, { versions })
        toast.success('Đã sắp xếp lại thứ tự hình')
      }
    } catch (error: any) {
      console.error('Failed to reorder sequence frames:', error)
      toast.error('Lỗi sắp xếp lại thứ tự')
      throw error
    }
  },

  deleteSequenceFrames: async (projectId: string, fileId: string, version: number, indicesToDelete: number[]) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]
      const versionIndex = versions.findIndex(v => v.version === version)

      if (versionIndex >= 0 && versions[versionIndex].sequenceUrls) {
        const currentVersion = versions[versionIndex]
        const oldUrls = currentVersion.sequenceUrls || []
        const oldCaptions = currentVersion.frameCaptions || {}

        // Filter out deleted frames
        const indicesToDeleteSet = new Set(indicesToDelete)
        const newUrls = oldUrls.filter((_, i) => !indicesToDeleteSet.has(i))

        if (newUrls.length === 0) {
          throw new Error('Không thể xóa tất cả hình trong sequence')
        }

        // Rebuild captions with new indices
        const newCaptions: Record<number, string> = {}
        let newIndex = 0
        for (let oldIndex = 0; oldIndex < oldUrls.length; oldIndex++) {
          if (!indicesToDeleteSet.has(oldIndex)) {
            if (oldCaptions[oldIndex]) {
              newCaptions[newIndex] = oldCaptions[oldIndex]
            }
            newIndex++
          }
        }

        versions[versionIndex] = {
          ...currentVersion,
          sequenceUrls: newUrls,
          url: newUrls[0], // Update thumbnail to first frame
          frameCount: newUrls.length,
          frameCaptions: newCaptions
        }

        await updateDoc(fileRef, { versions })
        toast.success(`Đã xóa ${indicesToDelete.length} hình`)
      }
    } catch (error: any) {
      console.error('Failed to delete sequence frames:', error)
      toast.error('Lỗi xóa hình: ' + error.message)
      throw error
    }
  },

  cleanup: () => {
    get().unsubscribes.forEach(unsubscribe => unsubscribe())
    set({ unsubscribes: new Map(), files: [], selectedFile: null, error: null })
  }
}))
