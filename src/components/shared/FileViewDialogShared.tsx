import { useState, useRef, lazy, Suspense, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { File as FileType } from '@/types'
import { format } from 'date-fns'
import { formatFileSize } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  Clock,
  FileImage,
  Video,
  Box,
  ChevronDown,
  MessageSquare,
  Upload,
  Film,
  Columns,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Pencil,
  Check,
  FileText,
  HelpCircle,
  Share2,
  Copy,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  Layers
} from 'lucide-react'
import { startFileTour, hasSeenTour } from '@/lib/fileTours'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UploadDialog } from '@/components/files/UploadDialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider'
import { AddComment } from '@/components/comments/AddComment'
import { CommentsList } from '@/components/comments/CommentsList'
import { ImageSequenceViewer } from '@/components/viewers/ImageSequenceViewer'
import { CustomVideoPlayer, type CustomVideoPlayerRef } from '@/components/viewers/CustomVideoPlayer'
import { VideoFrameControls } from '@/components/viewers/VideoFrameControls'
import { PDFViewer } from '@/components/viewers/PDFViewer'
import { AnnotationCanvasKonva } from '@/components/annotations/AnnotationCanvasKonva'
import { AnnotationToolbar } from '@/components/annotations/AnnotationToolbar'

import type { AnnotationObject } from '@/types'
import type { GLBViewerRef } from '@/components/viewers/GLBViewer'
import { useFileStore } from '@/stores/files'
import { useAuthStore } from '@/stores/auth'
import { useVideoComparison } from '@/hooks/useVideoComparison'
import toast from 'react-hot-toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileFileViewLayout } from './mobile/MobileFileViewLayout'

const GLBViewer = lazy(() => import('@/components/viewers/GLBViewer').then(m => ({ default: m.GLBViewer })))

interface Props {
  file: FileType | null
  projectId: string
  resolvedUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchVersion?: (fileId: string, version: number) => void
  onUploadNewVersion?: (file: File, existingFileId: string) => Promise<void>
  onSequenceViewModeChange?: (fileId: string, mode: 'video' | 'carousel' | 'grid') => Promise<void>
  comments: any[]
  currentUserName: string
  onUserNameChange: (name: string) => void
  onAddComment: (userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => Promise<void>
  onResolveToggle?: (commentId: string, isResolved: boolean) => void
  onEditComment?: (commentId: string, newContent: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
  isAdmin?: boolean
  onCaptionChange?: (fileId: string, version: number, frame: number, caption: string) => Promise<void>
  onRenameFile?: (fileId: string, newName: string) => Promise<void>
  // Sequence frame context - for when viewing a single frame from a sequence
  sequenceContext?: {
    totalFrames: number
    currentFrameIndex: number
    frameCaptions?: Record<number, string>
    onNavigateFrame?: (frameIndex: number) => void
  }
  // Comment blocking props
  project?: { isCommentsLocked?: boolean }
  isArchived?: boolean
}

const getFileTypeIcon = (type: string) => {
  if (type === 'image') return <FileImage className="w-5 h-5 text-green-500" />
  if (type === 'video') return <Video className="w-5 h-5 text-blue-500" />
  if (type === 'model') return <Box className="w-5 h-5 text-purple-500" />
  if (type === 'sequence') return <Film className="w-5 h-5 text-orange-500" />
  if (type === 'pdf' || type.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-500" />
  return <FileImage className="w-5 h-5 text-gray-500" />
}

const getFileTypeLabel = (type: string) => {
  if (type === 'image') return 'Hình ảnh'
  if (type === 'video') return 'Video'
  if (type === 'model') return 'Mô hình 3D'
  if (type === 'sequence') return 'Image Sequence'
  if (type === 'pdf' || type.endsWith('.pdf')) return 'PDF'
  return 'Tệp tin'
}

export function FileViewDialogShared({
  file,
  projectId: _projectId,
  resolvedUrl,
  open,
  onOpenChange,
  onSwitchVersion,
  onUploadNewVersion,
  onSequenceViewModeChange,
  comments,
  currentUserName,
  onUserNameChange,
  onAddComment,
  onResolveToggle,
  onEditComment,
  onDeleteComment,
  isAdmin = false,
  onCaptionChange,
  sequenceContext,
  onRenameFile,
  project,
  isArchived = false
}: Props) {
  const [showComments, setShowComments] = useState(true)
  const [showOnlyCurrentTimeComments, setShowOnlyCurrentTimeComments] = useState(false)
  const [viewAllVersions, setViewAllVersions] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [videoFps, setVideoFps] = useState(30)
  const [videoDuration, setVideoDuration] = useState(0)
  const [currentAnnotationCommentId, setCurrentAnnotationCommentId] = useState<string | null>(null)

  const customVideoPlayerRef = useRef<CustomVideoPlayerRef>(null)

  const glbViewerRef = useRef<GLBViewerRef>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [leftVersion, setLeftVersion] = useState<number | null>(null)
  const [rightVersion, setRightVersion] = useState<number | null>(null)
  const [savingThumbnail, setSavingThumbnail] = useState(false)
  const [compareDisplayMode, setCompareDisplayMode] = useState<'side-by-side' | 'slider'>('side-by-side')
  const [comparePosition, setComparePosition] = useState<number>(50) // percent 0-100 for slider
  // Create a unique list of versions to prevent duplicates in display
  const uniqueVersions = useMemo(() => {
    if (!file?.versions) return []
    // Use a Map to keep unique versions, preferring the latest occurrence (assuming appending logic)
    // or we can sort by uploadedAt if available.
    // Given the issue is duplication in the array, simply keying by version number works.
    const versionMap = new Map()
    file.versions.forEach(v => {
      // Always overwrite, so we get the last one in the array (usually the latest)
      versionMap.set(v.version, v)
    })
    return Array.from(versionMap.values()).sort((a: any, b: any) => b.version - a.version)
  }, [file?.versions])

  const [currentVersion, setCurrentVersion] = useState(file?.currentVersion || 1)

  // Annotation state
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotationTool, setAnnotationTool] = useState<'pen' | 'rect' | 'arrow' | 'select' | 'eraser'>('pen')
  const [annotationColor, setAnnotationColor] = useState('#ffff00')
  const [annotationStrokeWidth, setAnnotationStrokeWidth] = useState(2)
  const [annotationData, setAnnotationData] = useState<AnnotationObject[] | null>(null)
  const [annotationHistory, setAnnotationHistory] = useState<AnnotationObject[][]>([])
  const [annotationHistoryIndex, setAnnotationHistoryIndex] = useState(0)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false)
  const [sequenceViewMode, setSequenceViewMode] = useState<'video' | 'carousel' | 'grid'>('video')
  const [frameDetailView, setFrameDetailView] = useState<number | null>(null)
  const [navMode, setNavMode] = useState<'frame' | 'marker'>('frame')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [pdfPage, setPdfPage] = useState(1)
  const [commentWidth, setCommentWidth] = useState(350)
  const [isResizing, setIsResizing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Image zoom level (applies to image + annotations)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  // Upload & Drag-n-Drop State
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Mobile detection
  const isMobile = useIsMobile()

  const resizingState = useRef({ startX: 0, startWidth: 350 })

  // Generate shareable link for this file
  const getShareLink = useCallback(() => {
    const baseUrl = window.location.origin
    // Use /share/p/ path to trigger metadata generation function
    return `${baseUrl}/share/p/${_projectId}/file/${file?.id}`
  }, [_projectId, file?.id])

  const copyShareLink = useCallback(async () => {
    const link = getShareLink()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Đã sao chép link chia sẻ!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Không thể sao chép link')
    }
  }, [getShareLink])

  // Tour Logic - delegated to fileTours module for better maintainability
  const handleStartTour = () => {
    if (!file) return
    const isMobile = (typeof window !== 'undefined') && (window.matchMedia ? window.matchMedia('(max-width: 640px)').matches : window.innerWidth <= 640)
    startFileTour({
      fileType: file.type as any,
      isMobile
    })
  }

  useEffect(() => {
    if (open && file) {
      ; (async () => {
        const seen = await hasSeenTour(file.type as any)
        if (!seen) {
          // Delay slightly to wait for dialog animation/render
          setTimeout(() => {
            handleStartTour()
          }, 1000)
        }
      })()
    }
  }, [open, file?.type])

  // File store for sequence frame operations
  const { reorderSequenceFrames, deleteSequenceFrames, addSequenceFrames, deleteVersion, uploading } = useFileStore()

  // Video comparison hook
  const videoComparison = useVideoComparison({
    primaryVersion: currentVersion,
    versions: file?.versions.map(v => ({ version: v.version, url: v.url })) || [],
    onSeek: (time) => setCurrentTime(time)
  })

  // Memoize video player callbacks to prevent CustomVideoPlayer re-renders
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleFullscreenChange = useCallback((fullscreen: boolean) => {
    setIsVideoFullscreen(fullscreen)
    if (fullscreen) {
      setShowOnlyCurrentTimeComments(true)
    }
  }, [])

  const handleLoadedMetadata = useCallback((duration: number, fps: number) => {
    setVideoDuration(duration)
    setVideoFps(fps)
  }, [])

  const handleVideoPlay = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const handleVideoPause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  // Update current version when file changes
  useEffect(() => {
    if (file) {
      setCurrentVersion(file.currentVersion)
      // reset compare selectors when file changes
      setLeftVersion(null)
      setRightVersion(null)

      // Reset view state when file/version changes
      setZoom(1)
      setPanOffset({ x: 0, y: 0 })

      // Reset video time when switching versions
      if (customVideoPlayerRef.current) {
        customVideoPlayerRef.current.seekTo(0)
      }
    }
  }, [file?.currentVersion, file?.id])

  // Auto-center when zoom is 1 or less
  useEffect(() => {
    if (zoom <= 1) {
      setPanOffset({ x: 0, y: 0 })
    }
  }, [zoom])

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAdmin) return // Only allow for admins
    if (!isDragOver) setIsDragOver(true)
  }, [isDragOver, isAdmin])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if we're leaving the main container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (!isAdmin) return // Only allow for admins

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // Check if file type matches (optional, but good UX)
      // For now, just pass to upload dialog which has its own validation
      setDroppedFiles(files)
      setShowUploadDialog(true)
    }
  }, [])

  if (!file) return null

  const current = file.versions.find(v => v.version === currentVersion) || file.versions[0]
  // Use resolvedUrl only if it's for the same version, otherwise use version's URL directly
  const effectiveUrl = (currentVersion === file.currentVersion && resolvedUrl)
    ? resolvedUrl
    : current?.url
  const uploadDate = current?.uploadedAt?.toDate ? current.uploadedAt.toDate() : new Date()

  // Memoize allFileComments to prevent CustomVideoPlayer re-renders
  const allFileComments = useMemo(
    () => {
      if (viewAllVersions) {
        return comments.filter(c => c.fileId === file.id)
      }
      return comments.filter(c => c.fileId === file.id && c.version === currentVersion)
    },
    [comments, file.id, currentVersion, viewAllVersions]
  )

  // Helper to get file extension from URL or MIME type
  const getFileExtension = (url: string, mimeType?: string, fileType?: string): string => {
    // Try to extract from URL first (works for direct storage paths)
    // Firebase URLs often have format: ...%2Ffilename.ext?alt=media&token=...
    let urlMatch = url.match(/\.([^./?#]+)(?=[?#]|$)/)

    if (!urlMatch && url.includes('%2F')) {
      // Try to find extension in encoded URL path
      const decoded = decodeURIComponent(url.split('?')[0])
      urlMatch = decoded.match(/\.([^./?#]+)$/)
    }

    if (urlMatch) {
      const ext = urlMatch[1].toLowerCase()
      if (ext === 'jpeg') return '.jpg'
      return `.${ext}`
    }

    // Try from MIME type
    if (mimeType) {
      const mimeMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'application/pdf': '.pdf',
        'model/gltf-binary': '.glb',
        'model/gltf+json': '.gltf',
        'application/octet-stream': ''
      }

      if (mimeMap[mimeType]) return mimeMap[mimeType]

      // Fallback to extracting from MIME type
      const ext = mimeType.split('/')[1]?.split('+')[0]?.split(';')[0]
      if (ext && ext !== 'octet-stream') {
        return `.${ext.replace('jpeg', 'jpg')}`
      }
    }

    // Fallback based on file type
    const typeMap: Record<string, string> = {
      'image': '.jpg',
      'video': '.mp4',
      'pdf': '.pdf',
      'model': '.glb',
      'sequence': '.jpg'
    }

    return typeMap[fileType || ''] || ''
  }

  // Helper to ensure filename has extension
  const ensureFileExtension = (filename: string, url: string, mimeType?: string, fileType?: string): string => {
    // Extract the extension we want to use
    const correctExt = getFileExtension(url, mimeType, fileType)

    if (!correctExt) {
      // No extension found anywhere, return as is
      return filename
    }

    // Check if filename already has the correct extension
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(filename)

    if (hasExtension) {
      // Replace existing extension with the correct one
      return filename.replace(/\.[^.]+$/, correctExt)
    }

    // Add extension if not present
    return `${filename}${correctExt}`
  }

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (!effectiveUrl) return

    // Create a progress toast
    const toastId = toast.loading('Đang khởi tạo tải xuống... 0%')

    try {
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest()
      xhr.open('GET', effectiveUrl, true)
      xhr.responseType = 'blob'

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          toast.loading(`Đang tải xuống... ${percentComplete}%`, { id: toastId })
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          const blob = xhr.response
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = ensureFileExtension(file.name, effectiveUrl, current?.metadata?.type, file.type)
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
          toast.success('Tải xuống hoàn tất!', { id: toastId })
        } else {
          toast.error('Có lỗi khi tải file', { id: toastId })
          // Fallback
          window.open(effectiveUrl, '_blank')
        }
      }

      xhr.onerror = () => {
        toast.error('Lỗi kết nối kiểm tra lại mạng', { id: toastId })
        // Fallback
        window.open(effectiveUrl, '_blank')
      }

      xhr.send()
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Có lỗi khi tải file', { id: toastId })
      window.open(effectiveUrl, '_blank')
    }
  }

  // Filter comments based on current time/frame if enabled
  const fileComments = showOnlyCurrentTimeComments && (file.type === 'video' || file.type === 'sequence' || file.type === 'pdf')
    ? allFileComments.filter(c => {
      if (c.timestamp === null || c.timestamp === undefined) return false

      if (file.type === 'video') {
        // Frame-accurate tolerance: 1 frame duration at current FPS
        const frameTolerance = 1 / videoFps
        return Math.abs(c.timestamp - currentTime) <= frameTolerance
      } else if (file.type === 'sequence') {
        // Exact frame match
        return c.timestamp === currentFrame
      } else if (file.type === 'pdf') {
        // Exact page match
        return c.timestamp === pdfPage
      }
      return true
    })
    : allFileComments

  // Auto-show/hide annotations based on playback time
  useEffect(() => {
    // Only auto-manage annotations if we are NOT in editing mode (creating new annotation)
    // We allow auto-switching if we are currently not annotating OR if we are in read-only mode (viewing)
    if (!isAnnotating || isReadOnly) {
      if (file.type === 'video' || file.type === 'sequence' || file.type === 'pdf') {
        // Find comments at the current time that have annotation data
        const matchingComments = allFileComments.filter(c => {
          if (c.timestamp === null || c.timestamp === undefined || !c.annotationData) return false

          if (file.type === 'video') {
            // Tolerance: 0.1s or 1 frame (whichever is larger to be safe, but small enough to be precise)
            const tolerance = Math.max(0.1, 1 / videoFps)
            return Math.abs(c.timestamp - currentTime) <= tolerance
          } else if (file.type === 'sequence') {
            return c.timestamp === currentFrame
          } else if (file.type === 'pdf') {
            return c.timestamp === pdfPage
          }
          return false
        })

        if (matchingComments.length > 0) {
          // Found comments with annotation at this time
          // If multiple, we prefer the one currently selected if it's in the list
          // Otherwise, default to the first one (or maybe the most recent?)
          const currentMatch = matchingComments.find(c => c.id === currentAnnotationCommentId)
          const targetComment = currentMatch || matchingComments[0]

          // Only update if we're not already viewing this specific annotation
          if (currentAnnotationCommentId !== targetComment.id) {
            handleViewAnnotation(targetComment.annotationData!, targetComment)
          }
        } else {
          // No matching comment at this time
          // If we are currently viewing an annotation (read-only), close it
          if (isAnnotating && isReadOnly) {
            // Force close if no match found (video moved past annotation)
            setIsAnnotating(false)
            setIsReadOnly(false)
            setAnnotationData(null)
            setCurrentAnnotationCommentId(null)
          }
        }
      }
    }
  }, [currentTime, currentFrame, file.type, isAnnotating, isReadOnly, allFileComments, videoFps, currentAnnotationCommentId])

  const handleTimestampClick = (timestamp: number) => {
    if (file.type === 'video' && customVideoPlayerRef.current) {
      customVideoPlayerRef.current.seekTo(timestamp)
      customVideoPlayerRef.current.pause() // Pause when jumping to a timestamp
    } else if (file.type === 'sequence') {
      // For sequences, timestamp represents frame number
      setCurrentFrame(Math.floor(timestamp))
    } else if (file.type === 'pdf') {
      // For PDF, timestamp represents page number
      setPdfPage(Math.floor(timestamp))
    }
  }

  // Annotation helper functions
  const handleStartAnnotating = () => {
    setIsAnnotating(true)
    setIsReadOnly(false)
    setAnnotationTool('pen')
    setAnnotationData([])
    setAnnotationHistory([[]]) // Initial empty state
    setAnnotationHistoryIndex(0)

    // Pause video when starting to annotate
    if (file.type === 'video' && customVideoPlayerRef.current) {
      customVideoPlayerRef.current.pause()
    }
  }

  // Memoize handleViewAnnotation
  const handleViewAnnotation = useCallback((dataStr: string, comment?: any) => {
    try {
      const parsed = JSON.parse(dataStr)
      let data = parsed
      let cameraState = null

      // Check for new data structure with metadata
      if (!Array.isArray(parsed) && parsed.konva) {
        data = parsed.konva
        cameraState = parsed.camera
      }

      setAnnotationData(data)
      setIsAnnotating(true)
      setIsReadOnly(true)
      if (comment) {
        setCurrentAnnotationCommentId(comment.id)

        // Jump to timeline if comment has timestamp (for video/sequence)
        if (comment.timestamp !== undefined && comment.timestamp !== null) {
          console.log('🎯 Jumping to timestamp:', comment.timestamp, 'for file type:', file.type)
          if (file.type === 'video') {
            // Use state to trigger video jump (this is more reliable)
            setCurrentTime(comment.timestamp)

            // Wait for video ref to be ready, then jump
            const jumpToTime = () => {
              if (customVideoPlayerRef.current) {
                console.log('📹 Setting video time to:', comment.timestamp)
                customVideoPlayerRef.current.seekTo(comment.timestamp)
                customVideoPlayerRef.current.pause()
              } else {
                console.warn('⚠️ customVideoPlayerRef.current is still null, retrying...')
                // Retry after a short delay
                setTimeout(jumpToTime, 100)
              }
            }

            // Try immediately, then with delays
            requestAnimationFrame(() => {
              setTimeout(jumpToTime, 50)
            })
          } else if (file.type === 'sequence') {
            console.log('🖼️ Setting frame to:', Math.floor(comment.timestamp))
            setCurrentFrame(Math.floor(comment.timestamp))
          } else if (file.type === 'pdf') {
            console.log('📄 Setting page to:', Math.floor(comment.timestamp))
            setPdfPage(Math.floor(comment.timestamp))
          }
        }
      } else {
        setCurrentAnnotationCommentId(null)
      }

      // Restore camera state for 3D models
      if (file.type === 'model' && cameraState && glbViewerRef.current) {
        // Small delay to ensure viewer is ready
        requestAnimationFrame(() => {
          glbViewerRef.current?.setCameraState(cameraState)
        })
      }
    } catch (e) {
      console.error('Failed to parse annotation data', e)
    }
  }, [file.type])

  const handleDoneAnnotating = () => {
    setIsAnnotating(false)

    // If read-only (viewing), clear data immediately
    if (isReadOnly) {
      setIsReadOnly(false)
      setAnnotationData(null)
      setCurrentAnnotationCommentId(null)
    }
    // If editing (creating), WE DO NOT CLEAR DATA HERE
    // This allows AddComment to access the data via state
    // The data will be cleared after successful submission or explicit cancel
  }

  const saveToHistory = (newData: AnnotationObject[]) => {
    const newHistory = annotationHistory.slice(0, annotationHistoryIndex + 1)
    newHistory.push(newData)
    // Limit history to 50 items
    if (newHistory.length > 50) {
      newHistory.shift()
    }
    setAnnotationHistory(newHistory)
    setAnnotationHistoryIndex(newHistory.length - 1)
  }

  const handleAnnotationChange = (newData: AnnotationObject[] | null) => {
    if (!newData) return
    setAnnotationData(newData)
    saveToHistory(newData)
  }

  const handleClearAnnotations = () => {
    if (confirm('Are you sure you want to clear all annotations?')) {
      const empty: AnnotationObject[] = []
      setAnnotationData(empty)
      saveToHistory(empty)
    }
  }

  const handleAnnotationUndo = () => {
    if (annotationHistoryIndex > 0) {
      const newIndex = annotationHistoryIndex - 1
      setAnnotationHistoryIndex(newIndex)
      setAnnotationData(annotationHistory[newIndex])
    }
  }

  const handleAnnotationRedo = () => {
    if (annotationHistoryIndex < annotationHistory.length - 1) {
      const newIndex = annotationHistoryIndex + 1
      setAnnotationHistoryIndex(newIndex)
      setAnnotationData(annotationHistory[newIndex])
    }
  }

  // 3D Model Settings Handlers
  const { user } = useAuthStore()
  const isUserAdmin = (user as any)?.role === 'admin' || isAdmin

  const handleSaveRenderSettings = async (settings: any) => {
    if (!file) return

    // Find version object if needed, but we pass version number to store
    await useFileStore.getState().updateModelSettings(
      file.projectId,
      file.id,
      currentVersion,
      settings
    )
  }

  // Handle Resize Logic
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta: moving left (negative delta) increases width
      // We're resizing the right sidebar, so dragging left = larger
      const delta = resizingState.current.startX - e.clientX
      const newWidth = Math.min(800, Math.max(280, resizingState.current.startWidth + delta))
      setCommentWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      // Remove overlay if it exists (prevents iframe/video capturing mouse)
      const overlay = document.getElementById('resize-overlay-guard')
      if (overlay) overlay.remove()
    }

    // Add overlay to ensure smooth dragging over iframes/videos
    if (!document.getElementById('resize-overlay-guard')) {
      const overlay = document.createElement('div')
      overlay.id = 'resize-overlay-guard'
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100vw'
      overlay.style.height = '100vh'
      overlay.style.zIndex = '9999'
      overlay.style.cursor = 'col-resize'
      document.body.appendChild(overlay)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      const overlay = document.getElementById('resize-overlay-guard')
      if (overlay) overlay.remove()
    }
  }, [isResizing])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizingState.current = {
      startX: e.clientX,
      startWidth: commentWidth
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }


  // Local caption state for real-time updates
  const [localFrameCaptions, setLocalFrameCaptions] = useState<Record<number, string> | undefined>()

  // Use local captions if available, otherwise fall back to current version captions
  const effectiveFrameCaptions = localFrameCaptions || current?.frameCaptions

  // Update local captions when file/version changes
  useEffect(() => {
    setLocalFrameCaptions(current?.frameCaptions)
  }, [current?.frameCaptions])

  // Handle caption changes with local state update
  const handleCaptionChangeWithLocalUpdate = async (fileId: string, version: number, frame: number, caption: string) => {
    // Update local state immediately for real-time display
    setLocalFrameCaptions(prev => ({
      ...prev,
      [frame]: caption
    }))
    // Call the original handler to save to database
    await onCaptionChange?.(fileId, version, frame, caption)
  }

  const renderAnnotationOverlay = () => {
    // Hide annotations in grid mode - they will be shown in the detail dialog instead
    if (!isAnnotating || sequenceViewMode === 'grid') return null
    return (
      <>
        <AnnotationCanvasKonva
          mode={isReadOnly ? 'read' : 'edit'}
          data={annotationData || []}
          tool={annotationTool}
          color={annotationColor}
          strokeWidth={annotationStrokeWidth}
          onChange={(data) => !isReadOnly && handleAnnotationChange(data)}
        />

      </>
    )
  }

  const renderFilePreview = () => {
    if (!effectiveUrl) {
      return (
        <div className="aspect-video bg-muted/20 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">📄</div>
            <div>Không thể tải file</div>
          </div>
        </div>
      )
    }

    // Check validation status
    if (current?.validationStatus === 'infected') {
      return (
        <div className="aspect-video bg-destructive/10 flex items-center justify-center p-6 h-full min-h-[50vh]">
          <div className="text-center max-w-md">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-bold text-destructive mb-2">FILE CÓ MÃ ĐỘC</h3>
            <p className="text-muted-foreground text-sm">
              Hệ thống phát hiện file này có chứa mã độc hoặc vi phạm chính sách bảo mật.
              Để đảm bảo an toàn, file này đã bị chặn và không thể xem.
            </p>
          </div>
        </div>
      )
    }


    // NOTE: 'pending' status no longer blocks viewing. Validation runs in background.
    // Only 'infected' and 'error' block the view.

    if (current?.validationStatus === 'error') {
      return (
        <div className="aspect-video bg-muted/20 flex items-center justify-center h-full min-h-[50vh]">
          <div className="text-center space-y-4 max-w-md p-6">
            <div className="relative w-16 h-16 mx-auto">
              <ShieldAlert className="w-16 h-16 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-medium text-lg text-yellow-600">Lỗi kiểm tra bảo mật</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Không thể hoàn tất quét virus cho file này.
                Để đảm bảo an toàn, vui lòng thử tải lại hoặc liên hệ quản trị viên.
              </p>
            </div>
          </div>
        </div>
      )
    }

    // Check if file is PDF (either by type or extension/mime)
    const isPdf = file.type === 'pdf' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      current?.metadata?.type === 'application/pdf'

    if (isPdf) {
      return (
        <div className="relative h-full min-h-[500px] w-full bg-muted/20">
          <PDFViewer
            url={effectiveUrl}
            currentPage={pdfPage}
            onPageChange={(page) => {
              setPdfPage(page)
              // Update currentFrame for comment filtering (using page as timestamp)
              setCurrentFrame(page)
            }}
            className="w-full h-full"
          >
            {renderAnnotationOverlay()}
          </PDFViewer>
        </div>
      )
    }

    if (file.type === 'image') {
      // Compare mode: show two images side-by-side with version selectors
      if (compareMode) {
        // determine defaults
        const sorted = uniqueVersions // Already sorted in useMemo
        const lv = leftVersion ?? currentVersion
        const rv = rightVersion ?? (sorted.find((v: any) => v.version !== lv)?.version ?? currentVersion)

        const findUrl = (vnum: number | null) => {
          if (!vnum) return undefined
          // Special handling for sequence frames
          if (sequenceContext) {
            const vv = uniqueVersions.find((v: any) => v.version === vnum)
            return vv?.sequenceUrls?.[sequenceContext.currentFrameIndex]
          }
          if (vnum === currentVersion && resolvedUrl) return resolvedUrl
          const vv = uniqueVersions.find((v: any) => v.version === vnum)
          return vv?.url
        }

        const leftUrl = findUrl(lv)
        const rightUrl = findUrl(rv)

        return (
          <div
            className="p-2 w-full h-full overflow-hidden relative"
            onMouseDown={(e) => {
              if (zoom > 1) {
                setIsDragging(true)
                setLastMousePos({ x: e.clientX, y: e.clientY })
                e.preventDefault()
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && zoom > 1) {
                const deltaX = (e.clientX - lastMousePos.x) / zoom
                const deltaY = (e.clientY - lastMousePos.y) / zoom
                setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
                setLastMousePos({ x: e.clientX, y: e.clientY })
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* Mode switch */}
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-muted-foreground mr-2">Chế độ:</div>
              <Button variant={compareDisplayMode === 'side-by-side' ? 'secondary' : 'outline'} size="sm" onClick={() => setCompareDisplayMode('side-by-side')}>
                <Columns className="w-4 h-4 mr-1" /> Side-by-side
              </Button>
              <Button variant={compareDisplayMode === 'slider' ? 'secondary' : 'outline'} size="sm" onClick={() => setCompareDisplayMode('slider')}>
                <Columns className="w-4 h-4 mr-1" /> Slider
              </Button>

              {/* Frame Counter in Toolbar */}
              {sequenceContext && (
                <div className="ml-auto bg-muted px-3 py-1.5 rounded-md text-sm font-mono border">
                  Frame {sequenceContext.currentFrameIndex + 1} / {sequenceContext.totalFrames}
                </div>
              )}
            </div>

            {compareDisplayMode === 'side-by-side' ? (
              <div className="flex gap-2">
                {/* Left column */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">So sánh - Bên trái</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">v{lv}<ChevronDown className="w-3 h-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {uniqueVersions
                          .map((v: any) => (
                            <DropdownMenuItem key={v.version} onClick={() => setLeftVersion(v.version)}>
                              v{v.version}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1 bg-muted/20 flex items-center justify-center overflow-hidden">
                    <div
                      className="w-full h-full flex items-center justify-center origin-center cursor-grab active:cursor-grabbing"
                      style={{
                        transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                        pointerEvents: zoom > 1 ? 'auto' : 'none'
                      }}
                    >
                      {leftUrl ? (
                        <img
                          src={leftUrl}
                          alt={`v${lv}`}
                          className="w-full h-full object-contain select-none shadow-none"
                          draggable={false}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">Không có ảnh</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">Bên phải</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">v{rv}<ChevronDown className="w-3 h-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {uniqueVersions
                          .map((v: any) => (
                            <DropdownMenuItem key={v.version} onClick={() => setRightVersion(v.version)}>
                              v{v.version}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1 bg-muted/20 flex items-center justify-center overflow-hidden">
                    <div
                      className="w-full h-full flex items-center justify-center origin-center cursor-grab active:cursor-grabbing"
                      style={{
                        transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                        pointerEvents: zoom > 1 ? 'auto' : 'none'
                      }}
                    >
                      {rightUrl ? (
                        <img
                          src={rightUrl}
                          alt={`v${rv}`}
                          className="w-full h-full object-contain select-none shadow-none"
                          draggable={false}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">Không có ảnh</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Slider overlay mode using react-compare-slider
              <div className="p-2">
                <div
                  className="max-h-[70vh] origin-center cursor-grab active:cursor-grabbing"
                  style={{
                    transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                    pointerEvents: zoom > 1 ? 'auto' : 'none'
                  }}
                >
                  {leftUrl && rightUrl ? (
                    <ReactCompareSlider
                      itemOne={<ReactCompareSliderImage src={leftUrl} alt={`v${lv}`} />}
                      itemTwo={<ReactCompareSliderImage src={rightUrl} alt={`v${rv}`} />}
                      position={comparePosition}
                      onPositionChange={(p: number) => setComparePosition(p)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[62vh] bg-muted/20">
                      <div className="text-sm text-muted-foreground">Không có ảnh để so sánh</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zoom Controls for Compare Mode */}
            <div className="absolute top-12 right-2 z-20 bg-background/80 backdrop-blur-sm border border-border/50 rounded-md shadow-sm flex items-center gap-1 p-1 pointer-events-auto">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                <span className="font-medium">-</span>
              </Button>
              <div className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                <span className="font-medium">+</span>
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }}>Reset</Button>
            </div>

            {/* Sequence Navigation Controls Overlay for Compare Mode */}
            {sequenceContext && (
              <>
                {/* Frame Counter moved to toolbar */}

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full z-10"
                  onClick={() => sequenceContext.onNavigateFrame?.(Math.max(0, sequenceContext.currentFrameIndex - 1))}
                  disabled={sequenceContext.currentFrameIndex === 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full z-10"
                  onClick={() => sequenceContext.onNavigateFrame?.(Math.min(sequenceContext.totalFrames - 1, sequenceContext.currentFrameIndex + 1))}
                  disabled={sequenceContext.currentFrameIndex === sequenceContext.totalFrames - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

          </div>
        )
      }

      return (
        <div className="relative bg-muted/20 w-full h-full flex items-center justify-center">
          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-md shadow-sm flex items-center gap-1 p-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              <span className="font-medium">-</span>
            </Button>
            <div className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              <span className="font-medium">+</span>
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }}>Reset</Button>
          </div>

          {/* Scaled content wrapper (image + annotations) */}
          <div
            className="origin-center cursor-grab active:cursor-grabbing w-full h-full flex items-center justify-center"
            ref={(el) => {
              if (!el) return
              const pe = (zoom > 1 || isAnnotating) ? 'auto' : 'none'
              el.style.pointerEvents = pe
              el.style.transform = `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`
            }}
            onMouseDown={(e) => {
              if (zoom > 1) {
                setIsDragging(true)
                setLastMousePos({ x: e.clientX, y: e.clientY })
                e.preventDefault()
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && zoom > 1) {
                const deltaX = (e.clientX - lastMousePos.x) / zoom
                const deltaY = (e.clientY - lastMousePos.y) / zoom
                setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
                setLastMousePos({ x: e.clientX, y: e.clientY })
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <img
              src={effectiveUrl}
              alt={file.name}
              className="w-full h-full object-contain"
            />

            {renderAnnotationOverlay()}
          </div>

          {/* Sequence Navigation Controls */}
          {sequenceContext && (
            <>
              {/* Frame Counter */}
              <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border border-border/50 px-3 py-1.5 rounded-md text-sm font-mono pointer-events-none z-10">
                Frame {sequenceContext.currentFrameIndex + 1} / {sequenceContext.totalFrames}
              </div>

              {/* Navigation Buttons */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full"
                onClick={() => sequenceContext.onNavigateFrame?.(Math.max(0, sequenceContext.currentFrameIndex - 1))}
                disabled={sequenceContext.currentFrameIndex === 0}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80 backdrop-blur-sm border border-border/50 rounded-full"
                onClick={() => sequenceContext.onNavigateFrame?.(Math.min(sequenceContext.totalFrames - 1, sequenceContext.currentFrameIndex + 1))}
                disabled={sequenceContext.currentFrameIndex === sequenceContext.totalFrames - 1}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )
          }

        </div >
      )
    }

    if (file.type === 'sequence') {
      const sequenceUrls = current?.sequenceUrls || []
      const fps = current?.metadata?.duration && current?.frameCount
        ? Math.round(current.frameCount / current.metadata.duration)
        : 24

      return (
        <div className="relative w-full h-full">
          <ImageSequenceViewer
            urls={sequenceUrls}
            fps={fps}
            currentFrame={currentFrame}
            onFrameChange={setCurrentFrame}
            className="w-auto h-auto max-w-full max-h-full mx-auto viewport"
            isAdmin={isAdmin}
            defaultViewMode={file.sequenceViewMode || 'video'}
            onViewModeChange={(mode) => {
              setSequenceViewMode(mode)
              onSequenceViewModeChange?.(file.id, mode)
            }}
            frameCaptions={effectiveFrameCaptions}
            onCaptionChange={handleCaptionChangeWithLocalUpdate}
            file={{ id: file.id, currentVersion: current.version }}
            // Annotation props
            isAnnotating={isAnnotating}
            annotationData={annotationData}
            annotationTool={annotationTool}
            annotationColor={annotationColor}
            annotationStrokeWidth={annotationStrokeWidth}
            isAnnotationReadOnly={isReadOnly}
            onAnnotationChange={handleAnnotationChange}
            onAnnotationUndo={handleAnnotationUndo}
            onAnnotationRedo={handleAnnotationRedo}
            onClearAnnotations={handleClearAnnotations}
            onDoneAnnotating={handleDoneAnnotating}
            canUndoAnnotation={annotationHistoryIndex > 0}
            canRedoAnnotation={annotationHistoryIndex < annotationHistory.length - 1}
            onStartAnnotating={(frame) => {
              setCurrentFrame(frame)
              setIsAnnotating(true)
              setIsReadOnly(false)
            }}
            onFrameDetailView={(frame) => {
              setFrameDetailView(frame)
            }}
            onReorderFrames={async (newOrder) => {
              await reorderSequenceFrames(file.projectId, file.id, current.version, newOrder)
            }}
            onDeleteFrames={async (indices) => {
              await deleteSequenceFrames(file.projectId, file.id, current.version, indices)
            }}
            onAddFrames={async (files) => {
              await addSequenceFrames(file.projectId, file.id, current.version, files)
            }}
            isUploading={uploading}
          />
        </div>
      )
    }

    if (file.type === 'video') {
      // Frame navigation handlers
      const handleNextFrame = () => {
        const frameDuration = 1 / videoFps
        const newTime = Math.min(videoDuration || Infinity, currentTime + frameDuration)
        setCurrentTime(newTime)
      }

      const handlePrevFrame = () => {
        const frameDuration = 1 / videoFps
        const newTime = Math.max(0, currentTime - frameDuration)
        setCurrentTime(newTime)
      }

      const handleSkipForward = () => {
        const newTime = Math.min(videoDuration || Infinity, currentTime + 5)
        setCurrentTime(newTime)
      }

      const handleSkipBackward = () => {
        const newTime = Math.max(0, currentTime - 5)
        setCurrentTime(newTime)
      }

      const handleCommentMarkerClick = (comment: any) => {
        // Jump to timestamp
        setCurrentTime(comment.timestamp || 0)

        // Show annotation if exists
        if (comment.annotationData) {
          handleViewAnnotation(comment.annotationData, comment)
        }
      }



      // Marker navigation handlers
      const sortedMarkers = allFileComments
        .filter(c => c.timestamp !== null && c.timestamp !== undefined)
        .sort((a, b) => a.timestamp! - b.timestamp!)

      const handleNextMarker = () => {
        const nextMarker = sortedMarkers.find(c => c.timestamp! > currentTime)
        if (nextMarker) {
          setCurrentTime(nextMarker.timestamp!)
        }
      }

      const handlePrevMarker = () => {
        const prevMarker = sortedMarkers.reverse().find(c => c.timestamp! < currentTime)
        if (prevMarker) {
          setCurrentTime(prevMarker.timestamp!)
        }
      }

      const handleFirstMarker = () => {
        if (sortedMarkers.length > 0) {
          setCurrentTime(sortedMarkers[0].timestamp!)
        }
      }

      const handleLastMarker = () => {
        if (sortedMarkers.length > 0) {
          setCurrentTime(sortedMarkers[sortedMarkers.length - 1].timestamp!)
        }
      }

      // VIDEO COMPARISON VIEW
      if (videoComparison.isComparing && videoComparison.secondaryUrl) {
        return (
          <div className="space-y-2 w-full h-full flex flex-col">
            {/* Comparison Videos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0 bg-black p-2">
              {/* PRIMARY VIDEO */}
              <div className="relative flex flex-col min-h-0">
                <div className="flex items-center justify-between px-2 py-1 bg-black/70">
                  <span className="text-xs text-white font-medium">v{currentVersion} (Chính)</span>
                  <Button
                    size="sm"
                    variant={videoComparison.activeAudio === 'primary' ? 'secondary' : 'ghost'}
                    className="h-6 px-2 text-xs"
                    onClick={videoComparison.toggleAudio}
                    title={videoComparison.activeAudio === 'primary' ? 'Đang phát âm thanh' : 'Bật âm thanh'}
                  >
                    {videoComparison.activeAudio === 'primary' ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  </Button>
                </div>
                <video
                  ref={videoComparison.primaryVideoRef}
                  src={effectiveUrl}
                  controls
                  className="w-full h-auto max-h-[45vh] object-contain flex-1"
                  onPlay={() => videoComparison.handlePrimaryEvent('play')}
                  onPause={() => videoComparison.handlePrimaryEvent('pause')}
                  onSeeked={(e) => videoComparison.handlePrimaryEvent('seeked', e.currentTarget.currentTime)}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime)
                    videoComparison.handlePrimaryEvent('timeupdate', e.currentTarget.currentTime)
                  }}
                  muted={videoComparison.activeAudio !== 'primary'}
                />
              </div>

              {/* SECONDARY VIDEO */}
              <div className="relative flex flex-col min-h-0">
                <div className="flex items-center justify-between px-2 py-1 bg-black/70">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                        v{videoComparison.secondaryVersion}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {uniqueVersions
                        .filter((v: any) => v.version !== currentVersion)
                        .map((v: any) => (
                          <DropdownMenuItem
                            key={v.version}
                            onClick={() => videoComparison.setSecondaryVersion(v.version)}
                            className={v.version === videoComparison.secondaryVersion ? 'bg-accent' : ''}
                          >
                            Version {v.version}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant={videoComparison.activeAudio === 'secondary' ? 'secondary' : 'ghost'}
                    className="h-6 px-2 text-xs"
                    onClick={videoComparison.toggleAudio}
                    title={videoComparison.activeAudio === 'secondary' ? 'Đang phát âm thanh' : 'Bật âm thanh'}
                  >
                    {videoComparison.activeAudio === 'secondary' ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  </Button>
                </div>
                <video
                  ref={videoComparison.secondaryVideoRef}
                  src={videoComparison.secondaryUrl}
                  controls
                  className="w-full h-auto max-h-[45vh] object-contain flex-1"
                  onPlay={() => videoComparison.handleSecondaryEvent('play')}
                  onPause={() => videoComparison.handleSecondaryEvent('pause')}
                  onSeeked={(e) => videoComparison.handleSecondaryEvent('seeked', e.currentTarget.currentTime)}
                  muted={videoComparison.activeAudio !== 'secondary'}
                />
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-2 sm:space-y-3 w-full h-full flex flex-col">
          {/* Video Player - Better space utilization */}
          <div className="relative bg-black flex-1 min-h-0 overflow-hidden">
            <CustomVideoPlayer
              ref={customVideoPlayerRef}
              src={effectiveUrl}
              comments={allFileComments}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onCommentMarkerClick={handleCommentMarkerClick}
              onFullscreenChange={handleFullscreenChange}
              onLoadedMetadata={handleLoadedMetadata}

              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              className="w-full h-full"
            />

            {/* Only show overlays when not playing to improve performance */}
            {!isPlaying && renderAnnotationOverlay()}
          </div>

          {/* Frame Controls + Filter/Comment Toggle on Mobile */}
          <div className="flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <VideoFrameControls
                  onNextFrame={handleNextFrame}
                  onPrevFrame={handlePrevFrame}
                  onSkipForward={handleSkipForward}
                  onSkipBackward={handleSkipBackward}
                  onNextMarker={handleNextMarker}
                  onPrevMarker={handlePrevMarker}
                  onFirstMarker={handleFirstMarker}
                  onLastMarker={handleLastMarker}
                  currentFps={videoFps}
                  mode={navMode}
                  onModeChange={setNavMode}
                />
              </div>

              {/* Mobile: Filter Toggle + Mode Toggle */}
              <div className="flex sm:hidden gap-1">
                <Button
                  id="mobile-nav-toggle"
                  variant={navMode === 'marker' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setNavMode(navMode === 'frame' ? 'marker' : 'frame')}
                  className="h-8 px-2"
                  title={navMode === 'frame' ? 'Chuyển sang Marker Navigation' : 'Chuyển sang Frame Navigation'}
                >
                  {navMode === 'frame' ? 'F' : 'M'}
                </Button>
                <Button
                  variant={showOnlyCurrentTimeComments ? 'secondary' : 'outline'}
                  size="sm"
                  id="mobile-filter-toggle"
                  onClick={() => setShowOnlyCurrentTimeComments(!showOnlyCurrentTimeComments)}
                  className="h-8 px-2"
                  title="Lọc theo thời gian"
                >
                  <Filter className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (file.type === 'model') {
      return (
        <div className="relative h-[50vh] sm:h-[75vh] xl:h-[70vh] 2xl:h-[65vh] w-full max-w-full bg-muted/20">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading 3D Viewer...</div>}>
            <GLBViewer
              ref={glbViewerRef}
              url={effectiveUrl}
              className="w-full h-full"
              initialCameraState={current?.cameraState}
              showMobileToolbar={true}
              isAdmin={isUserAdmin}
              initialRenderSettings={current?.renderSettings}
              onSaveSettings={handleSaveRenderSettings}
            />
          </Suspense>
          {renderAnnotationOverlay()}

          {/* Set as Thumbnail Button - Admin Only */}
          {isAdmin && (
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const cameraState = glbViewerRef.current?.getCameraState()
                  const screenshot = glbViewerRef.current?.captureScreenshot()
                  if (cameraState && screenshot) {
                    setSavingThumbnail(true)
                    try {
                      await useFileStore.getState().setModelThumbnail(_projectId, file.id, currentVersion, screenshot, cameraState)
                    } catch (error) {
                      // Error handled in store
                    } finally {
                      setSavingThumbnail(false)
                    }
                  } else {
                    toast.error('Không thể capture thumbnail')
                  }
                }}
                disabled={savingThumbnail}
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                {savingThumbnail ? 'Đang lưu...' : 'Set as Thumbnail'}
              </Button>
            </div>
          )}
        </div>
      )
    }



    return (
      <div className="flex items-center justify-center h-[50vh] bg-muted/20">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-2">📄</div>
          <div>Không có bản xem trước cho loại tệp này</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Layout - Fullscreen Toggle View */}
      {isMobile && open && createPortal(
        <MobileFileViewLayout
          file={file}
          current={current}
          effectiveUrl={effectiveUrl}
          renderFilePreview={renderFilePreview}
          comments={fileComments}
          currentUserName={currentUserName}
          onUserNameChange={onUserNameChange}
          onAddComment={async (userName, content, timestamp, parentCommentId, annotationDataStr, attachments) => {
            // Handle annotation data serialization with camera state for 3D
            const hasData = annotationData && annotationData.length > 0
            const dataToSave = hasData && !isReadOnly ? JSON.stringify({
              konva: annotationData,
              camera: glbViewerRef.current?.getCameraState()
            }) : annotationDataStr

            await onAddComment(userName, content, timestamp, parentCommentId, dataToSave, attachments)

            // Clear annotation after successful submit
            if (hasData && !isReadOnly) {
              setAnnotationData(null)
              setIsAnnotating(false)
            }
          }}
          onResolveToggle={onResolveToggle}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          onTimestampClick={handleTimestampClick}
          onViewAnnotation={handleViewAnnotation}
          isAdmin={isAdmin}
          isLocked={file.isCommentsLocked || project?.isCommentsLocked || isArchived}
          viewAllVersions={viewAllVersions}
          onViewAllVersionsChange={setViewAllVersions}
          currentTimestamp={file.type === 'video' ? currentTime : (file.type === 'sequence' ? currentFrame : undefined)}
          showTimestamp={file.type === 'video' || file.type === 'sequence'}
          // Annotation props
          isAnnotating={isAnnotating}
          isReadOnly={isReadOnly}
          annotationData={annotationData}
          annotationTool={annotationTool}
          annotationColor={annotationColor}
          annotationStrokeWidth={annotationStrokeWidth}
          onAnnotationClick={handleStartAnnotating}
          onAnnotationToolChange={setAnnotationTool}
          onAnnotationColorChange={setAnnotationColor}
          onAnnotationStrokeWidthChange={setAnnotationStrokeWidth}
          onAnnotationUndo={handleAnnotationUndo}
          onAnnotationRedo={handleAnnotationRedo}
          onAnnotationClear={handleClearAnnotations}
          onAnnotationDone={handleDoneAnnotating}
          canUndoAnnotation={annotationHistoryIndex > 0}
          canRedoAnnotation={annotationHistoryIndex < annotationHistory.length - 1}
          // Actions
          onClose={() => onOpenChange(false)}
          onDownload={handleDownload}
          onShare={copyShareLink}
          uniqueVersions={uniqueVersions}
          currentVersion={currentVersion}
          onSwitchVersion={onSwitchVersion}
        />,
        document.body
      )}

      {/* Desktop Layout - Original Dialog */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-[100vw] sm:max-w-[98vw] w-full h-[100vh] sm:h-[98vh] xl:h-[95vh] 2xl:h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden outline-none"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0 flex flex-row items-center justify-between space-y-0 group">
              {/* LEFT: File Info */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-4">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                  {getFileTypeIcon(file.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate">
                    {isRenaming ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-8 text-lg font-semibold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renameValue.trim() && onRenameFile) {
                                onRenameFile(file.id, renameValue.trim())
                                setIsRenaming(false)
                              }
                            } else if (e.key === 'Escape') {
                              setIsRenaming(false)
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            if (renameValue.trim() && onRenameFile) {
                              onRenameFile(file.id, renameValue.trim())
                              setIsRenaming(false)
                            }
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setIsRenaming(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{file.name}</span>
                        {isAdmin && onRenameFile && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setRenameValue(file.name)
                              setIsRenaming(true)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}

                    {/* Version dropdown inline with title */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="header-version-dropdown"
                          variant="outline"
                          size="sm"
                          className="gap-1 px-2 min-w-[3.5rem] ml-2"
                          title="Lịch sử phiên bản"
                        >
                          <span className="font-medium text-xs">v{currentVersion}</span>
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80">
                        <div className="p-2 border-b mb-1">
                          <div className="font-semibold text-sm">Lịch sử phiên bản</div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {uniqueVersions
                            .map((version: any) => (
                              <DropdownMenuItem
                                key={version.version}
                                className="flex items-center justify-between p-3 cursor-pointer"
                                onClick={() => {
                                  setCurrentVersion(version.version)
                                  onSwitchVersion?.(file.id, version.version)
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${version.version === currentVersion
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                    }`}>
                                    v{version.version}
                                  </div>
                                  <div>
                                    <div className="font-medium">
                                      {version.version === currentVersion ? 'Phiên bản hiện tại' : `Phiên bản ${version.version}`}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(version.uploadedAt?.toDate ? version.uploadedAt.toDate() : new Date(), 'dd/MM/yyyy HH:mm')}
                                    </div>
                                  </div>
                                </div>
                                {isAdmin && file.versions.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm(`Xóa phiên bản ${version.version}?`)) {
                                        deleteVersion(_projectId, file.id, version.version)
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </DropdownMenuItem>
                            ))}
                        </div>

                        {onUploadNewVersion && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <div className="p-2">
                              <DropdownMenuItem
                                className="w-full justify-start cursor-pointer"
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setShowUploadDialog(true)
                                }}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Tải lên phiên bản mới
                              </DropdownMenuItem>
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </DialogTitle>
                  <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    <span>{getFileTypeLabel(file.type)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{formatFileSize(current.metadata.size)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(uploadDate, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: Actions Toolbar */}
              <div className="flex items-center gap-1 sm:gap-2">

                {/* LEFT SIDE: Tour | Share | Download | Comments */}
                {/* Tour Button - Desktop */}
                <Button
                  id="header-tour-btn"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 px-0 hidden sm:flex"
                  onClick={handleStartTour}
                  title="Hướng dẫn sử dụng"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="sr-only">Hướng dẫn</span>
                </Button>

                {/* Video Compare Button - Desktop */}
                {file.type === 'video' && file.versions.length > 1 && (
                  <Button
                    id="header-video-compare-btn"
                    variant={videoComparison.isComparing ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 w-9 px-0 hidden sm:flex"
                    onClick={videoComparison.toggleCompare}
                    title={videoComparison.isComparing ? 'Tắt so sánh' : 'So sánh phiên bản'}
                  >
                    <Columns className="w-4 h-4" />
                    <span className="sr-only">So sánh phiên bản</span>
                  </Button>
                )}

                {/* Share & Download Group */}
                <div id="header-share-download-group" className="flex items-center gap-1">
                  {/* Share Button (Icon-only) */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="header-share-btn"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 px-0 hidden sm:flex"
                        title="Chia sẻ"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="sr-only">Chia sẻ</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm">Chia sẻ file</h4>
                          <p className="text-xs text-muted-foreground">
                            Bất kỳ ai có link đều có thể xem file này
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={getShareLink()}
                            className="text-xs h-8"
                          />
                          <Button size="sm" className="h-8 px-2" onClick={copyShareLink}>
                            {copied ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Mobile Share Button (Icon only) */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 px-0 sm:hidden"
                        title="Chia sẻ"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm">Chia sẻ file</h4>
                          <p className="text-xs text-muted-foreground">
                            Bất kỳ ai có link đều có thể xem file này
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={getShareLink()}
                            className="text-xs h-8"
                          />
                          <Button size="sm" className="h-8 px-2" onClick={copyShareLink}>
                            {copied ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Download Button */}
                  <Button
                    id="header-download-btn"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 px-0"
                    asChild
                    title="Tải xuống"
                  >
                    <a
                      href={effectiveUrl}
                      download={ensureFileExtension(file.name, effectiveUrl, current?.metadata?.type, file.type)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4" />
                      <span className="sr-only">Tải xuống</span>
                    </a>
                  </Button>
                </div>

                {/* Comments Toggle */}
                <Button
                  id="header-comments-toggle"
                  variant={showComments ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowComments(!showComments)}
                  className="h-9 w-9 px-0 hidden sm:flex"
                  title={showComments ? 'Ẩn bình luận' : 'Hiện bình luận'}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="sr-only">Bình luận</span>
                </Button>

                <div className="flex-1" />

                {/* RIGHT SIDE: Compare (images) + Close */}
                {/* Compare Button (Images only) - before close */}
                {file.type === 'image' && file.versions.length > 1 && (
                  <Button
                    id="header-compare-btn"
                    variant={compareMode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 w-9 px-0"
                    onClick={() => setCompareMode(!compareMode)}
                    title="So sánh phiên bản"
                  >
                    <Columns className="w-4 h-4" />
                    <span className="sr-only">So sánh</span>
                  </Button>
                )}

                <div className="w-px h-6 bg-border/50 mx-1" />

                {/* Close Button */}
                <Button
                  id="header-close-btn"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 px-0 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onOpenChange(false)}
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                  <span className="sr-only">Đóng</span>
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
              {/* Main Content Area */}
              <div className={`flex-1 overflow-y-auto overflow-x-hidden bg-background/50 flex flex-col ${showComments && !isVideoFullscreen ? '' : ''}`}>
                {/* Toolbar for Annotation */}
                <div id="annotation-toolbar" className="p-2 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 gap-2">
                  <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto">
                    {!isAnnotating ? (
                      <Button onClick={handleStartAnnotating} variant="outline" size="sm" className="gap-2 flex-1 sm:flex-initial">
                        <div className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-600" />
                        Thêm ghi chú
                      </Button>
                    ) : isReadOnly ? (
                      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                        <div className="text-sm font-medium text-muted-foreground">
                          Đang xem ghi chú
                        </div>
                        <Button onClick={handleDoneAnnotating} variant="ghost" size="sm" className="h-7 px-2 hover:bg-destructive/10 hover:text-destructive">
                          Đóng
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-muted-foreground animate-pulse">
                        Đang vẽ ghi chú...
                      </div>
                    )}
                  </div>

                  {/* Filter Toggle - Desktop only */}
                  {(file.type === 'video' || file.type === 'sequence') && (
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        variant={showOnlyCurrentTimeComments ? 'secondary' : 'ghost'}
                        size="sm"
                        id="filter-time-toggle"
                        onClick={() => setShowOnlyCurrentTimeComments(!showOnlyCurrentTimeComments)}
                        className={`${showOnlyCurrentTimeComments ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                        title="Chỉ hiện bình luận tại thời điểm này"
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        {showOnlyCurrentTimeComments ? 'Đang lọc theo thời gian' : 'Lọc theo thời gian'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* File Preview */}
                <div id="preview-container" className="flex-1 p-0 sm:p-2 flex items-center justify-center min-h-0 overflow-x-hidden overflow-y-visible sm:overflow-hidden">
                  {renderFilePreview()}
                </div>
              </div>

              {showComments && !isVideoFullscreen && (
                <div className="contents">
                  {/* Resize Handle */}
                  <div
                    id="comments-resize-handle"
                    className="hidden sm:flex w-4 -mr-2 -ml-2 z-20 cursor-col-resize items-center justify-center hover:bg-accent/50 active:bg-accent transition-colors flex-shrink-0 relative group"
                    onMouseDown={handleResizeStart}
                  >
                    {/* Visual Indicator */}
                    <div className="w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
                  </div>

                  <div
                    id="comments-sidebar"
                    className="w-full sm:w-[var(--comment-width)] flex-shrink-0 flex flex-col bg-background border-t sm:border-t-0 sm:border-l h-[38vh] sm:h-auto sm:max-h-none transition-[width] duration-0"
                    ref={(el) => {
                      if (!el) return
                      el.style.setProperty('--comment-width', `${commentWidth}px`)
                    }}
                  >
                    <div className="p-3 border-b flex items-center justify-between bg-muted/10">
                      <div className="text-sm font-medium">Bình luận</div>
                      <Button
                        id="comments-version-toggle"
                        variant="outline"
                        size="sm"
                        onClick={() => setViewAllVersions(!viewAllVersions)}
                        className={`h-7 px-2 text-xs gap-1.5 transition-all ${viewAllVersions
                          ? 'bg-primary/10 text-primary border-primary/50 hover:bg-primary/20'
                          : 'text-muted-foreground hover:text-foreground border-dashed hover:border-solid'
                          }`}
                        title={viewAllVersions ? 'Đang hiện tất cả bình luận' : 'Chỉ hiện bình luận phiên bản này'}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{viewAllVersions ? 'Tất cả bình luận' : 'Phiên bản hiện tại'}</span>
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
                      <CommentsList
                        comments={fileComments}
                        currentUserName={currentUserName}
                        onResolveToggle={onResolveToggle}
                        onTimestampClick={handleTimestampClick}
                        onViewAnnotation={(data, comment) => handleViewAnnotation(data, comment)}
                        onReply={async (parentCommentId, userName, content) => {
                          await onAddComment(userName, content, undefined, parentCommentId)
                        }}
                        isSequence={file.type === 'sequence'}
                        isAdmin={isAdmin}
                        onEdit={onEditComment}
                        onDelete={onDeleteComment}
                        isLocked={file.isCommentsLocked || project?.isCommentsLocked || isArchived}
                        showVersionBadge={viewAllVersions}
                      />
                      {fileComments.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          Chưa có bình luận nào
                          {showOnlyCurrentTimeComments && <div className="text-xs mt-1">(Đang lọc theo thời gian hiện tại)</div>}
                          {viewAllVersions && <div className="text-xs mt-1">(Đã bật xem tất cả phiên bản)</div>}
                        </div>
                      )}
                    </div>

                    {/* Desktop: Always show comment input */}
                    <div className="hidden sm:block p-4 border-t bg-background flex-shrink-0">
                      {(file.isCommentsLocked || project?.isCommentsLocked || isArchived) ? (
                        <div className="text-center text-muted-foreground py-4 px-2 bg-muted/30 rounded-md">
                          <div className="flex items-center justify-center gap-2 text-sm">
                            <span>🔒</span>
                            <span>
                              {isArchived
                                ? 'Dự án đã được lưu trữ. Không thể bình luận.'
                                : 'Tính năng bình luận đang tạm khóa.'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <AddComment
                          onSubmit={async (userName, content, timestamp, parentCommentId, _ignoredAnnotationData, attachments) => {
                            const hasData = annotationData && annotationData.length > 0
                            const dataToSave = hasData && !isReadOnly ? JSON.stringify({
                              konva: annotationData,
                              camera: glbViewerRef.current?.getCameraState()
                            }) : null

                            await onAddComment(userName, content, timestamp, parentCommentId, dataToSave, attachments)

                            if (dataToSave) {
                              setAnnotationData(null)
                              setIsAnnotating(false)
                            }
                          }}
                          userName={currentUserName}
                          onUserNameChange={onUserNameChange}
                          currentTimestamp={file.type === 'video' ? currentTime : (file.type === 'sequence' ? currentFrame : undefined)}
                          showTimestamp={file.type === 'video' || file.type === 'sequence'}
                          annotationData={!isReadOnly ? annotationData : null}
                          onAnnotationClick={handleStartAnnotating}
                        />
                      )}
                    </div>

                    {/* Mobile: Comment Input (Always visible now, no toggle) */}
                    <div id="mobile-add-comment" className="sm:hidden border-t bg-background flex-shrink-0 p-2">
                      {(file.isCommentsLocked || project?.isCommentsLocked || isArchived) ? (
                        <div className="text-center text-muted-foreground py-3 px-2 bg-muted/30 rounded-md">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span>🔒</span>
                            <span>
                              {isArchived
                                ? 'Dự án đã lưu trữ. Không thể bình luận.'
                                : 'Bình luận đang tạm khóa.'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <AddComment
                          isMobile={true}
                          onSubmit={async (userName, content, timestamp, parentCommentId, _ignoredAnnotationData, attachments) => {
                            const hasData = annotationData && annotationData.length > 0
                            const dataToSave = hasData && !isReadOnly ? JSON.stringify({
                              konva: annotationData,
                              camera: glbViewerRef.current?.getCameraState()
                            }) : null

                            await onAddComment(userName, content, timestamp, parentCommentId, dataToSave, attachments)

                            if (dataToSave) {
                              setAnnotationData(null)
                              setIsAnnotating(false)
                            }
                          }}
                          userName={currentUserName}
                          onUserNameChange={onUserNameChange}
                          currentTimestamp={file.type === 'video' ? currentTime : (file.type === 'sequence' ? currentFrame : undefined)}
                          showTimestamp={file.type === 'video' || file.type === 'sequence'}
                          annotationData={!isReadOnly ? annotationData : null}
                          onAnnotationClick={handleStartAnnotating}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comments Sidebar - Fullscreen Mode (Absolutely Positioned) */}
              {showComments && isVideoFullscreen && (
                <div
                  className="fixed top-0 right-0 left-[75vw] w-[25vw] h-screen flex flex-col bg-background border-l border-border z-50"
                >
                  <div className="p-3 border-b flex items-center justify-between bg-muted/10">
                    <div className="text-sm font-medium">Bình luận</div>
                    <Button
                      variant={viewAllVersions ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewAllVersions(!viewAllVersions)}
                      className={`h-7 px-2 text-xs gap-1.5 ${viewAllVersions ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground'}`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Tất cả phiên bản</span>
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <CommentsList
                      comments={fileComments}
                      currentUserName={currentUserName}
                      onResolveToggle={onResolveToggle}
                      onTimestampClick={handleTimestampClick}
                      onViewAnnotation={(data, comment) => handleViewAnnotation(data, comment)}
                      onReply={async (parentCommentId, userName, content) => {
                        await onAddComment(userName, content, undefined, parentCommentId)
                      }}
                      isSequence={file.type === 'sequence'}
                      isAdmin={isAdmin}
                      onEdit={onEditComment}
                      onDelete={onDeleteComment}
                      isLocked={file.isCommentsLocked || project?.isCommentsLocked || isArchived}
                      showVersionBadge={viewAllVersions}
                    />
                    {fileComments.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        Chưa có bình luận nào
                        {showOnlyCurrentTimeComments && <div className="text-xs mt-1">(Đang lọc theo thời gian hiện tại)</div>}
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t bg-background">
                    {(file.isCommentsLocked || project?.isCommentsLocked || isArchived) ? (
                      <div className="text-center text-muted-foreground py-4 px-2 bg-muted/30 rounded-md">
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <span>🔒</span>
                          <span>
                            {isArchived
                              ? 'Dự án đã lưu trữ. Không thể bình luận.'
                              : 'Tính năng bình luận đang tạm khóa.'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <AddComment
                        onSubmit={async (userName, content, timestamp, parentCommentId, _ignoredAnnotationData) => {
                          const hasData = annotationData && annotationData.length > 0
                          const dataToSave = hasData && !isReadOnly ? JSON.stringify({
                            konva: annotationData,
                            camera: glbViewerRef.current?.getCameraState()
                          }) : null

                          await onAddComment(userName, content, timestamp, parentCommentId, dataToSave)

                          if (dataToSave) {
                            setAnnotationData(null)
                            setIsAnnotating(false)
                          }
                        }}
                        userName={currentUserName}
                        onUserNameChange={onUserNameChange}
                        currentTimestamp={file.type === 'video' ? currentTime : (file.type === 'sequence' ? currentFrame : undefined)}
                        showTimestamp={file.type === 'video' || file.type === 'sequence'}
                        annotationData={!isReadOnly ? annotationData : null}
                        onAnnotationClick={handleStartAnnotating}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            {isAnnotating && !isReadOnly && (
              <AnnotationToolbar
                tool={annotationTool}
                onToolChange={setAnnotationTool}
                color={annotationColor}
                onColorChange={setAnnotationColor}
                strokeWidth={annotationStrokeWidth}
                onStrokeWidthChange={setAnnotationStrokeWidth}
                onUndo={handleAnnotationUndo}
                onRedo={handleAnnotationRedo}
                onClear={handleClearAnnotations}
                onDone={handleDoneAnnotating}
                canUndo={annotationHistoryIndex > 0}
                canRedo={annotationHistoryIndex < annotationHistory.length - 1}
              />
            )}
          </DialogContent>
        </Dialog >
      )}

      {/* Frame Detail Dialog - For viewing individual frames from sequence grid */}
      {
        file?.type === 'sequence' && frameDetailView !== null && (() => {
          const sequenceUrls = current?.sequenceUrls || []
          const frameCaptions = current?.frameCaptions || {}

          return (
            <FileViewDialogShared
              file={{
                ...file,
                type: 'image',
                name: `${file.name} - Frame ${frameDetailView + 1}`
              }}
              projectId={_projectId}
              resolvedUrl={sequenceUrls[frameDetailView]}
              open={frameDetailView !== null}
              onOpenChange={(open) => !open && setFrameDetailView(null)}
              comments={allFileComments.filter(c => c.timestamp === frameDetailView)}
              currentUserName={currentUserName}
              onUserNameChange={onUserNameChange}
              onAddComment={async (userName, content, _timestamp, parentCommentId, annotationData, attachments) => {
                await onAddComment(userName, content, frameDetailView, parentCommentId, annotationData, attachments)
              }}
              onResolveToggle={onResolveToggle}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              isAdmin={isAdmin}
              onCaptionChange={onCaptionChange ? async (fileId, version, _frame, caption) => {
                await onCaptionChange(fileId, version, frameDetailView, caption)
              } : undefined}
              sequenceContext={{
                totalFrames: sequenceUrls.length,
                currentFrameIndex: frameDetailView,
                frameCaptions: frameCaptions,
                onNavigateFrame: (newIndex) => {
                  setFrameDetailView(newIndex)
                }
              }}
            />
          )
        })()
      }
      {/* Upload Dialog for New Version */}
      <UploadDialog
        projectId={_projectId}
        existingFileId={file.id}
        existingFileType={file.type}
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        initialFiles={droppedFiles}
        trigger={<span className="hidden" />}
      />

      {/* Drag & Drop Overlay */}
      {
        isDragOver && (
          <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-primary border-dashed rounded-lg m-4 pointer-events-none">
            <div className="bg-primary/10 p-8 rounded-full mb-6 animate-bounce">
              <Upload className="w-16 h-16 text-primary" />
            </div>
            <h3 className="text-3xl font-bold text-primary mb-2">
              Thả file để cập nhật phiên bản mới
            </h3>
            <p className="text-lg text-muted-foreground">
              Phiên bản mới sẽ được thêm vào lịch sử phiên bản của file này
            </p>
          </div>
        )
      }
    </>
  )
}
