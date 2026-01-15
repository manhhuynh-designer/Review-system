import { create } from 'zustand'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Notification, NotificationType } from '@/types'

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null

  // Actions
  subscribeToNotifications: (adminEmail: string) => void
  createNotification: (data: {
    type: NotificationType
    projectId: string
    projectName: string
    fileId?: string
    fileName?: string
    userName?: string
    message: string
    adminEmail: string
  }) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: (adminEmail: string) => Promise<void>
  cleanup: () => void
}

let unsubscribe: (() => void) | null = null

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  subscribeToNotifications: (adminEmail: string) => {
    const normalizedEmail = adminEmail ? String(adminEmail).toLowerCase() : adminEmail


    if (unsubscribe) {

      unsubscribe()
    }

    set({ loading: true, error: null })

    try {
      // Temporary: Query without orderBy until index is created
      const q = query(
        collection(db, 'notifications'),
        where('adminEmail', '==', normalizedEmail)
      )



      unsubscribe = onSnapshot(
        q,
        (snapshot) => {


          const notifications = snapshot.docs.map(doc => {
            const data = doc.data()

            return {
              id: doc.id,
              ...data
            }
          }) as Notification[]

          // Sort manually since we can't use orderBy yet
          notifications.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.()?.getTime() || 0
            const bTime = b.createdAt?.toDate?.()?.getTime() || 0
            return bTime - aTime
          })

          const unreadCount = notifications.filter(n => !n.isRead).length



          set({
            notifications,
            unreadCount,
            loading: false,
            error: null
          })
        },
        (error) => {
          console.error('❌ Notifications subscription error:', error)
          set({
            loading: false,
            error: 'Failed to load notifications'
          })
        }
      )
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error)
      set({ loading: false, error: 'Failed to subscribe' })
    }
  },

  createNotification: async (data) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...data,
        isRead: false,
        createdAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Failed to create notification:', error)
      throw error
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      const notifRef = doc(db, 'notifications', notificationId)
      await updateDoc(notifRef, {
        isRead: true
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      throw error
    }
  },

  markAllAsRead: async (adminEmail: string) => {
    try {
      const normalizedEmail = adminEmail ? String(adminEmail).toLowerCase() : adminEmail
      const q = query(
        collection(db, 'notifications'),
        where('adminEmail', '==', normalizedEmail),
        where('isRead', '==', false)
      )

      const snapshot = await getDocs(q)
      const batch = writeBatch(db)

      snapshot.docs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, { isRead: true })
      })

      await batch.commit()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      throw error
    }
  },

  cleanup: () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    set({
      notifications: [],
      unreadCount: 0,
      loading: false,
      error: null
    })
  }
}))
