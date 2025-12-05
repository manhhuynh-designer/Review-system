import { addDoc, collection, getDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { NotificationType } from '@/types'

/**
 * Create a notification for admin
 */
export async function createNotification(params: {
  type: NotificationType
  projectId: string
  fileId?: string
  userName?: string
  message: string
  adminEmail: string
}) {
  console.log('📧 createNotification called with:', params)

  try {
    // Get project name
    const projectDoc = await getDoc(doc(db, 'projects', params.projectId))
    const projectName = projectDoc.exists() ? projectDoc.data().name : 'Unknown Project'
    console.log('📁 Project name:', projectName)

    // Get file name if fileId provided
    let fileName: string | undefined
    if (params.fileId) {
      const fileDoc = await getDoc(doc(db, 'projects', params.projectId, 'files', params.fileId))
      fileName = fileDoc.exists() ? fileDoc.data().name : undefined
      console.log('📄 File name:', fileName)
    }

    const notificationData = {
      type: params.type,
      projectId: params.projectId,
      projectName,
      fileId: params.fileId,
      fileName,
      userName: params.userName ?? null,
      message: params.message,
      isRead: false,
      createdAt: Timestamp.now(),
      adminEmail: params.adminEmail
    }

    console.log('💾 Saving notification to Firestore:', notificationData)

    const docRef = await addDoc(collection(db, 'notifications'), notificationData)

    console.log('✅ Notification created successfully with ID:', docRef.id)
  } catch (error) {
    console.error('❌ Failed to create notification:', error)
    // Don't throw - notifications are not critical
  }
}
