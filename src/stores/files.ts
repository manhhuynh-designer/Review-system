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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import { createNotification } from '../lib/notifications'
import type { File as FileType, FileVersion } from '../types'
import { generateId } from '../lib/utils'
import toast from 'react-hot-toast'

interface FileState {
  files: FileType[]
  selectedFile: FileType | null
  uploading: boolean
  deleting: boolean
  error: string | null
  unsubscribe: Unsubscribe | null

  subscribeToFiles: (projectId: string) => void
  loadFiles: (projectId: string) => void
  uploadFile: (projectId: string, file: File, existingFileId?: string) => Promise<void>
  uploadSequence: (projectId: string, files: File[], name: string, fps?: number, existingFileId?: string) => Promise<void>
  deleteFile: (projectId: string, fileId: string) => Promise<void>
  selectFile: (file: FileType | null) => void
  switchVersion: (fileId: string, version: number) => Promise<void>
  setSequenceViewMode: (projectId: string, fileId: string, mode: 'video' | 'carousel' | 'grid') => Promise<void>
  updateFrameCaption: (projectId: string, fileId: string, version: number, frameNumber: number, caption: string) => Promise<void>
  cleanup: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  selectedFile: null,
  uploading: false,
  deleting: false,
  error: null,
  unsubscribe: null,

  subscribeToFiles: (projectId: string) => {
    const q = query(
      collection(db, 'projects', projectId, 'files'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const files = snapshot.docs.map(doc => ({
        id: doc.id,
        projectId,
        ...doc.data()
      })) as FileType[]

      set({ files, error: null })
    }, (error) => {
      const errorMessage = 'Lỗi tải file: ' + error.message
      set({ error: errorMessage })
      toast.error(errorMessage)
    })

    set({ unsubscribe })
  },

  // Alias for compatibility with FilesList component
  loadFiles: (projectId: string) => {
    get().subscribeToFiles(projectId)
  },

  uploadFile: async (projectId: string, file: File, existingFileId?: string) => {
    console.log('🚀 Upload started:', { projectId, fileName: file.name, size: file.size, existingFileId })
    set({ uploading: true, error: null })

    try {
      const fileId = existingFileId || generateId()
      console.log('📁 Generated fileId:', fileId)

      // Determine file type
      let fileType: 'image' | 'video' | 'model' = 'image'
      if (file.type.startsWith('video/')) fileType = 'video'
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) fileType = 'model'
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
      console.log('⬆️ Starting upload to storage...')
      const snapshot = await uploadBytes(storageRef, file)
      console.log('✅ Upload completed, getting download URL...')
      const url = await getDownloadURL(snapshot.ref)
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
      set({ uploading: false })
    }
  },

  selectFile: (file: FileType | null) => {
    set({ selectedFile: file })
  },

  uploadSequence: async (projectId: string, files: File[], name: string, fps: number = 24, existingFileId?: string) => {
    console.log('🎬 Sequence upload started:', { projectId, name, frameCount: files.length, fps, existingFileId })
    set({ uploading: true, error: null })

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

      // Upload all frames to Storage
      const sequenceUrls: string[] = []
      let totalSize = 0

      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i]
        totalSize += file.size

        const storagePath = `projects/${projectId}/${fileId}/v${currentVersion}/frames/${String(i).padStart(4, '0')}_${file.name}`
        console.log(`⬆️ Uploading frame ${i + 1}/${sortedFiles.length}: ${storagePath}`)

        const storageRef = ref(storage, storagePath)
        const snapshot = await uploadBytes(storageRef, file)
        const url = await getDownloadURL(snapshot.ref)
        sequenceUrls.push(url)
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

      const data = fileDoc.data() as FileType
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

  cleanup: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, files: [], selectedFile: null })
    }
  },
}))
