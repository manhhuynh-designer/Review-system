import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useEffect, useState } from 'react'
import type { Comment } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, Circle, Clock, Reply, Send, StickyNote, Download, Eye, X, ChevronLeft, ChevronRight, ArrowDownToLine } from 'lucide-react'
import { Pin } from 'lucide-react'
import { useCommentStore } from '@/stores/comments'

interface CommentsListProps {
  comments: Comment[]
  onResolveToggle?: (commentId: string, isResolved: boolean) => void
  onTimestampClick?: (timestamp: number) => void
  onReply?: (parentCommentId: string, userName: string, content: string) => Promise<void>
  currentUserName?: string
  isSequence?: boolean
  onViewAnnotation?: (annotationData: string, comment: any) => void
  isAdmin?: boolean
}

export function CommentsList({
  comments,
  onResolveToggle,
  onTimestampClick,
  onReply,
  currentUserName = '',
  isSequence = false,
  onViewAnnotation,
  isAdmin: _isAdmin = false,
}: CommentsListProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0)

  const openLightbox = (images: string[], index: number) => {
    console.log('openLightbox called:', { images, index, total: images.length })
    setLightbox({ images, index })
  }

  const closeLightbox = () => {
    console.log('closeLightbox called')
    setLightbox(null)
  }

  const nextImage = () => {
    if (!lightbox) return
    setLightbox({
      images: lightbox.images,
      index: (lightbox.index + 1) % lightbox.images.length,
    })
  }

  const prevImage = () => {
    if (!lightbox) return
    setLightbox({
      images: lightbox.images,
      index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
    })
  }

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') nextImage()
      if (e.key === 'ArrowLeft') prevImage()
      if (e.key === 'd' || e.key === 'D') {
        // Download current image
        e.preventDefault()
        const link = document.createElement('a')
        link.href = lightbox.images[lightbox.index]
        link.download = `image-${lightbox.index + 1}.jpg`
        link.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  // Organize comments into parent-child structure
  const rootComments = comments.filter(c => !c.parentCommentId)
  const repliesByParent = comments.reduce((acc, comment) => {
    if (comment.parentCommentId) {
      if (!acc[comment.parentCommentId]) {
        acc[comment.parentCommentId] = []
      }
      acc[comment.parentCommentId].push(comment)
    }
    return acc
  }, {} as Record<string, Comment[]>)

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || !onReply) return

    setSubmittingReply(true)
    try {
      await onReply(parentId, currentUserName, replyContent)
      setReplyContent('')
      setReplyingTo(null)
    } finally {
      setSubmittingReply(false)
    }
  }

  const togglePin = useCommentStore(s => s.togglePin)

  const handlePin = async (comment: Comment) => {
    try {
      await togglePin(comment.projectId || '', comment.id, !!comment.isPinned)
    } catch (err) {
      console.error('Pin failed', err)
    }
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const replies = repliesByParent[comment.id] || []
    const isReplying = replyingTo === comment.id
    const isNested = depth > 0
    const hasAnnotation = comment.annotationData && comment.annotationData !== '[]' && comment.annotationData !== 'null'

    return (
      <div key={comment.id} className={isNested ? 'ml-6 mt-2' : ''}>
        <div className={`group rounded-lg p-3 transition-colors ${comment.isResolved
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-muted/50 border border-border hover:bg-muted/70'
          }`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{comment.userName}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(comment.createdAt.toDate(), {
                    addSuffix: true,
                    locale: vi
                  })}
                </span>
                {comment.isResolved && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Resolved
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {hasAnnotation && onViewAnnotation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewAnnotation(comment.annotationData!, comment)}
                  className="h-7 px-2 text-xs gap-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  title="Xem ghi chú"
                >
                  <StickyNote className="w-3 h-3" />
                  Ghi chú
                </Button>
              )}
              {comment.timestamp !== undefined && comment.timestamp !== null && onTimestampClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onTimestampClick(comment.timestamp!)}
                  className="h-7 px-2 text-xs gap-1"
                  title={isSequence ? "Chuyển đến frame này" : "Phát từ timestamp này"}
                >
                  <Clock className="w-3 h-3" />
                  {isSequence
                    ? `Frame ${Math.floor(comment.timestamp) + 1}`
                    : `${Math.floor(comment.timestamp / 60)}:${String(Math.floor(comment.timestamp % 60)).padStart(2, '0')}`
                  }
                </Button>
              )}
              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                  className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Trả lời"
                >
                  <Reply className="w-3.5 h-3.5" />
                </Button>
              )}
              {onResolveToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolveToggle(comment.id, !comment.isResolved)}
                  className={`h-7 px-2 ${comment.isResolved ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'}`}
                  title={comment.isResolved ? 'Mở lại' : 'Đánh dấu resolved'}
                >
                  {comment.isResolved ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
              {/* Pin button */}
              <Button
                variant={comment.isPinned ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handlePin(comment)}
                className="h-7 px-2"
                title={comment.isPinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {comment.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
              if (part.match(/https?:\/\/[^\s]+/)) {
                return (
                  <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {part}
                  </a>
                )
              }
              return part
            })}
          </div>

          {/* Image Attachments */}
          {(() => {
            const imgs = comment.imageUrls && comment.imageUrls.length > 0
              ? comment.imageUrls
              : (comment.attachments?.filter(att => att.type === 'image').map(att => att.url) || [])
            
            if (imgs.length === 0) return null
            
            return (
              <div className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {imgs.map((imageUrl, index) => (
                    <div 
                      key={index} 
                      className="relative group cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Image clicked:', imageUrl, 'index:', index, 'total:', imgs.length)
                        openLightbox(imgs, index)
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-32 object-cover rounded-md border border-border hover:border-primary transition-colors pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-md flex items-center justify-center pointer-events-none">
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {/* Download button */}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation()
                          const link = document.createElement('a')
                          link.href = imageUrl
                          link.download = `image-${index + 1}.jpg`
                          link.target = '_blank'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        title="Tải xuống"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Other Attachments */}
          {comment.attachments && comment.attachments.filter(att => att.type !== 'image').length > 0 && (
            <div className="mt-3">
              <div className="space-y-1">
                {comment.attachments.filter(att => att.type !== 'image').map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                    <span className="flex-1 truncate">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(attachment.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 w-6 p-0"
                    >
                      <a 
                        href={attachment.url} 
                        download={attachment.name} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={`Tải xuống ${attachment.name}`}
                      >
                        <Download className="w-3 h-3" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pin / actions row (no reactions) */}
          <div className="mt-2 flex items-center gap-2" />

          {/* Reply input */}
          {isReplying && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Trả lời ${comment.userName}...`}
                  className="flex-1 min-h-[70px] text-sm"
                  disabled={submittingReply}
                  autoFocus
                />
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReply(comment.id)}
                    disabled={!replyContent.trim() || submittingReply}
                    className="h-8 px-3"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(null)
                      setReplyContent('')
                    }}
                    disabled={submittingReply}
                    className="h-8 px-3"
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Render replies recursively */}
        {replies.length > 0 && (
          <div className="space-y-2">
            {replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Chưa có bình luận nào
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {rootComments.map(comment => renderComment(comment))}
      </div>

      {/* Debug lightbox state */}
      {lightbox && console.log('Rendering lightbox:', lightbox)}

      {/* Lightbox Modal - NEW APPROACH: Fixed overlay independent of React hierarchy */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95"
          onMouseDown={(e) => {
            // Only close when clicking the backdrop itself
            if (e.target === e.currentTarget) {
              closeLightbox()
            }
          }}
        >
          {/* Controls Container */}
          <div className="absolute top-4 right-4 z-[100000] flex items-center gap-2">
            {/* Download Button */}
            <button
              className="h-10 w-10 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                const link = document.createElement('a')
                link.href = lightbox.images[lightbox.index]
                link.download = `image-${lightbox.index + 1}.jpg`
                link.click()
              }}
              title="Tải xuống (D)"
              type="button"
            >
              <ArrowDownToLine className="w-5 h-5" />
            </button>

            {/* Close Button */}
            <button
              className="h-10 w-10 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                closeLightbox()
              }}
              title="Đóng (ESC)"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Container */}
          <div
            className="relative w-full h-full flex items-center justify-center px-20"
            onTouchStart={(e) => {
              setTouchStartX(e.touches[0].clientX)
              setTouchDeltaX(0)
            }}
            onTouchMove={(e) => {
              if (touchStartX !== null) {
                setTouchDeltaX(e.touches[0].clientX - touchStartX)
              }
            }}
            onTouchEnd={() => {
              if (touchDeltaX > 60) prevImage()
              if (touchDeltaX < -60) nextImage()
              setTouchStartX(null)
              setTouchDeltaX(0)
            }}
          >
            {/* Previous Button */}
            {lightbox.images.length > 1 && (
              <button
                className="absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
                title="Ảnh trước (←)"
                type="button"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main Image */}
            <img
              src={lightbox.images[lightbox.index]}
              alt={`Image ${lightbox.index + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
            />

            {/* Next Button */}
            {lightbox.images.length > 1 && (
              <button
                className="absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                title="Ảnh tiếp theo (→)"
                type="button"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Image Counter */}
            {lightbox.images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/60 text-white text-sm backdrop-blur-sm">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
