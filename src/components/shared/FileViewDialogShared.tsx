import { useState, useRef, lazy, Suspense, useEffect, useCallback, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
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
  MoreHorizontal,
  Camera,
  Pencil,
  Check,
  FileText
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import toast from 'react-hot-toast'

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
  onRenameFile
}: Props) {
  const [showComments, setShowComments] = useState(true)
  const [showOnlyCurrentTimeComments, setShowOnlyCurrentTimeComments] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [videoFps, setVideoFps] = useState(30)
  const [videoDuration, setVideoDuration] = useState(0)
  const [currentAnnotationCommentId, setCurrentAnnotationCommentId] = useState<string | null>(null)

  const customVideoPlayerRef = useRef<CustomVideoPlayerRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const glbViewerRef = useRef<GLBViewerRef>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [leftVersion, setLeftVersion] = useState<number | null>(null)
  const [rightVersion, setRightVersion] = useState<number | null>(null)
  const [savingThumbnail, setSavingThumbnail] = useState(false)
  const [compareDisplayMode, setCompareDisplayMode] = useState<'side-by-side' | 'slider'>('side-by-side')
  const [comparePosition, setComparePosition] = useState<number>(50) // percent 0-100 for slider
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

  // File store for sequence frame operations
  const { reorderSequenceFrames, deleteSequenceFrames } = useFileStore()

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
      // Reset video time when switching versions
      // Reset video time when switching versions
      if (customVideoPlayerRef.current) {
        customVideoPlayerRef.current.seekTo(0)
      }
    }
  }, [file?.currentVersion, file?.id])

  if (!file) return null

  const current = file.versions.find(v => v.version === currentVersion) || file.versions[0]
  const effectiveUrl = resolvedUrl || current?.url
  const uploadDate = current?.uploadedAt?.toDate ? current.uploadedAt.toDate() : new Date()

  // Memoize allFileComments to prevent CustomVideoPlayer re-renders
  const allFileComments = useMemo(
    () => comments.filter(c => c.fileId === file.id && c.version === currentVersion),
    [comments, file.id, currentVersion]
  )

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

  // Image zoom level (applies to image + annotations)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

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
        {!isReadOnly && (
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
        const sorted = [...file.versions].sort((a, b) => b.version - a.version)
        const lv = leftVersion ?? currentVersion
        const rv = rightVersion ?? (sorted.find(v => v.version !== lv)?.version ?? currentVersion)

        const findUrl = (vnum: number | null) => {
          if (!vnum) return undefined
          if (vnum === currentVersion && resolvedUrl) return resolvedUrl
          const vv = file.versions.find(v => v.version === vnum)
          return vv?.url
        }

        const leftUrl = findUrl(lv)
        const rightUrl = findUrl(rv)

        return (
          <div className="p-2 max-h-[70vh] overflow-auto">
            {/* Mode switch */}
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-muted-foreground mr-2">Chế độ:</div>
              <Button variant={compareDisplayMode === 'side-by-side' ? 'secondary' : 'outline'} size="sm" onClick={() => setCompareDisplayMode('side-by-side')}>
                <Columns className="w-4 h-4 mr-1" /> Side-by-side
              </Button>
              <Button variant={compareDisplayMode === 'slider' ? 'secondary' : 'outline'} size="sm" onClick={() => setCompareDisplayMode('slider')}>
                <Columns className="w-4 h-4 mr-1" /> Slider
              </Button>
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
                        {file.versions
                          .sort((a, b) => b.version - a.version)
                          .map(v => (
                            <DropdownMenuItem key={v.version} onClick={() => setLeftVersion(v.version)}>
                              v{v.version}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1 bg-muted/20 flex items-center justify-center">
                    {leftUrl ? (
                      <img src={leftUrl} alt={`v${lv}`} className="w-full h-auto max-h-[62vh] object-contain" />
                    ) : (
                      <div className="text-sm text-muted-foreground">Không có ảnh</div>
                    )}
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
                        {file.versions
                          .sort((a, b) => b.version - a.version)
                          .map(v => (
                            <DropdownMenuItem key={v.version} onClick={() => setRightVersion(v.version)}>
                              v{v.version}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex-1 bg-muted/20 flex items-center justify-center">
                    {rightUrl ? (
                      <img src={rightUrl} alt={`v${rv}`} className="w-full h-auto max-h-[62vh] object-contain" />
                    ) : (
                      <div className="text-sm text-muted-foreground">Không có ảnh</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Slider overlay mode using react-compare-slider
              <div className="p-2">
                <div className="max-h-[70vh]">
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
            className="origin-center cursor-grab active:cursor-grabbing"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
              pointerEvents: zoom > 1 ? 'auto' : 'none'
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
              className="w-auto h-auto max-w-full max-h-full object-contain"
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

      const handleExportFrame = (dataUrl: string, timestamp: number) => {
        // Download the image
        const link = document.createElement('a')
        const formattedTime = `${Math.floor(timestamp / 60)}-${Math.floor(timestamp % 60).toString().padStart(2, '0')}`
        link.download = `${file.name.replace(/\.[^/.]+$/, '')}-frame-${formattedTime}.png`
        link.href = dataUrl
        link.click()
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

      return (
        <div className="space-y-2 sm:space-y-3 w-full h-full flex flex-col">
          {/* Video Player - Fixed height on mobile */}
          <div className="relative bg-black flex-shrink-0 h-[40vh] sm:h-auto sm:flex-1 sm:min-h-0 sm:max-h-[calc(100vh-12rem)] 2xl:max-h-[calc(100vh-15rem)]">
            <CustomVideoPlayer
              ref={customVideoPlayerRef}
              src={effectiveUrl}
              comments={allFileComments}
              currentTime={currentTime}
              onTimeUpdate={handleTimeUpdate}
              onCommentMarkerClick={handleCommentMarkerClick}
              onFullscreenChange={handleFullscreenChange}
              onLoadedMetadata={handleLoadedMetadata}
              onExportFrame={handleExportFrame}
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
        <div className="relative h-[75vh] xl:h-[70vh] 2xl:h-[65vh] w-full bg-muted/20">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading 3D Viewer...</div>}>
            <GLBViewer
              ref={glbViewerRef}
              url={effectiveUrl}
              className="w-full h-full"
              initialCameraState={current?.cameraState}
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[100vw] sm:max-w-[98vw] w-full h-[100vh] sm:h-[98vh] xl:h-[95vh] 2xl:h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
          <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0 flex flex-row items-center justify-between space-y-0 group">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
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
                          className="h-6 w-6 shrink-0"
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
                  <Badge variant="outline" className="text-xs font-normal shrink-0">
                    v{currentVersion}
                  </Badge>
                </DialogTitle>
                <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-1">
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

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Version Selector - Hidden on mobile, available in menu */}
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Clock className="w-4 h-4" />
                      <span className="hidden md:inline">Lịch sử phiên bản</span>
                      <span className="md:hidden">Lịch sử</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    {file.versions
                      .sort((a, b) => b.version - a.version)
                      .map((version) => (
                        <DropdownMenuItem
                          key={version.version}
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() => onSwitchVersion?.(file.id, version.version)}
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
                        </DropdownMenuItem>
                      ))}

                    {onUploadNewVersion && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <div className="p-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            aria-label="Upload new version"
                            onChange={(e) => {
                              const uploadedFile = e.target.files?.[0]
                              if (uploadedFile && onUploadNewVersion) {
                                onUploadNewVersion(uploadedFile, file.id)
                              }
                            }}
                          />
                          <Button
                            className="w-full justify-start"
                            variant="ghost"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Tải lên phiên bản mới
                          </Button>
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile: Dropdown Menu with all actions */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                      Lịch sử phiên bản
                    </div>
                    {file.versions
                      .sort((a, b) => b.version - a.version)
                      .slice(0, 3) // Show only last 3 versions on mobile
                      .map((version) => (
                        <DropdownMenuItem
                          key={version.version}
                          className="flex items-center justify-between p-2 cursor-pointer"
                          onClick={() => onSwitchVersion?.(file.id, version.version)}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${version.version === currentVersion
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                              }`}>
                              v{version.version}
                            </div>
                            <span className="text-sm">
                              {version.version === currentVersion ? 'Hiện tại' : `Phiên bản ${version.version}`}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}

                    {file.versions.length > 3 && (
                      <DropdownMenuItem className="text-xs text-muted-foreground">
                        ... và {file.versions.length - 3} phiên bản khác
                      </DropdownMenuItem>
                    )}

                    <div className="h-px bg-border my-1" />

                    {file.type === 'image' && file.versions.length > 1 && (
                      <DropdownMenuItem onClick={() => setCompareMode(!compareMode)}>
                        <Columns className="w-4 h-4 mr-2" />
                        {compareMode ? 'Thoát so sánh' : 'So sánh phiên bản'}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem asChild>
                      <a href={effectiveUrl} download target="_blank" rel="noreferrer">
                        <Download className="w-4 h-4 mr-2" />
                        Tải xuống
                      </a>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setShowComments(!showComments)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {showComments ? 'Ẩn bình luận' : 'Hiện bình luận'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Compare Button (only for images) - Hidden on mobile */}
              {file.type === 'image' && file.versions.length > 1 && (
                <Button
                  variant={compareMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setCompareMode(!compareMode)}
                  className="hidden sm:flex"
                >
                  <Columns className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">So sánh</span>
                  <span className="md:hidden">So sánh</span>
                </Button>
              )}

              <Button variant="outline" size="sm" asChild className="hidden sm:flex">
                <a href={effectiveUrl} download target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Tải xuống</span>
                  <span className="md:hidden">Tải</span>
                </a>
              </Button>

              <Button
                variant={showComments ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="hidden sm:flex"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                <span className="hidden md:inline">Bình luận</span>
                <span className="md:hidden">BL</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-2"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            {/* Main Content Area */}
            <div className={`flex-1 overflow-auto bg-background/50 flex flex-col ${showComments && !isVideoFullscreen ? 'sm:border-r' : ''}`}>
              {/* Toolbar for Annotation */}
              <div className="p-2 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 gap-2">
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
              <div className="flex-1 p-2 flex items-center justify-center min-h-0 overflow-hidden">
                {renderFilePreview()}
              </div>
            </div>

            {/* Comments Sidebar - Normal Mode */}
            {showComments && !isVideoFullscreen && (
              <div className="w-full sm:w-[350px] flex-shrink-0 flex flex-col bg-background border-t sm:border-t-0 sm:border-l h-[38vh] sm:h-auto sm:max-h-none">
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
                  />
                  {fileComments.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Chưa có bình luận nào
                      {showOnlyCurrentTimeComments && <div className="text-xs mt-1">(Đang lọc theo thời gian hiện tại)</div>}
                    </div>
                  )}
                </div>

                {/* Desktop: Always show comment input */}
                <div className="hidden sm:block p-4 border-t bg-background flex-shrink-0">
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
                </div>

                {/* Mobile: Comment Input (Always visible now, no toggle) */}
                <div className="sm:hidden border-t bg-background flex-shrink-0 p-2">
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
                </div>
              </div>
            )}

            {/* Comments Sidebar - Fullscreen Mode (Absolutely Positioned) */}
            {showComments && isVideoFullscreen && (
              <div
                className="fixed top-0 right-0 left-[75vw] w-[25vw] h-screen flex flex-col bg-background border-l border-border z-50"
              >
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
                  />
                  {fileComments.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Chưa có bình luận nào
                      {showOnlyCurrentTimeComments && <div className="text-xs mt-1">(Đang lọc theo thời gian hiện tại)</div>}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t bg-background">
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
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog >

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
    </>
  )
}
