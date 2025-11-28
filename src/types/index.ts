import { Timestamp } from 'firebase/firestore'

export type FileType = 'image' | 'video' | 'model'
export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  name: string
  createdAt: Timestamp
  status: ProjectStatus
  adminEmail: string
}

export interface FileVersion {
  url: string
  version: number
  uploadedAt: Timestamp
  metadata: {
    size: number
    type: string
    width?: number
    height?: number
    duration?: number
  }
}

export interface File {
  id: string
  projectId: string
  name: string
  type: FileType
  versions: FileVersion[]
  currentVersion: number
  createdAt: Timestamp
}

export interface Comment {
  id: string
  projectId: string
  fileId: string
  version: number
  userName: string
  content: string
  timestamp: number | null // seconds for video
  isResolved: boolean
  createdAt: Timestamp
}
