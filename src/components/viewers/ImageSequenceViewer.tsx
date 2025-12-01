import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, SkipBack, SkipForward, Repeat, Film, Images, Grid3x3, Edit2, Check, X as XIcon, Maximize2 } from 'lucide-react'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { linkifyText } from '@/lib/linkify'
import { AnnotationCanvasKonva } from '@/components/annotations/AnnotationCanvasKonva'
import { AnnotationToolbar } from '@/components/annotations/AnnotationToolbar'
import type { AnnotationObject } from '@/types'

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
  onFrameDetailView
}: ImageSequenceViewerProps) {
  const [internalCurrentFrame, setInternalCurrentFrame] = useState(0)
  const currentFrame = externalCurrentFrame !== undefined ? externalCurrentFrame : internalCurrentFrame

  const setCurrentFrame = (frame: number | ((prev: number) => number)) => {
    if (externalCurrentFrame !== undefined) {
      const newFrame = typeof frame === 'function' ? frame(currentFrame) : frame
      onFrameChange?.(newFrame)
    } else {
      setInternalCurrentFrame(frame)
    }
  }

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const frameCount = urls.length

  // Preload images
  useEffect(() => {
    urls.forEach(url => {
      const img = new Image()
      img.src = url
    })
  }, [urls])

  // Handle animation loop
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = prev + 1
          if (next >= frameCount) {
            if (isLooping) return 0
            setIsPlaying(false)
            return prev
          }
          return next
        })
      }, 1000 / fps)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, isLooping, frameCount, fps])

  // Notify parent of frame changes when playing
  useEffect(() => {
    if (isPlaying && onFrameChange) {
      onFrameChange(currentFrame)
    }
  }, [currentFrame, isPlaying, onFrameChange])

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
        <div className="relative viewport flex-1 min-h-0 flex items-center justify-center max-h-[calc(100vh-16rem)] 2xl:max-h-[calc(100vh-20rem)]" id="sequence-image-container">
          <img
            src={urls[currentFrame]}
            alt={`Frame ${currentFrame + 1}`}
            className="w-full h-full object-contain max-h-[55vh] xl:max-h-[50vh] 2xl:max-h-[45vh]"
            draggable={false}
          />
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border border-border/50 px-3 py-1.5 rounded-md text-sm font-mono pointer-events-none z-10">
            Frame {currentFrame + 1} / {frameCount}
          </div>
          
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
              disabled={currentFrame === 0}
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevFrame}
              disabled={currentFrame === 0}
            >
              <SkipBack className="w-3 h-3" />
            </Button>

            <Button
              variant="default"
              size="lg"
              onClick={handlePlayPause}
              className="px-6"
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
              disabled={currentFrame === frameCount - 1}
            >
              <SkipForward className="w-3 h-3" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLastFrame}
              disabled={currentFrame === frameCount - 1}
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant={isLooping ? "default" : "outline"}
              size="sm"
              onClick={() => setIsLooping(!isLooping)}
              title="Loop"
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
          {/* Grid Layout */}
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

  const handleSaveCaption = () => {
    onCaptionChange?.(editedCaption)
    // Update parent component caption state immediately
    // This ensures the caption displays in real-time without reload
    setIsEditingCaption(false)
  }

  const handleCancelEdit = () => {
    setEditedCaption(caption || '')
    setIsEditingCaption(false)
  }

  return (
    <div
      className={`group relative rounded-lg overflow-hidden border-2 transition-all ${isSelected
        ? 'border-primary ring-2 ring-primary/20 shadow-lg'
        : 'border-border hover:border-primary/50 hover:shadow-md'
        }`}
    >
      {/* Image */}
      <button
        onClick={onSelect}
        className="w-full aspect-square relative overflow-hidden bg-muted/20 group/image"
      >
        <img
          src={url}
          alt={`Frame ${frameNumber + 1}`}
          className="w-full h-full object-cover transition-transform group-hover/image:scale-105"
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
          <div className="bg-background/90 text-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 hover:bg-background transition-colors transform scale-90 group-hover/image:scale-100 transition-transform">
            <Maximize2 className="w-3 h-3" />
            Xem chi tiết
          </div>
        </div>
      </button>

      {/* Caption Section */}
      <div className="p-2 bg-background min-h-[60px]">
        {isEditingCaption ? (
          <div className="space-y-2">
            <textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              placeholder="Thêm chú thích..."
              className="w-full text-xs p-2 bg-background text-foreground placeholder:text-muted-foreground/50 border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              maxLength={500}
              autoFocus
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleSaveCaption}
                className="h-6 px-2 text-xs flex-1"
              >
                <Check className="w-3 h-3 mr-1" />
                Lưu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="h-6 px-2 text-xs flex-1"
              >
                <XIcon className="w-3 h-3 mr-1" />
                Hủy
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative group/caption">
            {caption ? (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {linkifyText(caption)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">Chưa có chú thích</p>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingCaption(true)}
                className="absolute -top-1 -right-1 h-6 w-6 p-0 opacity-0 group-hover/caption:opacity-100 transition-opacity"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
