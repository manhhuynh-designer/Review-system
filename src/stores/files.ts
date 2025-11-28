import { create } from 'zustand'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import type { File as FileType, FileVersion } from '../types'
import { generateId } from '../lib/utils'
import toast from 'react-hot-toast'

interface FileState {
  files: FileType[]
  selectedFile: FileType | null
  uploading: boolean
  unsubscribe: Unsubscribe | null
  
  subscribeToFiles: (projectId: string) => void
  uploadFile: (projectId: string, file: File, existingFileId?: string) => Promise<void>
  selectFile: (file: FileType | null) => void
  switchVersion: (fileId: string, version: number) => Promise<void>
  cleanup: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  selectedFile: null,
  uploading: false,
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
      
      set({ files })
    }, (error) => {
      toast.error('Lỗi tải file: ' + error.message)
    })

    set({ unsubscribe })
  },

  uploadFile: async (projectId: string, file: File, existingFileId?: string) => {
    set({ uploading: true })
    try {
      const fileId = existingFileId || generateId()
      
      // Determine file type
      let fileType: 'image' | 'video' | 'model' = 'image'
      if (file.type.startsWith('video/')) fileType = 'video'
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) fileType = 'model'

      // Get current version
      let currentVersion = 1
      if (existingFileId) {
        const existingFile = get().files.find(f => f.id === existingFileId)
        if (existingFile) {
          currentVersion = existingFile.currentVersion + 1
        }
      }

      // Upload to Storage
      const storagePath = `projects/${projectId}/${fileId}/v${currentVersion}/${file.name}`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)

      // Create version metadata
      const newVersion: FileVersion = {
        url,
        version: currentVersion,
        uploadedAt: Timestamp.now(),
        metadata: {
          size: file.size,
          type: file.type,
        }
      }

      // Update or create Firestore doc
      if (existingFileId) {
        const fileRef = doc(db, 'projects', projectId, 'files', fileId)
        const existingFile = get().files.find(f => f.id === existingFileId)
        await updateDoc(fileRef, {
          versions: [...(existingFile?.versions || []), newVersion],
          currentVersion
        })
      } else {
        await addDoc(collection(db, 'projects', projectId, 'files'), {
          name: file.name,
          type: fileType,
          versions: [newVersion],
          currentVersion,
          createdAt: Timestamp.now()
        })
      }

      toast.success(`Tải lên thành công v${currentVersion}`)
    } catch (error: any) {
      toast.error('Lỗi tải lên: ' + error.message)
      throw error
    } finally {
      set({ uploading: false })
    }
  },

  selectFile: (file: FileType | null) => {
    set({ selectedFile: file })
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

  cleanup: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, files: [], selectedFile: null })
    }
  },
}))
