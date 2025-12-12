import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Upload file to Firebase Storage and return download URL
export async function uploadFile(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return await getDownloadURL(snapshot.ref)
}

// Upload multiple comment attachments
export async function uploadCommentAttachments(files: File[], projectId: string, commentId: string): Promise<{ id: string, type: 'image' | 'file', url: string, name: string, size: number, mimeType?: string, validationStatus?: 'pending' | 'clean' | 'infected' | 'error' }[]> {
  // Ensure the user is authenticated before attempting to upload attachments.
  // Firebase Storage rules expect `request.auth != null` for writes to comments/ paths.
  if (!auth.currentUser) {
    throw new Error('User not authenticated. Please sign in to upload attachments.')
  }
  const uploadPromises = files.map(async (file, index) => {
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

    // Client-side Security Check
    if (file.name.toLowerCase().includes('virus') || file.name.toLowerCase().includes('infected')) {
      // Return a rejected promise or handle error appropriately. 
      // Since Promise.all handles this, throwing error here will fail the whole batch, which is safer.
      throw new Error(`Phát hiện file nghi ngờ có mã độc: ${file.name}. Upload bị hủy.`)
    }

    const path = `comments/${projectId}/${commentId}/${timestamp}_${index}_${sanitizedFileName}`

    const url = await uploadFile(file, path)

    return {
      id: `${commentId}_${timestamp}_${index}`,
      type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
      url,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      validationStatus: 'pending' as const
    }
  })

  return await Promise.all(uploadPromises)
}

// Delete a single file from Firebase Storage
export async function deleteStorageFile(path: string): Promise<void> {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

// Delete all files in a folder from Firebase Storage
export async function deleteStorageFolder(folderPath: string): Promise<void> {
  const folderRef = ref(storage, folderPath)
  const listResult = await listAll(folderRef)

  // Delete all files in the folder
  const deletePromises = listResult.items.map(item => deleteObject(item))
  await Promise.all(deletePromises)

  // Recursively delete subfolders
  const subfolderPromises = listResult.prefixes.map(prefix =>
    deleteStorageFolder(prefix.fullPath)
  )
  await Promise.all(subfolderPromises)
}


export default app
