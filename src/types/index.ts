import { Timestamp } from 'firebase/firestore'

export type FileType = 'image' | 'video' | 'model' | 'sequence' | 'pdf'
export type ProjectStatus = 'active' | 'archived'

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  notes?: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  adminEmail: string
}

export interface Project {
  id: string
  name: string
  description?: string
  clientId?: string
  clientName?: string // Cached for display
  clientEmail?: string // Cached for display
  deadline?: Timestamp
  tags?: string[]
  createdAt: Timestamp
  updatedAt?: Timestamp
  status: ProjectStatus
  adminEmail: string
}

export interface FileVersion {
  url: string
  version: number
  uploadedAt: Timestamp
  sequenceUrls?: string[] // For image sequences
  frameCount?: number // Number of frames in sequence
  frameCaptions?: Record<number, string> // Captions for each frame (frame index -> caption text)
  thumbnailUrl?: string // Custom thumbnail for 3D models
  cameraState?: { // Camera position for 3D models
    position: [number, number, number]
    target: [number, number, number]
  }
  // Extended version metadata
  versionLabel?: string // Human-readable version label (e.g., "Final", "Draft 1", "v2.1")
  versionNotes?: string // Optional notes about this version
  isLatest?: boolean // Computed field for UI convenience
  metadata: {
    size: number
    type: string
    name: string
    lastModified?: number
    width?: number
    height?: number
    duration?: number
  }
  validationStatus?: 'pending' | 'clean' | 'infected' | 'error'
}

export interface File {
  id: string
  projectId: string
  name: string
  type: FileType
  versions: FileVersion[]
  currentVersion: number
  sequenceViewMode?: 'video' | 'carousel' | 'grid' // Admin-set view mode for sequences
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
  parentCommentId: string | null // For threading
  createdAt: Timestamp
  // --- Advanced features ---
  isPinned?: boolean
  annotationData?: string | null // JSON.stringify(AnnotationObject[])
  // --- Image attachments ---
  imageUrls?: string[] // Firebase Storage URLs for attached images
  attachments?: {
    id: string
    type: 'image' | 'file'
    url: string
    name: string
    size: number
    mimeType?: string
    validationStatus?: 'pending' | 'clean' | 'infected' | 'error'
  }[]
  isPending?: boolean // Optimistic UI state
  isEdited?: boolean
  updatedAt?: Timestamp
}

export interface AnnotationObject {
  id: string
  type: 'pen' | 'rect' | 'arrow' | 'text'
  color: string
  strokeWidth?: number
  // Normalized coordinates (0..1)
  points?: number[] // For 'pen' -> [x1,y1,x2,y2,...]
  x?: number
  y?: number
  w?: number
  h?: number
  startPoint?: { x: number; y: number }
  endPoint?: { x: number; y: number }
  // Text & transform fields
  text?: string
  fontSize?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
}

export type NotificationType = 'upload' | 'comment' | 'resolve'

export interface Notification {
  id: string
  type: NotificationType
  projectId: string
  projectName: string
  fileId?: string
  fileName?: string
  userName?: string
  message: string
  isRead: boolean
  createdAt: Timestamp
  adminEmail: string
}
