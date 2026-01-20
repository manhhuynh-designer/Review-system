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
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
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
  deleteFile: (projectId: string, fileId: string) => Promise<void> // Soft delete (move to trash)
  trashFile: (projectId: string, fileId: string) => Promise<void> // Alias for deleteFile
  restoreFile: (projectId: string, fileId: string) => Promise<void> // Restore from trash
  permanentDeleteFile: (projectId: string, fileId: string) => Promise<void> // Hard delete
  selectFile: (file: FileModel | null) => void
  switchVersion: (fileId: string, version: number) => Promise<void>
  setSequenceViewMode: (projectId: string, fileId: string, mode: 'video' | 'carousel' | 'grid') => Promise<void>
  updateFrameCaption: (projectId: string, fileId: string, version: number, frameNumber: number, caption: string) => Promise<void>
  setModelThumbnail: (projectId: string, fileId: string, version: number, dataUrl: string, cameraState: { position: [number, number, number], target: [number, number, number] }) => Promise<void>
  renameFile: (projectId: string, fileId: string, newName: string) => Promise<void>
  reorderSequenceFrames: (projectId: string, fileId: string, version: number, newOrder: number[]) => Promise<void>
  deleteSequenceFrames: (projectId: string, fileId: string, version: number, indicesToDelete: number[]) => Promise<void>
  deleteVersion: (projectId: string, fileId: string, version: number) => Promise<void>
  toggleFileLock: (projectId: string, fileId: string, isLocked: boolean) => Promise<void>
  updateModelSettings: (projectId: string, fileId: string, version: number, settings: {
    toneMapping?: string
    exposure?: number
    enablePostProcessing?: boolean
    bloomIntensity?: number
    envPreset?: string
    envIntensity?: number
    lightIntensity?: number
    gamma?: number
  }) => Promise<void>
  cleanupProjectFiles: (projectId: string) => Promise<void>
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

    set({ uploading: true, uploadProgress: 0, error: null })

    // Client-side Security Check
    if (file.name.toLowerCase().includes('virus') || file.name.toLowerCase().includes('infected')) {
      const errorMessage = `Phát hiện file nghi ngờ có mã độc: ${file.name}. Upload bị hủy.`
      set({ uploading: false, error: errorMessage })
      toast.error(errorMessage)
      return // Stop execution
    }

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
        },
        validationStatus: 'pending'
      }

      // Generate share thumbnail for social sharing (1200x630 JPEG)
      // This runs after file upload completes to avoid blocking the main upload
      const generateShareThumbnail = async (): Promise<void> => {
        try {
          console.log('🖼️ Generating share thumbnail for', fileType)
          const shareThumbnailPath = `projects/${projectId}/${fileId}/v${currentVersion}/share_thumbnail.jpg`
          const shareThumbnailRef = ref(storage, shareThumbnailPath)

          let thumbnailBlob: Blob | null = null

          if (fileType === 'image') {
            // For images, resize/compress the uploaded image
            const { generateImageThumbnail } = await import('../lib/shareThumbnail')
            thumbnailBlob = await generateImageThumbnail(url)
          } else if (fileType === 'video') {
            // For videos, extract first frame
            const { generateVideoThumbnail } = await import('../lib/shareThumbnail')
            thumbnailBlob = await generateVideoThumbnail(url)
          } else if (fileType === 'pdf') {
            // For PDFs, render first page
            const { generatePdfThumbnail } = await import('../lib/shareThumbnail')
            thumbnailBlob = await generatePdfThumbnail(url)
          }
          // Note: For 3D models and sequences, we use existing thumbnailUrl or sequenceUrls[0]

          if (thumbnailBlob) {
            await uploadBytes(shareThumbnailRef, thumbnailBlob)
            const shareThumbnailUrl = await getDownloadURL(shareThumbnailRef)

            // Update Firestore with share thumbnail URL
            const fileRef = doc(db, 'projects', projectId, 'files', fileId)
            const currentFile = get().files.find(f => f.id === fileId)
            if (currentFile) {
              const updatedVersions = currentFile.versions.map(v =>
                v.version === currentVersion
                  ? { ...v, shareThumbnailUrl }
                  : v
              )
              await updateDoc(fileRef, { versions: updatedVersions })
            }
            console.log('✅ Share thumbnail generated:', shareThumbnailUrl)
          }
        } catch (err) {
          console.warn('⚠️ Failed to generate share thumbnail:', err)
          // Continue without share thumbnail - not critical
        }
      }

      // Generate PDF page thumbnail (for display, separate from share thumbnail)
      if (fileType === 'pdf') {
        try {
          console.log('🖼️ Generating PDF display thumbnail...')
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
            console.log('✅ PDF display thumbnail generated:', thumbUrl)
          }
        } catch (err) {
          console.error('⚠️ Failed to generate PDF display thumbnail:', err)
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

        // Cloud Functions will automatically create upload notifications
        // via the onFileCreated trigger
      }



      // Generate share thumbnail in background (non-blocking)
      generateShareThumbnail().catch(err => console.warn('Share thumbnail generation failed:', err))
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

    set({ uploading: true, uploadProgress: 0, error: null })

    // Client-side Security Check
    const infectedFile = files.find(f => f.name.toLowerCase().includes('virus') || f.name.toLowerCase().includes('infected'))
    if (infectedFile) {
      const errorMessage = `Phát hiện file nghi ngờ có mã độc: ${infectedFile.name}. Upload bị hủy.`
      set({ uploading: false, error: errorMessage })
      toast.error(errorMessage)
      return // Stop execution
    }

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


      // Upload all frames to Storage (track progress across all frames)
      const sequenceUrls: string[] = []
      let totalSize = 0
      for (const f of sortedFiles) totalSize += f.size

      let uploadedSoFar = 0

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i]

        const storagePath = `projects/${projectId}/${fileId}/v${currentVersion}/frames/${String(i).padStart(4, '0')}_${file.name}`


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
        },
        validationStatus: 'pending'
      }


      // Update or create Firestore doc
      if (existingFileId) {

        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const existingFile = get().files.find(f => f.id === existingFileId)
        await updateDoc(fileRef, {
          versions: [...(existingFile?.versions || []), newVersion],
          currentVersion
        })

        toast.success(`Đã tải phiên bản ${currentVersion} của ${existingFile?.name}`)
      } else {

        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const newFileData = {
          name,
          type: 'sequence' as const,
          versions: [newVersion],
          currentVersion,
          sequenceViewMode: 'video' as const, // Default view mode
          createdAt: Timestamp.now()
        }

        await setDoc(fileRef, newFileData)

        toast.success(`Đã tải lên sequence "${name}" với ${sequenceUrls.length} frames`)

        // Cloud Functions will automatically create upload notifications
        // via the onFileCreated trigger
      }


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
    // Soft delete - move to trash
    set({ deleting: true, error: null })

    try {
      const file = get().files.find(f => f.id === fileId)
      if (!file) {
        throw new Error('File không tồn tại')
      }

      // Update file to mark as trashed
      await updateDoc(doc(db, 'projects', projectId, 'files', fileId), {
        isTrashed: true,
        trashedAt: Timestamp.now()
      })


      toast.success(`Đã chuyển "${file.name}" vào thùng rác`)
    } catch (error: any) {
      console.error('❌ Trash failed:', error)
      const errorMessage = 'Xóa file thất bại: ' + (error.message || 'Lỗi không xác định')
      set({ error: errorMessage })
      toast.error(errorMessage)
      throw error
    } finally {
      set({ deleting: false })
    }
  },

  trashFile: async (projectId: string, fileId: string) => {
    // Alias for deleteFile (soft delete)
    return get().deleteFile(projectId, fileId)
  },

  restoreFile: async (projectId: string, fileId: string) => {
    set({ deleting: true, error: null })

    try {
      const file = get().files.find(f => f.id === fileId)
      if (!file) {
        throw new Error('File không tồn tại')
      }

      await updateDoc(doc(db, 'projects', projectId, 'files', fileId), {
        isTrashed: false,
        trashedAt: null
      })


      toast.success(`Đã khôi phục "${file.name}"`)
    } catch (error: any) {
      console.error('❌ Restore failed:', error)
      const errorMessage = 'Khôi phục file thất bại: ' + (error.message || 'Lỗi không xác định')
      set({ error: errorMessage })
      toast.error(errorMessage)
      throw error
    } finally {
      set({ deleting: false })
    }
  },

  permanentDeleteFile: async (projectId: string, fileId: string) => {
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

            }


          } else {
            // Single file deletion
            const storagePath = `projects/${projectId}/${fileId}/v${version.version}/${version.metadata.name}`
            const storageRef = ref(storage, storagePath)
            await deleteObject(storageRef)

          }

          // Delete thumbnails if they exist
          try {
            const thumbPath = `projects/${projectId}/${fileId}/v${version.version}/thumbnail.jpg`
            await deleteObject(ref(storage, thumbPath))
          } catch (e) { /* ignore */ }

          try {
            const shareThumbnailPath = `projects/${projectId}/${fileId}/v${version.version}/share_thumbnail.jpg`
            await deleteObject(ref(storage, shareThumbnailPath))
          } catch (e) { /* ignore */ }
        } catch (storageError: any) {
          console.warn(`⚠️ Failed to delete storage file: ${storageError.message}`)
        }
      }

      // Delete all comments associated with this file
      const commentsQuery = query(
        collection(db, 'projects', projectId, 'comments'),
        where('fileId', '==', fileId)
      )
      const commentsSnapshot = await getDocs(commentsQuery)
      const deleteCommentPromises = commentsSnapshot.docs.map(docSnap =>
        deleteDoc(docSnap.ref)
      )
      await Promise.all(deleteCommentPromises)

      // Delete the file document from Firestore
      await deleteDoc(doc(db, 'projects', projectId, 'files', fileId))

      toast.success(`Đã xóa vĩnh viễn "${file.name}"`)
    } catch (error: any) {
      console.error('❌ Permanent delete failed:', error)
      const errorMessage = 'Xóa vĩnh viễn thất bại: ' + (error.message || 'Lỗi không xác định')
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

  deleteVersion: async (projectId: string, fileId: string, version: number) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]

      // Don't allow deleting the last version
      if (versions.length <= 1) {
        toast.error('Không thể xóa phiên bản cuối cùng')
        return
      }

      // Find and remove the version
      const versionIndex = versions.findIndex(v => v.version === version)
      if (versionIndex < 0) {
        toast.error('Không tìm thấy phiên bản')
        return
      }

      // Delete version's files from Storage
      const versionData = versions[versionIndex]
      try {
        if (data.type === 'sequence' && versionData.sequenceUrls) {
          // Delete all sequence frames
          for (let i = 0; i < versionData.sequenceUrls.length; i++) {
            const framePath = `projects/${projectId}/${fileId}/v${version}/frames/${String(i).padStart(4, '0')}_*`
            console.log(`🗑️ Would delete frame: ${framePath}`)
          }
        } else {
          // Single file deletion
          const storagePath = `projects/${projectId}/${fileId}/v${version}/${versionData.metadata?.name || 'file'}`
          const storageRef = ref(storage, storagePath)
          await deleteObject(storageRef)
          console.log(`🗑️ Deleted storage file: ${storagePath}`)
        }

        // Delete thumbnail if exists
        if (versionData.thumbnailUrl) {
          try {
            const thumbPath = `projects/${projectId}/${fileId}/v${version}/thumbnail.jpg`
            const thumbRef = ref(storage, thumbPath)
            await deleteObject(thumbRef)
          } catch (e) {
            // Ignore thumbnail deletion errors
          }
        }

        // Delete share thumbnail if exists
        try {
          const shareThumbnailPath = `projects/${projectId}/${fileId}/v${version}/share_thumbnail.jpg`
          const shareThumbnailRef = ref(storage, shareThumbnailPath)
          await deleteObject(shareThumbnailRef)
        } catch (e) {
          // Ignore share thumbnail deletion errors (may not exist)
        }
      } catch (storageError: any) {
        console.warn(`⚠️ Failed to delete storage files: ${storageError.message}`)
        // Continue even if storage deletion fails
      }

      // Remove version from array
      versions.splice(versionIndex, 1)

      // If we're deleting the current version, switch to the latest remaining version
      let newCurrentVersion = data.currentVersion
      if (data.currentVersion === version) {
        // Find the highest remaining version
        newCurrentVersion = Math.max(...versions.map(v => v.version))
      }

      // Update Firestore
      await updateDoc(fileRef, {
        versions,
        currentVersion: newCurrentVersion
      })

      toast.success(`Đã xóa phiên bản ${version}`)
    } catch (error: any) {
      console.error('Failed to delete version:', error)
      toast.error('Lỗi xóa phiên bản: ' + error.message)
      throw error
    }
  },

  toggleFileLock: async (projectId: string, fileId: string, isLocked: boolean) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      await updateDoc(fileRef, {
        isCommentsLocked: isLocked,
        updatedAt: Timestamp.now()
      })

      set(state => ({
        files: state.files.map(f =>
          f.id === fileId ? { ...f, isCommentsLocked: isLocked } : f
        )
      }))

      toast.success(isLocked ? 'Đã khóa bình luận file' : 'Đã mở khóa bình luận file')
    } catch (error) {
      console.error('Error toggling file lock:', error)
      toast.error('Lỗi khi cập nhật trạng thái khóa bình luận')
    }
  },

  cleanupProjectFiles: async (projectId: string) => {
    set({ deleting: true })
    try {
      console.log(`🧹 Starting deep cleanup for project ${projectId}`)

      // Get all files for this project
      const filesQuery = query(collection(db, 'projects', projectId, 'files'))
      const snapshot = await getDocs(filesQuery)
      const projectFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FileModel[]

      for (const file of projectFiles) {
        console.log(`📄 Cleaning up file ${file.name} (${file.id})`)

        const updatedVersions = []

        for (const version of file.versions) {

          // Determine best available thumbnail to preserve
          let preservedUrl = version.thumbnailUrl || version.shareThumbnailUrl || ''
          let preservedSequenceUrls: string[] = []
          let newSize = version.metadata.size // Default to keep original size if update fails

          try {
            // STRATEGY: Delete heavy assets, keep lightweight thumbnails

            if (file.type === 'sequence' && version.sequenceUrls && version.sequenceUrls.length > 0) {
              // 1. SEQUENCE: Keep frame 0, delete the rest
              const firstFrame = version.sequenceUrls[0]
              const framesToDelete = version.sequenceUrls.slice(1)

              // Delete frames 1..N
              for (const url of framesToDelete) {
                try { await deleteObject(ref(storage, url)) } catch (e) { /* silent fail */ }
              }

              // Set preserved state
              if (!preservedUrl) preservedUrl = firstFrame // Use frame 0 as thumb if needed
              preservedSequenceUrls = [firstFrame] // Keep strict reference to frame 0

              console.log(`🎬 Sequence cleaned: Kept frame 0, deleted ${framesToDelete.length} frames`)

            } else if (file.type === 'image') {
              // 2. IMAGE: If we have a share/generated thumbnail, use it and delete original
              // If we ONLY have the original, we MUST keep it (or user sees nothing)
              const hasSeparateThumbnail = !!(version.thumbnailUrl || version.shareThumbnailUrl)

              if (hasSeparateThumbnail && version.url) {
                // Delete original high-res image
                try { await deleteObject(ref(storage, version.url)) } catch (e) { /* silent fail */ }
                console.log(`🖼️ Image optimized: Deleted original, using thumbnail`)
              } else {
                // Keep original as it's the only visual
                preservedUrl = version.url
                console.log(`🖼️ Image kept: No separate thumbnail available`)
              }

            } else {
              // 3. VIDEO / MODEL / PDF
              // Only delete original if we have a valid thumbnail to show
              if (preservedUrl && version.url) {
                // Don't delete if the URL is actually one of the thumbnails (rare edge case in data)
                if (version.url !== version.thumbnailUrl && version.url !== version.shareThumbnailUrl) {
                  try { await deleteObject(ref(storage, version.url)) } catch (e) { /* silent fail */ }
                  console.log(`📦 Heavy file deleted: ${file.type}`)
                }
              } else {
                // No valid thumbnail exists. Let's try to generate one before giving up.
                console.log(`⚠️ No existing thumbnail for ${file.type}. Attempting generation...`)

                try {
                  let generatedBlob: Blob | null = null

                  if (file.type === 'video') {
                    const { generateVideoThumbnail } = await import('../lib/shareThumbnail')
                    generatedBlob = await generateVideoThumbnail(version.url)
                  } else if (file.type === 'pdf') {
                    const { generatePdfThumbnail } = await import('../lib/shareThumbnail')
                    generatedBlob = await generatePdfThumbnail(version.url)
                  }

                  if (generatedBlob) {
                    const shareThumbnailPath = `projects/${projectId}/${file.id}/v${version.version}/share_thumbnail.jpg`
                    const shareThumbnailRef = ref(storage, shareThumbnailPath)
                    await uploadBytes(shareThumbnailRef, generatedBlob)
                    preservedUrl = await getDownloadURL(shareThumbnailRef)

                    // Update version with new thumbnail URL so we don't lose track of it if we crash/reload
                    try {
                      // We'll update the whole doc at the end, but good to know we have it.
                    } catch (e) { /* ignore */ }

                    console.log(`✅ Generated emergency thumbnail: ${preservedUrl}`)

                    // Now safe to delete original
                    if (version.url && version.url !== preservedUrl) {
                      try { await deleteObject(ref(storage, version.url)) } catch (e) { /* silent fail */ }
                      console.log(`📦 Heavy file deleted after thumbnail generation: ${file.type}`)
                    }
                  } else {
                    // Failed to generate or type not supported (e.g. model) - Keep original
                    preservedUrl = version.url
                    console.log(`⚠️ Generation failed or unsupported. Keeping original: ${file.type}`)
                  }
                } catch (genErr) {
                  console.error('Failed to generate emergency thumbnail:', genErr)
                  // Fallback: Keep original
                  preservedUrl = version.url
                }
              }
            }

            // --- RECALCULATE SIZE START ---
            // Now that we've cleaned up, let's get the actual size of the preserved asset
            if (preservedUrl) {
              try {
                // We reference the preserved URL (thumbnail or remaining frame)
                const meta = await getMetadata(ref(storage, preservedUrl))
                newSize = meta.size
                console.log(`📏 Updated size for ${file.name} v${version.version}: ${version.metadata.size} -> ${newSize}`)
              } catch (sizeErr) {
                console.warn('Could not fetch new size metadata, keeping old size:', sizeErr)
              }
            } else {
              // If no URL preserved (shouldn't happen for visual files), size is 0
              newSize = 0
            }
            // --- RECALCULATE SIZE END ---

          } catch (err) {
            console.warn(`⚠️ Error during cleanup of version ${version.version}:`, err)
          }

          // Push updated version metadata
          updatedVersions.push({
            ...version,
            url: preservedUrl,
            sequenceUrls: preservedSequenceUrls,
            metadata: {
              ...version.metadata,
              size: newSize // Update size to reflect actual storage usage
            },
            validationStatus: 'clean' // Mark as archived/cleaned
          })
        }

        // 3. Update file document to reflect it's cleared
        const fileRef = doc(db, 'projects', projectId, 'files', file.id)

        await updateDoc(fileRef, {
          versions: updatedVersions,
          isDataCleared: true,
          updatedAt: Timestamp.now()
        })
      }

      toast.success('Đã dọn dẹp dung lượng lưu trữ dự án')
    } catch (error: any) {
      console.error('❌ Deep cleanup failed:', error)
      toast.error('Lỗi khi dọn dẹp dữ liệu: ' + error.message)
      throw error
    } finally {
      set({ deleting: false })
    }
  },

  updateModelSettings: async (projectId: string, fileId: string, version: number, settings: {
    toneMapping?: string
    exposure?: number
    enablePostProcessing?: boolean
    bloomIntensity?: number
    envPreset?: string
    envIntensity?: number
    lightIntensity?: number
    gamma?: number
  }) => {
    try {
      const fileRef = doc(db, 'projects', projectId, 'files', fileId)
      const fileDoc = await getDoc(fileRef)

      if (!fileDoc.exists()) throw new Error('File not found')

      const data = fileDoc.data() as FileModel
      const versions = [...data.versions]
      const versionIndex = versions.findIndex(v => v.version === version)

      if (versionIndex >= 0) {
        versions[versionIndex] = {
          ...versions[versionIndex],
          renderSettings: settings
        }

        await updateDoc(fileRef, { versions })
        toast.success('Đã lưu cấu hình hiển thị 3D')
      }
    } catch (error: any) {
      console.error('Error updating model settings:', error)
      toast.error('Lỗi khi lưu cấu hình: ' + error.message)
      throw error
    }
  },

  cleanup: () => {
    get().unsubscribes.forEach(unsubscribe => unsubscribe())
    set({ unsubscribes: new Map(), files: [], selectedFile: null, error: null })
  }
}))
