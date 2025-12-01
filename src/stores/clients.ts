import { create } from 'zustand'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Client } from '../types'
import toast from 'react-hot-toast'

interface ClientState {
  clients: Client[]
  loading: boolean
  isSubscribed: boolean
  currentAdminEmail: string | null
  unsubscribe: Unsubscribe | null
  
  subscribeToClients: (adminEmail: string) => void
  createClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'adminEmail'>, adminEmail: string) => Promise<string>
  updateClient: (id: string, data: Partial<Client>) => Promise<void>
  deleteClient: (id: string) => Promise<void>
  cleanup: () => void
}

export const useClientStore = create<ClientState>((set, get) => ({
  clients: [],
  loading: false,
  isSubscribed: false,
  currentAdminEmail: null,
  unsubscribe: null,

  subscribeToClients: (adminEmail: string) => {
    const { isSubscribed, currentAdminEmail } = get()
    
    if (isSubscribed && currentAdminEmail === adminEmail) {
      console.log('🔄 Clients already subscribed for', adminEmail)
      return
    }
    
    if (isSubscribed && currentAdminEmail !== adminEmail) {
      console.log('🧹 Cleaning up clients subscription for', currentAdminEmail)
      get().cleanup()
    }
    
    console.log('📡 Starting clients subscription for', adminEmail)
    set({ isSubscribed: true, currentAdminEmail: adminEmail })
    
    const q = query(
      collection(db, 'clients'),
      where('adminEmail', '==', adminEmail),
      orderBy('name', 'asc')
    )

    const off = onSnapshot(q, (snapshot) => {
      const clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[]
      console.log('📊 Clients loaded:', clients.length)
      set({ clients })
    }, (error: any) => {
      // Fallback without orderBy if index not ready
      const msg = String(error?.message || '')
      if (msg.toLowerCase().includes('requires an index') || error?.code === 'failed-precondition') {
        toast('Đang xây dựng Firestore index cho clients...', { icon: '⏳' })
        const fallback = query(
          collection(db, 'clients'),
          where('adminEmail', '==', adminEmail)
        )
        const off2 = onSnapshot(fallback, (snapshot2) => {
          const clients = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[]
          console.log('📊 Clients loaded (fallback):', clients.length)
          set({ clients })
        }, (err2) => {
          toast.error('Lỗi tải khách hàng: ' + (err2?.message || ''))
          console.error('[clients] fallback error', err2)
          set({ isSubscribed: false })
        })
        set({ unsubscribe: off2 })
      } else {
        toast.error('Lỗi tải khách hàng: ' + (error?.message || ''))
        console.error('[clients] onSnapshot error', error)
        set({ isSubscribed: false })
      }
    })

    set({ unsubscribe: off })
  },

  createClient: async (data, adminEmail) => {
    set({ loading: true })
    try {
      const now = Timestamp.now()
      
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      )
      
      const docRef = await addDoc(collection(db, 'clients'), {
        ...cleanData,
        adminEmail,
        createdAt: now,
        updatedAt: now
      })
      toast.success('Tạo khách hàng thành công')
      return docRef.id
    } catch (error: any) {
      toast.error('Lỗi tạo khách hàng: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  updateClient: async (id: string, data: Partial<Client>) => {
    set({ loading: true })
    try {
      // Filter out undefined values
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      )
      
      await updateDoc(doc(db, 'clients', id), {
        ...cleanData,
        updatedAt: Timestamp.now()
      } as any)
      toast.success('Cập nhật khách hàng thành công')
    } catch (error: any) {
      toast.error('Lỗi cập nhật khách hàng: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  deleteClient: async (id: string) => {
    set({ loading: true })
    try {
      await deleteDoc(doc(db, 'clients', id))
      toast.success('Xóa khách hàng thành công')
    } catch (error: any) {
      toast.error('Lỗi xóa khách hàng: ' + error.message)
      throw error
    } finally {
      set({ loading: false })
    }
  },

  cleanup: () => {
    const { unsubscribe } = get()
    console.log('🧹 Cleaning up clients subscription')
    if (unsubscribe) {
      unsubscribe()
      set({ 
        unsubscribe: null, 
        clients: [],
        isSubscribed: false,
        currentAdminEmail: null
      })
    }
  },
}))
