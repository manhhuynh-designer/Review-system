import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

console.log('🔥 Firebase config:', {
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
})

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

console.log('🗄️ Firebase Storage initialized with bucket:', firebaseConfig.storageBucket)

// Upload file to Firebase Storage and return download URL
export async function uploadFile(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return await getDownloadURL(snapshot.ref)
}

// Upload multiple comment attachments
export async function uploadCommentAttachments(files: File[], projectId: string, commentId: string): Promise<{id: string, type: 'image' | 'file', url: string, name: string, size: number, mimeType?: string}[]> {
  // Ensure the user is authenticated before attempting to upload attachments.
  // Firebase Storage rules expect `request.auth != null` for writes to comments/ paths.
  if (!auth.currentUser) {
    throw new Error('User not authenticated. Please sign in to upload attachments.')
  }
  const uploadPromises = files.map(async (file, index) => {
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `comments/${projectId}/${commentId}/${timestamp}_${index}_${sanitizedFileName}`
    
    const url = await uploadFile(file, path)
    
    return {
      id: `${commentId}_${timestamp}_${index}`,
      type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
      url,
      name: file.name,
      size: file.size,
      mimeType: file.type
    }
  })
  
  return await Promise.all(uploadPromises)
}

export default app
