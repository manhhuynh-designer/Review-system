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
  Timestamp,
  getDoc
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db, uploadCommentAttachments } from '../lib/firebase'
import { createNotification } from '../lib/notifications'
import type { Comment } from '../types'
import toast from 'react-hot-toast'

interface CommentState {
  comments: Comment[]
  loading: boolean
  unsubscribe: Unsubscribe | null
  unsubscribeMap: Map<string, Unsubscribe>

  subscribeToComments: (projectId: string, fileId?: string) => void
  addComment: (projectId: string, fileId: string, version: number, userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => Promise<void>
  toggleResolve: (projectId: string, commentId: string, isResolved: boolean) => Promise<void>
  togglePin: (projectId: string, commentId: string, currentStatus: boolean) => Promise<void>
  editComment: (projectId: string, commentId: string, newContent: string) => Promise<void>
  deleteComment: (projectId: string, commentId: string) => Promise<void>
  updateDisplayName: (projectId: string, commentId: string, newDisplayName: string) => Promise<void>
  toggleReaction: (projectId: string, commentId: string, reactionType: string, userId: string) => Promise<void>
  cleanup: () => void
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loading: false,
  unsubscribe: null,
  unsubscribeMap: new Map(),

  subscribeToComments: (projectId: string, fileId?: string) => {
    const { unsubscribeMap } = get()
    const subscriptionKey = fileId ? `${projectId}:${fileId}` : projectId

    // Skip if already subscribed
    if (unsubscribeMap.has(subscriptionKey)) {
      return
    }

    let q = query(
      collection(db, 'projects', projectId, 'comments'),
      orderBy('createdAt', 'desc')
    )

    if (fileId) {
      q = query(
        collection(db, 'projects', projectId, 'comments'),
        where('fileId', '==', fileId),
        orderBy('createdAt', 'desc')
      )
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({
        id: doc.id,
        projectId,
        ...doc.data()
      })) as Comment[]

      // Merge with existing comments from other projects
      set((state) => {
        const existingComments = state.comments.filter(c => c.projectId !== projectId || (fileId && c.fileId !== fileId))
        const allComments = [...existingComments, ...newComments]

        // Sort: pinned first, then by date
        allComments.sort((a, b) => {
          const aPinned = (a as any).isPinned ? 1 : 0
          const bPinned = (b as any).isPinned ? 1 : 0
          if (aPinned !== bPinned) return bPinned - aPinned
          const aTime = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : 0
          const bTime = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : 0
          return bTime - aTime
        })

        return { comments: allComments }
      })
    }, (error) => {
      toast.error('Lỗi tải bình luận: ' + error.message)
    })

    // Store the unsubscribe function
    unsubscribeMap.set(subscriptionKey, unsubscribe)
    set({ unsubscribeMap, unsubscribe })
  },

  addComment: async (projectId: string, fileId: string, version: number, userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => {
    set({ loading: true })

    // Generate temporary ID for optimistic update
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create optimistic comment
    const optimisticComment: Comment = {
      id: tempId,
      projectId,
      fileId,
      version,
      userName,
      content,
      timestamp: timestamp ?? null,
      parentCommentId: parentCommentId ?? null,
      isResolved: false,
      isPinned: false,
      annotationData: annotationData ?? null,
      createdAt: { toDate: () => new Date(), toMillis: () => Date.now() } as any,
      attachments: undefined,
      imageUrls: undefined,
      isPending: true // Mark as pending
    }

    // Add optimistic comment to state immediately
    set(state => ({
      comments: [optimisticComment, ...state.comments]
    }))

    try {
      // Create comment document in Firestore
      const commentRef = await addDoc(collection(db, 'projects', projectId, 'comments'), {
        fileId,
        version,
        userName,
        content,
        timestamp: timestamp ?? null,
        parentCommentId: parentCommentId ?? null,
        isResolved: false,
        isPinned: false,
        annotationData: annotationData ?? null,
        createdAt: Timestamp.now(),
        attachments: null,
        imageUrls: null
      })

      // Upload attachments if any
      let uploadedAttachments = null
      let imageUrls = null
      if (attachments && attachments.length > 0) {
        uploadedAttachments = await uploadCommentAttachments(attachments, projectId, commentRef.id)
        imageUrls = uploadedAttachments
          .filter(att => att.type === 'image')
          .map(att => att.url)

        // Update comment with attachment data
        await updateDoc(commentRef, {
          attachments: uploadedAttachments,
          imageUrls: imageUrls.length > 0 ? imageUrls : null
        })
      }

      // Cloud Functions will automatically create notifications and send emails
      // when a comment is created, so we no longer need to do this client-side

      // Remove optimistic comment from state
      // The real comment will be added via the Firestore listener
      set(state => ({
        comments: state.comments.filter(c => c.id !== tempId)
      }))

    } catch (error: any) {
      console.error('❌ Error adding comment:', error)

      // Remove optimistic comment on error
      set(state => ({
        comments: state.comments.filter(c => c.id !== tempId)
      }))

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

  togglePin: async (projectId: string, commentId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
        isPinned: !currentStatus
      })
    } catch (error: any) {
      console.error('Failed to toggle pin:', error)
      toast.error('Lỗi cập nhật pin: ' + (error.message || String(error)))
    }
  },

  editComment: async (projectId: string, commentId: string, newContent: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
        content: newContent,
        isEdited: true,
        updatedAt: Timestamp.now()
      })
      toast.success('Đã cập nhật bình luận')
    } catch (error: any) {
      console.error('Failed to edit comment:', error)
      toast.error('Lỗi cập nhật bình luận: ' + error.message)
    }
  },

  deleteComment: async (projectId: string, commentId: string) => {
    try {
      // Note: This only deletes the comment document. 
      // Attachments in storage are not automatically deleted here (would need a cloud function or manual cleanup)
      // Also child replies are not deleted (would need recursive delete)

      // For now, we'll just delete the comment document
      // Ideally we should mark as deleted instead of hard delete to preserve thread structure
      // But for this requirement, hard delete is likely expected

      // Check if it has replies first?
      // For simplicity, we just delete. Replies might become orphans or we can filter them out in UI if parent missing

      // Better approach for replies: The UI organizes by parentId. If parent is gone, they might disappear or show at top level.
      // Let's rely on the user to delete replies first or accept they might become orphans.

      // Actually, let's use deleteDoc
      const { deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'projects', projectId, 'comments', commentId))
      toast.success('Đã xóa bình luận')
    } catch (error: any) {
      console.error('Failed to delete comment:', error)
      toast.error('Lỗi xóa bình luận: ' + error.message)
    }
  },

  updateDisplayName: async (projectId: string, commentId: string, newDisplayName: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
        userName: newDisplayName,
        isEdited: true,
        updatedAt: Timestamp.now()
      })
      toast.success('Đã cập nhật tên hiển thị')
    } catch (error: any) {
      console.error('Failed to update display name:', error)
      toast.error('Lỗi cập nhật tên hiển thị: ' + error.message)
    }
  },

  cleanup: () => {
    const { unsubscribe, unsubscribeMap } = get()

    // Cleanup all subscriptions
    if (unsubscribeMap && unsubscribeMap.size > 0) {
      unsubscribeMap.forEach(unsub => unsub())
      unsubscribeMap.clear()
    }

    if (unsubscribe) {
      unsubscribe()
    }

    set({ unsubscribe: null, unsubscribeMap: new Map(), comments: [] })
  },

  toggleReaction: async (projectId: string, commentId: string, reactionType: string, userId: string) => {
    try {
      const commentRef = doc(db, 'projects', projectId, 'comments', commentId)
      const commentDoc = await getDoc(commentRef)

      if (!commentDoc.exists()) return

      const data = commentDoc.data()
      const reactions = data.reactions || {}
      const userList = reactions[reactionType] || []

      let newReactions = { ...reactions }

      if (userList.includes(userId)) {
        // Remove reaction
        newReactions[reactionType] = userList.filter((id: string) => id !== userId)
        // Cleanup empty arrays
        if (newReactions[reactionType].length === 0) {
          delete newReactions[reactionType]
        }
      } else {
        // Add reaction
        newReactions[reactionType] = [...userList, userId]
      }

      await updateDoc(commentRef, {
        reactions: newReactions
      })
    } catch (error: any) {
      console.error('Failed to toggle reaction:', error)
      toast.error('Lỗi thả cảm xúc: ' + error.message)
    }
  }
}))
