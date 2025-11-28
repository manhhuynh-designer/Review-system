import { create } from 'zustand'
import type { User } from 'firebase/auth'
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import toast from 'react-hot-toast'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => (() => void)
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true })
    })
    return unsubscribe
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast.success('Đăng nhập thành công')
    } catch (error: any) {
      toast.error(error.message || 'Đăng nhập thất bại')
      throw error
    } finally {
      set({ loading: false })
    }
  },

  signOut: async () => {
    set({ loading: true })
    try {
      await firebaseSignOut(auth)
      toast.success('Đã đăng xuất')
    } catch (error: any) {
      toast.error(error.message || 'Đăng xuất thất bại')
    } finally {
      set({ loading: false })
    }
  },
}))
