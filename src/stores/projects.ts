import { create } from 'zustand'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
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
  project: Project | null
  selectedProject: Project | null
  loading: boolean
  isSubscribed: boolean
  currentAdminEmail: string | null
  unsubscribe: Unsubscribe | null

  subscribeToProjects: (adminEmail: string) => void
  fetchProject: (projectId: string) => Promise<void>
  createProject: (data: Partial<Project>) => Promise<string>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void> // Soft delete (move to trash)
  trashProject: (id: string) => Promise<void> // Alias for deleteProject
  restoreProject: (id: string) => Promise<void> // Restore from trash
  permanentDeleteProject: (id: string) => Promise<void> // Hard delete
  archiveProject: (id: string, archiveUrl: string) => Promise<void>
  toggleProjectLock: (id: string, isLocked: boolean) => Promise<void>
  selectProject: (project: Project | null) => void
  cleanup: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  project: null,
  selectedProject: null,
  loading: false,
  isSubscribed: false,
  currentAdminEmail: null,
  unsubscribe: null,

  fetchProject: async (projectId: string) => {
    try {
      const docRef = doc(db, 'projects', projectId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const project = { id: docSnap.id, ...docSnap.data() } as Project
        set({ project })
      } else {
        set({ project: null })
        toast.error('Không tìm thấy dự án')
      }
    } catch (error) {
      console.error('Error fetching project:', error)
      set({ project: null })
      toast.error('Lỗi khi tải dự án')
    }
  },

  subscribeToProjects: (adminEmail: string) => {
    const { isSubscribed, currentAdminEmail } = get()

    // Avoid duplicate subscriptions for same admin
    if (isSubscribed && currentAdminEmail === adminEmail) {

      return
    }

    // Cleanup existing subscription if switching users
    if (isSubscribed && currentAdminEmail !== adminEmail) {

      get().cleanup()
    }


    set({ isSubscribed: true, currentAdminEmail: adminEmail })

    const baseCol = collection(db, 'projects')

    // Preferred query: filter by adminEmail and order by createdAt desc
    const q = query(
      baseCol,
      where('adminEmail', '==', adminEmail),
      orderBy('createdAt', 'desc')
    )

    const off = onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[]

      set({ projects })
    }, (error: any) => {
      // Graceful fallback while Firestore builds the index
      const msg = String(error?.message || '')
      if (msg.toLowerCase().includes('requires an index') || error?.code === 'failed-precondition') {
        toast('Đang xây dựng Firestore index. Tạm thời hiển thị không sắp xếp.', { icon: '⏳' })
        const fallback = query(baseCol, where('adminEmail', '==', adminEmail))
        const off2 = onSnapshot(fallback, (snapshot2) => {
          const projects = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]

          set({ projects })
        }, (err2) => {
          toast.error('Lỗi tải dự án (fallback): ' + (err2?.message || ''))
          console.error('[projects] fallback error', err2)
          set({ isSubscribed: false })
        })
        set({ unsubscribe: off2 })
      } else {
        toast.error('Lỗi tải dự án: ' + (error?.message || ''))
        console.error('[projects] onSnapshot error', error)
        set({ isSubscribed: false })
      }
    })

    set({ unsubscribe: off })
  },

  createProject: async (data: Partial<Project>) => {
    set({ loading: true })
    try {
      const now = Timestamp.now()

      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      )

      const docRef = await addDoc(collection(db, 'projects'), {
        status: 'active',
        tags: [],
        createdAt: now,
        updatedAt: now,
        ...cleanData,
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
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      )

      await updateDoc(doc(db, 'projects', id), {
        ...cleanData,
        updatedAt: Timestamp.now()
      } as any)
      toast.success('Cập nhật thành công')
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  deleteProject: async (id: string) => {
    // Soft delete - move to trash
    set({ loading: true })
    try {
      const project = get().projects.find(p => p.id === id)
      if (!project) throw new Error('Project not found')

      await updateDoc(doc(db, 'projects', id), {
        previousStatus: project.status,
        status: 'trash',
        trashedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      toast.success('Đã chuyển dự án vào thùng rác')
    } catch (error: any) {
      toast.error('Lỗi xóa dự án: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  trashProject: async (id: string) => {
    // Alias for deleteProject
    return get().deleteProject(id)
  },

  restoreProject: async (id: string) => {
    set({ loading: true })
    try {
      const project = get().projects.find(p => p.id === id)
      if (!project) throw new Error('Project not found')

      const restoreStatus = project.previousStatus || 'active'

      await updateDoc(doc(db, 'projects', id), {
        status: restoreStatus,
        trashedAt: null,
        previousStatus: null,
        updatedAt: Timestamp.now()
      })
      toast.success('Đã khôi phục dự án')
    } catch (error: any) {
      toast.error('Lỗi khôi phục dự án: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  permanentDeleteProject: async (id: string) => {
    set({ loading: true })
    try {
      await deleteDoc(doc(db, 'projects', id))
      toast.success('Đã xóa vĩnh viễn dự án')
    } catch (error: any) {
      toast.error('Lỗi xóa vĩnh viễn: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  archiveProject: async (id: string, archiveUrl: string) => {
    set({ loading: true })
    try {
      const now = Timestamp.now()

      // 1. Update project status and metadata
      await updateDoc(doc(db, 'projects', id), {
        status: 'archived',
        archiveUrl,
        archivedAt: now,
        updatedAt: now,
        isCommentsLocked: true // Auto-lock comments when archiving
      })

      toast.success('Dự án đã được lưu trữ')
    } catch (error: any) {
      toast.error('Lỗi khi lưu trữ dự án: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  toggleProjectLock: async (projectId: string, isLocked: boolean) => {
    try {
      const projectRef = doc(db, 'projects', projectId)
      await updateDoc(projectRef, {
        isCommentsLocked: isLocked,
        updatedAt: Timestamp.now()
      })

      set(state => ({
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, isCommentsLocked: isLocked } : p
        )
      }))

      toast.success(isLocked ? 'Đã khóa bình luận dự án' : 'Đã mở khóa bình luận dự án')
    } catch (error) {
      console.error('Error toggling project lock:', error)
      toast.error('Lỗi khi cập nhật trạng thái khóa bình luận')
    }
  },

  selectProject: (project: Project | null) => {
    set({ selectedProject: project })
  },

  cleanup: () => {
    const { unsubscribe } = get()

    if (unsubscribe) {
      unsubscribe()
      set({
        unsubscribe: null,
        projects: [],
        selectedProject: null,
        isSubscribed: false,
        currentAdminEmail: null
      })
    }
  },
}))
