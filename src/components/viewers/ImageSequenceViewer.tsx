import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, SkipBack, SkipForward, Repeat, Film, Images, Grid3x3, Edit2, Check, Maximize2, GripVertical, Trash2, Settings, Plus, Loader2 } from 'lucide-react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { linkifyText } from '@/lib/linkify'
import { AnnotationCanvasKonva } from '@/components/annotations/AnnotationCanvasKonva'
import { AnnotationToolbar } from '@/components/annotations/AnnotationToolbar'
import type { AnnotationObject } from '@/types'

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ImageSequenceViewerProps {
  urls: string[]
  fps?: number
  onFrameChange?: (frame: number) => void
  defaultViewMode?: 'video' | 'carousel' | 'grid'
  isAdmin?: boolean
  onViewModeChange?: (mode: 'video' | 'carousel' | 'grid') => void
  currentFrame?: number
  className?: string
  frameCaptions?: Record<number, string>
  onCaptionChange?: (fileId: string, version: number, frame: number, caption: string) => void
  file: { id: string; currentVersion: number }
  // Annotation props
  isAnnotating?: boolean
  annotationData?: AnnotationObject[] | null
  annotationTool?: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser'
  annotationColor?: string
  annotationStrokeWidth?: number
  isAnnotationReadOnly?: boolean
  onAnnotationChange?: (data: AnnotationObject[] | null) => void
  onAnnotationUndo?: () => void
  onAnnotationRedo?: () => void
  onClearAnnotations?: () => void
  onDoneAnnotating?: () => void
  canUndoAnnotation?: boolean
  canRedoAnnotation?: boolean
  onStartAnnotating?: (frame: number) => void
  // Grid frame detail view
  onFrameDetailView?: (frameIndex: number) => void
  // Grid edit mode callbacks (admin only)
  onReorderFrames?: (newOrder: number[]) => void
  onDeleteFrames?: (indices: number[]) => void
  onAddFrames?: (files: File[]) => void
  isUploading?: boolean
}

type ViewMode = 'video' | 'carousel' | 'grid'

export function ImageSequenceViewer({
  urls,
  fps = 24,
  onFrameChange,
  defaultViewMode = 'video',
  isAdmin = false,
  onViewModeChange,
  currentFrame: externalCurrentFrame,
  className,
  frameCaptions = {},
  onCaptionChange,
  file,
  // Annotation props with defaults
  isAnnotating = false,
  annotationData = null,
  annotationTool = 'pen',
  annotationColor = '#ffff00',
  annotationStrokeWidth = 2,
  isAnnotationReadOnly = false,
  onAnnotationChange,
  onAnnotationUndo,
  onAnnotationRedo,
  onClearAnnotations,
  onDoneAnnotating,
  canUndoAnnotation = false,
  canRedoAnnotation = false,
  onStartAnnotating: _onStartAnnotating,
  onFrameDetailView,
  // Grid edit mode callbacks
  onReorderFrames,
  onDeleteFrames,
  onAddFrames,
  isUploading = false
}: ImageSequenceViewerProps) {
  const [currentFrame, setCurrentFrame] = useState(externalCurrentFrame !== undefined ? externalCurrentFrame : 0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const frameCount = urls.length

  // Ref to track viewMode for tick callback
  const viewModeRef = useRef(viewMode)
  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  // Grid edit mode state (admin only)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set())
  const [frameOrder, setFrameOrder] = useState<number[]>(() => urls.map((_, i) => i))

  // Update frame order when urls change
  useEffect(() => {
    setFrameOrder(urls.map((_, i) => i))
    setSelectedForDelete(new Set())
  }, [urls])

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setFrameOrder((items) => {
        const oldIndex = items.indexOf(active.id as number)
        const newIndex = items.indexOf(over.id as number)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        onReorderFrames?.(newOrder)
        return newOrder
      })
    }
  }, [onReorderFrames])

  // Handle delete selected
  const handleDeleteSelected = useCallback(() => {
    if (selectedForDelete.size > 0) {
      onDeleteFrames?.(Array.from(selectedForDelete))
      setSelectedForDelete(new Set())
    }
  }, [selectedForDelete, onDeleteFrames])

  // Toggle frame selection for delete
  const toggleFrameSelection = useCallback((index: number) => {
    setSelectedForDelete(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  // Refs for fast-image-sequence
  const sequenceContainerRef = useRef<HTMLDivElement>(null)
  const sequenceRef = useRef<any>(null)
  const isSequenceReady = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddFramesClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onAddFrames?.(Array.from(files))
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Sync with external currentFrame if provided
  useEffect(() => {
    if (externalCurrentFrame !== undefined) {
      setCurrentFrame(externalCurrentFrame)
    }
  }, [externalCurrentFrame])

  // Preload images with tracking
  useEffect(() => {
    setImagesLoaded(false)
    setLoadedCount(0)
    let loadCount = 0

    const promises = urls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          loadCount++
          setLoadedCount(loadCount)
          resolve()
        }
        img.onerror = () => {
          loadCount++
          setLoadedCount(loadCount)
          resolve() // Still resolve even on error
        }
        img.src = url
      })
    })

    Promise.all(promises).then(() => {
      setImagesLoaded(true)
    })
  }, [urls])

  // Initialize fast-image-sequence
  useEffect(() => {
    if (viewMode !== 'video' || !sequenceContainerRef.current || frameCount === 0) {
      return
    }

    let sequence: any = null

    const initSequence = async () => {
      try {
        const { FastImageSequence } = await import('@mediamonks/fast-image-sequence')

        if (!sequenceContainerRef.current) return

        // Clear container
        sequenceContainerRef.current.innerHTML = ''

        sequence = new FastImageSequence(sequenceContainerRef.current, {
          frames: frameCount,
          src: {
            imageURL: (index: number) => urls[index] || urls[0],
          },
          loop: isLooping,
          objectFit: 'contain',
        })

        sequenceRef.current = sequence
        isSequenceReady.current = true

        // Register tick callback to sync frame - only update when in video mode
        sequence.tick(() => {
          // Check if sequence still exists (might be null after cleanup)
          if (!sequence) return
          // Only sync frame from library when in video mode (use ref to get current value)
          if (viewModeRef.current !== 'video') return
          const progress = sequence.progress
          const frame = Math.round(progress * (frameCount - 1))
          setCurrentFrame(frame)
        })
      } catch (error) {
        console.error('Error initializing FastImageSequence:', error)
      }
    }

    initSequence()

    return () => {
      if (sequence) {
        try {
          sequence.stop()
          sequence = null
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      sequenceRef.current = null
      isSequenceReady.current = false
    }
  }, [viewMode, frameCount, urls, isLooping])

  // Handle play/pause with library
  useEffect(() => {
    const sequence = sequenceRef.current
    if (!sequence || !isSequenceReady.current) return

    if (isPlaying && viewMode === 'video' && imagesLoaded) {
      sequence.play(fps)
    } else {
      sequence.stop()
    }
  }, [isPlaying, viewMode, imagesLoaded, fps])

  // Sync frame to library when changed externally (only in video mode)
  useEffect(() => {
    const sequence = sequenceRef.current
    if (!sequence || !isSequenceReady.current || isPlaying || viewMode !== 'video') return

    sequence.progress = currentFrame / (frameCount - 1)
  }, [currentFrame, frameCount, isPlaying, viewMode])

  // Notify parent of frame changes
  useEffect(() => {
    onFrameChange?.(currentFrame)
  }, [currentFrame, onFrameChange])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleFrameChange = (value: number[]) => {
    const newFrame = value[0]
    setCurrentFrame(newFrame)
    onFrameChange?.(newFrame)
  }

  const handleNextFrame = () => {
    const next = Math.min(currentFrame + 1, frameCount - 1)
    setCurrentFrame(next)
    onFrameChange?.(next)
  }

  const handlePrevFrame = () => {
    const prev = Math.max(currentFrame - 1, 0)
    setCurrentFrame(prev)
    onFrameChange?.(prev)
  }

  const handleFirstFrame = () => {
    setCurrentFrame(0)
    onFrameChange?.(0)
  }

  const handleLastFrame = () => {
    setCurrentFrame(frameCount - 1)
    onFrameChange?.(frameCount - 1)
  }

  const handleViewModeChange = (newMode: string) => {
    if (newMode) {
      const mode = newMode as ViewMode
      setViewMode(mode)
      onViewModeChange?.(mode)
    }
  }

  // Mouse scrubbing state
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // Mouse scrubbing handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || viewMode === 'grid') return

    const container = imageContainerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    const targetFrame = Math.floor(percentage * (frameCount - 1))

    if (targetFrame !== currentFrame) {
      setCurrentFrame(targetFrame)
      onFrameChange?.(targetFrame)
      setIsScrubbing(true)
    }
  }

  const handleMouseDown = () => {
    setIsMouseDown(true)
    setIsScrubbing(false)
    // Pause playback when starting to scrub
    if (isPlaying) {
      setIsPlaying(false)
    }
  }

  const handleMouseUp = () => {
    setIsMouseDown(false)
    setTimeout(() => setIsScrubbing(false), 100)
  }

  const handleMouseLeave = () => {
    setIsMouseDown(false)
    setTimeout(() => setIsScrubbing(false), 100)
  }

  // Sync view mode if prop changes (e.g. from parent)
  useEffect(() => {
    if (defaultViewMode) {
      setViewMode(defaultViewMode)
    }
  }, [defaultViewMode])

  return (
    <div className={`flex flex-col h-full gap-4 max-h-[calc(100%-2rem)] ${className || ''}`}>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between px-4 flex-shrink-0">
        {isAdmin ? (
          <ToggleGroup type="single" value={viewMode} onValueChange={handleViewModeChange}>
            <ToggleGroupItem value="video" aria-label="Video mode" className="gap-2">
              <Film className="w-4 h-4" />
              <span className="text-xs">Video</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="carousel" aria-label="Carousel mode" className="gap-2">
              <Images className="w-4 h-4" />
              <span className="text-xs">Carousel</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid mode" className="gap-2">
              <Grid3x3 className="w-4 h-4" />
              <span className="text-xs">Grid</span>
            </ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            {viewMode === 'video' ? (
              <>
                <Film className="w-4 h-4" />
                <span className="text-xs font-medium">Chế độ Video</span>
              </>
            ) : viewMode === 'carousel' ? (
              <>
                <Images className="w-4 h-4" />
                <span className="text-xs font-medium">Chế độ Carousel</span>
              </>
            ) : (
              <>
                <Grid3x3 className="w-4 h-4" />
                <span className="text-xs font-medium">Chế độ Grid</span>
              </>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {viewMode === 'video' ? 'Chế độ phát tự động' : viewMode === 'carousel' ? 'Chế độ xem thủ công' : 'Chế độ lưới'}
        </div>
      </div>

      {/* Image Display - Hide in Grid Mode */}
      {viewMode !== 'grid' && (
        <div
          ref={imageContainerRef}
          className={`relative viewport flex-1 min-h-0 flex items-center justify-center max-h-[calc(100dvh-16rem)] 2xl:max-h-[calc(100dvh-20rem)] ${isMouseDown ? 'cursor-grabbing' : 'cursor-grab'}`}
          id="sequence-image-container"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Fast Image Sequence Canvas - Video Mode Only */}
          {viewMode === 'video' && (
            <div
              ref={sequenceContainerRef}
              className="w-full h-full max-h-[55dvh] xl:max-h-[50dvh] 2xl:max-h-[45dvh]"
              style={{ position: 'relative' }}
            />
          )}

          {/* Regular Image - Carousel Mode */}
          {viewMode === 'carousel' && (
            <img
              src={urls[currentFrame]}
              alt={`Frame ${currentFrame + 1}`}
              className="w-full h-full object-contain max-h-[55dvh] xl:max-h-[50dvh] 2xl:max-h-[45dvh] select-none"
              draggable={false}
            />
          )}

          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border border-border/50 px-3 py-1.5 rounded-md text-sm font-mono pointer-events-none z-10">
            Frame {currentFrame + 1} / {frameCount}
          </div>

          {/* Scrubbing indicator */}
          {isScrubbing && (
            <div className="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm border border-primary px-3 py-1.5 rounded-md text-sm font-medium pointer-events-none z-10 text-primary-foreground">
              Scrubbing...
            </div>
          )}

          {/* Annotation overlay for video/carousel modes only */}
          {isAnnotating && (
            <>
              <AnnotationCanvasKonva
                mode={isAnnotationReadOnly ? 'read' : 'edit'}
                data={annotationData || []}
                tool={annotationTool}
                color={annotationColor}
                strokeWidth={annotationStrokeWidth}
                onChange={(data) => !isAnnotationReadOnly && onAnnotationChange?.(data)}
                onUndo={onAnnotationUndo}
                onRedo={onAnnotationRedo}
              />
              {!isAnnotationReadOnly && (
                <AnnotationToolbar
                  tool={annotationTool}
                  onToolChange={() => { }}
                  color={annotationColor}
                  onColorChange={() => { }}
                  strokeWidth={annotationStrokeWidth}
                  onStrokeWidthChange={() => { }}
                  onUndo={onAnnotationUndo || (() => { })}
                  onRedo={onAnnotationRedo || (() => { })}
                  onClear={onClearAnnotations || (() => { })}
                  onDone={onDoneAnnotating || (() => { })}
                  canUndo={canUndoAnnotation}
                  canRedo={canRedoAnnotation}
                />
              )}
            </>
          )}
        </div>
      )}

      {viewMode === 'video' ? (
        /* Video Mode Controls */
        <div className="space-y-3 px-4 flex-shrink-0 bg-background/95 backdrop-blur-sm border-t">
          {/* Loading indicator */}
          {!imagesLoaded && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
              <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
              <span>Loading frames: {loadedCount} / {frameCount}</span>
            </div>
          )}

          {/* Timeline Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono w-12 text-right">
              {String(currentFrame + 1).padStart(3, '0')}
            </span>
            <Slider
              value={[currentFrame]}
              min={0}
              max={frameCount - 1}
              step={1}
              onValueChange={handleFrameChange}
              className="flex-1"
              disabled={!imagesLoaded}
            />
            <span className="text-xs text-muted-foreground font-mono w-12">
              {String(frameCount).padStart(3, '0')}
            </span>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFirstFrame}
              disabled={currentFrame === 0 || !imagesLoaded}
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevFrame}
              disabled={currentFrame === 0 || !imagesLoaded}
            >
              <SkipBack className="w-3 h-3" />
            </Button>

            <Button
              variant="default"
              size="lg"
              onClick={handlePlayPause}
              className="px-6"
              disabled={!imagesLoaded}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextFrame}
              disabled={currentFrame === frameCount - 1 || !imagesLoaded}
            >
              <SkipForward className="w-3 h-3" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLastFrame}
              disabled={currentFrame === frameCount - 1 || !imagesLoaded}
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant={isLooping ? "default" : "outline"}
              size="sm"
              onClick={() => setIsLooping(!isLooping)}
              title="Loop"
              disabled={!imagesLoaded}
            >
              <Repeat className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-muted-foreground">FPS:</span>
              <span className="text-sm font-mono font-medium">{fps}</span>
            </div>
          </div>
        </div>
      ) : viewMode === 'carousel' ? (
        /* Carousel Mode Controls */
        <div className="space-y-3 px-4 flex-shrink-0 bg-background/95 backdrop-blur-sm border-t">
          {/* Info Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
            <span>Tổng số frames: {frameCount}</span>
            <span>Dùng ← → để điều hướng</span>
          </div>

          {/* Thumbnail Grid */}
          <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto p-2 bg-muted/20 rounded-lg">
            {urls.map((url, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentFrame(index)
                  onFrameChange?.(index)
                }}
                className={`relative aspect-square rounded overflow-hidden border-2 transition-all hover:scale-105 ${currentFrame === index
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent hover:border-primary/50'
                  }`}
              >
                <img
                  src={url}
                  alt={`Thumb ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${currentFrame === index ? 'bg-background/60' : 'bg-background/80'
                  }`}>
                  <span className={`text-xs font-mono font-medium ${currentFrame === index ? 'text-primary' : 'text-foreground'
                    }`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleFirstFrame}
              disabled={currentFrame === 0}
              className="flex-1"
            >
              <SkipBack className="w-4 h-4 mr-2" />
              Đầu
            </Button>

            <Button
              variant="outline"
              onClick={handlePrevFrame}
              disabled={currentFrame === 0}
              className="flex-1"
            >
              <SkipBack className="w-3 h-3 mr-2" />
              Trước
            </Button>

            <div className="px-4 py-2 bg-muted rounded-md font-mono text-sm min-w-[100px] text-center">
              {currentFrame + 1} / {frameCount}
            </div>

            <Button
              variant="outline"
              onClick={handleNextFrame}
              disabled={currentFrame === frameCount - 1}
              className="flex-1"
            >
              Sau
              <SkipForward className="w-3 h-3 ml-2" />
            </Button>

            <Button
              variant="outline"
              onClick={handleLastFrame}
              disabled={currentFrame === frameCount - 1}
              className="flex-1"
            >
              Cuối
              <SkipForward className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
        /* Grid Mode */
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative viewport">
          {/* Edit Mode Toggle (Admin only) */}
          {isAdmin && (
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsEditMode(!isEditMode)
                    setSelectedForDelete(new Set())
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {isEditMode ? 'Thoát chỉnh sửa' : 'Chỉnh sửa'}
                </Button>
                {isEditMode && (
                  <span className="text-xs text-muted-foreground">
                    Kéo thả để sắp xếp lại • Click để chọn xoá
                  </span>
                )}
              </div>
              {isEditMode && selectedForDelete.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Xoá {selectedForDelete.size} hình
                </Button>
              )}
              {isEditMode && selectedForDelete.size === 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddFramesClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm frames
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*"
            onChange={handleFileChange}
          />

          {/* Grid Layout with DnD */}
          {isEditMode && isAdmin ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={frameOrder} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {frameOrder.map((originalIndex) => (
                    <SortableGridFrameCard
                      key={originalIndex}
                      id={originalIndex}
                      url={urls[originalIndex]}
                      frameNumber={originalIndex}
                      frameCount={frameCount}
                      caption={frameCaptions[originalIndex]}
                      isSelected={currentFrame === originalIndex}
                      isSelectedForDelete={selectedForDelete.has(originalIndex)}
                      isAdmin={isAdmin}
                      isEditMode={true}
                      onSelect={() => {
                        setCurrentFrame(originalIndex)
                        onFrameChange?.(originalIndex)
                      }}
                      onViewDetail={() => {
                        onFrameDetailView?.(originalIndex)
                      }}
                      onCaptionChange={(caption) => onCaptionChange?.(file.id, file.currentVersion, originalIndex, caption)}
                      onToggleDelete={() => toggleFrameSelection(originalIndex)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {urls.map((url, index) => (
                <GridFrameCard
                  key={index}
                  url={url}
                  frameNumber={index}
                  frameCount={frameCount}
                  caption={frameCaptions[index]}
                  isSelected={currentFrame === index}
                  isAdmin={isAdmin}
                  onSelect={() => {
                    setCurrentFrame(index)
                    onFrameChange?.(index)
                  }}
                  onViewDetail={() => {
                    onFrameDetailView?.(index)
                  }}
                  onCaptionChange={(caption) => onCaptionChange?.(file.id, file.currentVersion, index, caption)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Grid Frame Card Component
function GridFrameCard({
  url,
  frameNumber,
  frameCount,
  caption,
  isSelected,
  isAdmin,
  onSelect,
  onViewDetail,
  onCaptionChange
}: {
  url: string
  frameNumber: number
  frameCount: number
  caption?: string
  isSelected: boolean
  isAdmin: boolean
  onSelect: () => void
  onViewDetail: () => void
  onCaptionChange?: (caption: string) => void
}) {
  const [isEditingCaption, setIsEditingCaption] = useState(false)
  const [editedCaption, setEditedCaption] = useState(caption || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditingCaption && textareaRef.current) {
      textareaRef.current.focus()
      // adjust height
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isEditingCaption])

  const handleSaveCaption = () => {
    if (editedCaption !== caption) {
      onCaptionChange?.(editedCaption)
    }
    setIsEditingCaption(false)
  }

  const handleCancelEdit = () => {
    setEditedCaption(caption || '')
    setIsEditingCaption(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveCaption()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    <div
      className={`group relative rounded-lg overflow-hidden border-2 transition-all bg-card ${isSelected
        ? 'border-primary ring-2 ring-primary/20 shadow-lg'
        : 'border-border hover:border-primary/50 hover:shadow-md'
        }`}
    >
      {/* Image */}
      <button
        onClick={onSelect}
        className="w-full aspect-square relative overflow-hidden bg-muted/30 group/image"
      >
        <img
          src={url}
          alt={`Frame ${frameNumber + 1}`}
          className="w-full h-full object-contain transition-transform group-hover/image:scale-105"
        />
        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border border-border/50 px-2 py-1 rounded text-xs font-mono">
          {String(frameNumber + 1).padStart(3, '0')} / {String(frameCount).padStart(3, '0')}
        </div>

        {/* View Detail Button Overlay */}
        <div
          className="absolute inset-0 bg-background/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetail()
          }}
        >
          <div className="bg-background/90 text-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 hover:bg-background transition-colors transform scale-90 group-hover/image:scale-100 transition-transform shadow-sm cursor-pointer">
            <Maximize2 className="w-3 h-3" />
            Xem chi tiết
          </div>
        </div>
      </button>

      {/* Caption Section */}
      <div className="min-h-[60px] border-t bg-card">
        {isEditingCaption ? (
          <div className="p-2">
            <textarea
              ref={textareaRef}
              value={editedCaption}
              onChange={(e) => {
                setEditedCaption(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveCaption}
              placeholder="Nhập chú thích..."
              className="w-full text-xs p-2 bg-muted/50 text-foreground placeholder:text-muted-foreground/50 border border-transparent rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
              rows={1}
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-1 px-1">
              <span className="text-[10px] text-muted-foreground">Enter để lưu</span>
              <span className="text-[10px] text-muted-foreground">{editedCaption.length}/500</span>
            </div>
          </div>
        ) : (
          <div
            className="relative group/caption p-2 h-full cursor-text"
            onClick={() => isAdmin && setIsEditingCaption(true)}
          >
            {caption ? (
              <div className="text-xs text-foreground/90 break-words whitespace-pre-wrap line-clamp-3">
                {linkifyText(caption)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic py-1">
                {isAdmin ? 'Thêm chú thích...' : 'Chưa có chú thích'}
              </p>
            )}

            {isAdmin && (
              <div className="absolute top-1 right-1 opacity-0 group-hover/caption:opacity-100 transition-opacity">
                <Edit2 className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Sortable Grid Frame Card Component (with drag-and-drop support)
function SortableGridFrameCard({
  id,
  url,
  frameNumber,
  frameCount,
  caption,
  isSelected,
  isSelectedForDelete,
  isAdmin: _isAdmin,
  isEditMode: _isEditMode,
  onSelect,
  onViewDetail: _onViewDetail,
  onCaptionChange: _onCaptionChange,
  onToggleDelete
}: {
  id: number
  url: string
  frameNumber: number
  frameCount: number
  caption?: string
  isSelected: boolean
  isSelectedForDelete: boolean
  isAdmin: boolean
  isEditMode: boolean
  onSelect: () => void
  onViewDetail: () => void
  onCaptionChange?: (caption: string) => void
  onToggleDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg overflow-hidden border-2 transition-all bg-card ${isSelectedForDelete
        ? 'border-destructive ring-2 ring-destructive/20 shadow-lg'
        : isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-lg'
          : 'border-border hover:border-primary/50 hover:shadow-md'
        }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-20 bg-background/90 backdrop-blur-sm border border-border/50 p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Delete Selection Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleDelete()
        }}
        className={`absolute top-2 left-2 z-20 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isSelectedForDelete
          ? 'bg-destructive border-destructive text-destructive-foreground'
          : 'bg-background/90 border-border hover:border-primary opacity-0 group-hover:opacity-100'
          }`}
      >
        {isSelectedForDelete && <Check className="w-4 h-4" />}
      </button>

      {/* Image */}
      <div
        onClick={onSelect}
        className="w-full aspect-square relative overflow-hidden bg-muted/30 group/image cursor-pointer"
      >
        <img
          src={url}
          alt={`Frame ${frameNumber + 1}`}
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm border border-border/50 px-2 py-1 rounded text-xs font-mono pointer-events-none">
          {String(frameNumber + 1).padStart(3, '0')} / {String(frameCount).padStart(3, '0')}
        </div>
      </div>

      {/* Compact Caption Preview */}
      <div className="p-2 bg-card border-t min-h-[40px]">
        <div className="text-xs text-muted-foreground break-words whitespace-pre-wrap line-clamp-2">
          {caption ? linkifyText(caption) : <span className="italic text-muted-foreground/50">Chưa có chú thích</span>}
        </div>
      </div>
    </div>
  )
}
