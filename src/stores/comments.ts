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
import type { Comment } from '../types'
import toast from 'react-hot-toast'

interface CommentState {
  comments: Comment[]
  loading: boolean
  unsubscribe: Unsubscribe | null
  
  subscribeToComments: (projectId: string, fileId?: string) => void
  addComment: (projectId: string, fileId: string, version: number, userName: string, content: string, timestamp?: number) => Promise<void>
  toggleResolve: (projectId: string, commentId: string, isResolved: boolean) => Promise<void>
  cleanup: () => void
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loading: false,
  unsubscribe: null,

  subscribeToComments: (projectId: string, fileId?: string) => {
    let q = query(
      collection(db, 'projects', projectId, 'comments'),
      orderBy('createdAt', 'asc')
    )

    if (fileId) {
      q = query(
        collection(db, 'projects', projectId, 'comments'),
        where('fileId', '==', fileId),
        orderBy('createdAt', 'asc')
      )
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        projectId,
        ...doc.data()
      })) as Comment[]
      
      set({ comments })
    }, (error) => {
      toast.error('Lỗi tải bình luận: ' + error.message)
    })

    set({ unsubscribe })
  },

  addComment: async (projectId: string, fileId: string, version: number, userName: string, content: string, timestamp?: number) => {
    set({ loading: true })
    try {
      await addDoc(collection(db, 'projects', projectId, 'comments'), {
        fileId,
        version,
        userName,
        content,
        timestamp: timestamp ?? null,
        isResolved: false,
        createdAt: Timestamp.now()
      })
    } catch (error: any) {
      toast.error('Lỗi thêm bình luận: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  toggleResolve: async (projectId: string, commentId: string, isResolved: boolean) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
        isResolved
      })
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message)
    }
  },

  cleanup: () => {
    const { unsubscribe } = get()
    if (unsubscribe) {
      unsubscribe()
      set({ unsubscribe: null, comments: [] })
    }
  },
}))
