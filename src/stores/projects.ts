import { create } from 'zustand'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Project } from '../types'
import toast from 'react-hot-toast'

interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  loading: boolean
  unsubscribe: Unsubscribe | null
  
  subscribeToProjects: (adminEmail: string) => void
  createProject: (name: string, adminEmail: string) => Promise<string>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  selectProject: (project: Project | null) => void
  cleanup: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProject: null,
  loading: false,
  unsubscribe: null,

  subscribeToProjects: (adminEmail: string) => {
    const q = query(
      collection(db, 'projects'),
      where('adminEmail', '==', adminEmail),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[]
      
      set({ projects })
    }, (error) => {
      toast.error('Lỗi tải dự án: ' + error.message)
    })

    set({ unsubscribe })
  },

  createProject: async (name: string, adminEmail: string) => {
    set({ loading: true })
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        adminEmail,
        status: 'active',
        createdAt: Timestamp.now()
      })
      toast.success('Tạo dự án thành công')
      return docRef.id
    } catch (error: any) {
      toast.error('Lỗi tạo dự án: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    set({ loading: true })
    try {
      await updateDoc(doc(db, 'projects', id), data as any)
      toast.success('Cập nhật thành công')
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  // Optional helper: archive/unarchive
  

  selectProject: (project: Project | null) => {
    set({ selectedProject: project })
  },

  cleanup: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, projects: [], selectedProject: null })
    }
  },
}))
