import { formatDistanceToNow } from 'date-fns'
import { linkifyText } from '@/lib/linkify'
import { vi } from 'date-fns/locale'
import { useEffect, useState } from 'react'
import type { Comment } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, Circle, Clock, Reply, Send, StickyNote, Download, Eye, X, ChevronLeft, ChevronRight, ArrowDownToLine, MoreHorizontal, Pencil, Trash, ShieldAlert, Loader2, Paperclip } from 'lucide-react'
import { Pin } from 'lucide-react'
import { useCommentStore } from '@/stores/comments'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ReactionPicker, REACTION_TYPES } from './ReactionPicker'

interface CommentsListProps {
  comments: Comment[]
  onResolveToggle?: (commentId: string, isResolved: boolean) => void
  onTimestampClick?: (timestamp: number) => void
  onReply?: (parentCommentId: string, userName: string, content: string) => Promise<void>
  currentUserName?: string
  isSequence?: boolean
  onViewAnnotation?: (annotationData: string, comment: any) => void
  isAdmin?: boolean
  onEdit?: (commentId: string, newContent: string) => Promise<void>
  onDelete?: (commentId: string) => Promise<void>
  isLocked?: boolean
}

export function CommentsList({
  comments,
  onResolveToggle,
  onTimestampClick,
  onReply,
  currentUserName = '',
  isSequence = false,
  onViewAnnotation,
  isAdmin = false,
  onEdit,
  onDelete,
  isLocked = false,
}: CommentsListProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [submittingEdit, setSubmittingEdit] = useState(false)
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
  const updateDisplayName = useCommentStore(s => s.updateDisplayName)

  const handlePin = async (comment: Comment) => {
    try {
      await togglePin(comment.projectId || '', comment.id, !!comment.isPinned)
    } catch (err) {
      console.error('Pin failed', err)
    }
  }

  const handleEditClick = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
    setEditDisplayName(comment.userName)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditContent('')
    setEditDisplayName('')
  }

  const handleSaveEdit = async (comment: Comment) => {
    if (!editContent.trim() || !editDisplayName.trim()) return

    setSubmittingEdit(true)
    try {
      // Update both content and display name
      if (onEdit) {
        await onEdit(comment.id, editContent)
      }
      if (editDisplayName !== comment.userName) {
        await updateDisplayName(comment.projectId, comment.id, editDisplayName)
      }
      setEditingCommentId(null)
      setEditContent('')
      setEditDisplayName('')
    } catch (error) {
      console.error('Failed to edit comment:', error)
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleDeleteClick = async (commentId: string) => {
    if (!onDelete) return
    if (confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      try {
        await onDelete(commentId)
      } catch (error) {
        console.error('Failed to delete comment:', error)
      }
    }
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const replies = repliesByParent[comment.id] || []
    const isReplying = replyingTo === comment.id
    const isNested = depth > 0
    const hasAnnotation = comment.annotationData && comment.annotationData !== '[]' && comment.annotationData !== 'null'

    return (
      <div key={comment.id} className={isNested ? 'ml-6 mt-2' : ''}>
        <div
          onClick={() => {
            // If has annotation, show it (handleViewAnnotation will also jump timeline if needed)
            if (hasAnnotation && onViewAnnotation) {
              onViewAnnotation(comment.annotationData!, comment)
            }
            // Otherwise, just jump to timeline if has timestamp
            else if (comment.timestamp !== undefined && comment.timestamp !== null && onTimestampClick) {
              onTimestampClick(comment.timestamp)
            }
          }}
          className={`group rounded-lg p-3 transition-colors ${comment.isResolved
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-muted/50 border border-border hover:bg-muted/70'
            } ${(hasAnnotation || (comment.timestamp !== undefined && comment.timestamp !== null)) ? 'cursor-pointer hover:border-primary/50' : ''}`}>
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
                {comment.isPending && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-yellow-500/20 text-yellow-600 border-yellow-500/30 animate-pulse">
                    Đang gửi...
                  </Badge>
                )}
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
            <div className={`flex items-center gap-1 shrink-0 ${comment.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(isReplying ? null : comment.id) }}
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
                  onClick={(e) => { e.stopPropagation(); onResolveToggle(comment.id, !comment.isResolved) }}
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
              {/* Reaction Picker */}
              {/* Reaction Picker */}
              <ReactionPicker
                onSelect={(reaction) => {
                  useCommentStore.getState().toggleReaction(comment.projectId, comment.id, reaction, currentUserName || 'Anonymous')
                }}
              />

              {/* Pin button */}
              <Button
                variant={comment.isPinned ? 'secondary' : 'ghost'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); handlePin(comment) }}
                className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title={comment.isPinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-3.5 h-3.5" />
              </Button>

              {/* Edit/Delete Menu - Admin Only */}
              {isAdmin && (onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && !isLocked && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleEditClick(comment)
                      }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                    )}
                    {onDelete && !isLocked && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(comment.id)
                        }}
                        className="text-red-500 focus:text-red-500 focus:bg-red-50"
                      >
                        <Trash className="w-3.5 h-3.5 mr-2" />
                        Xóa
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Content */}
          {editingCommentId === comment.id ? (
            <div className="mt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Tên hiển thị</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nhập tên hiển thị"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Nội dung</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder="Nhập nội dung bình luận"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={submittingEdit}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveEdit(comment)}
                  disabled={submittingEdit || !editContent.trim() || !editDisplayName.trim()}
                >
                  {submittingEdit ? 'Đang lưu...' : 'Lưu'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {linkifyText(comment.content)}
              {comment.isEdited && (
                <span className="text-xs text-muted-foreground ml-2 italic">(đã chỉnh sửa)</span>
              )}
            </div>
          )}

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

          {/* Reactions Display */}
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(comment.reactions).map(([reaction, users]) => (
                <button
                  key={reaction}
                  onClick={(e) => {
                    e.stopPropagation()
                    useCommentStore.getState().toggleReaction(comment.projectId, comment.id, reaction, currentUserName || 'Anonymous')
                  }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${users.includes(currentUserName || 'Anonymous')
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/50 border-transparent hover:bg-muted text-muted-foreground'
                    }`}
                  title={`${users.join(', ')}`}
                >
                  <span>{REACTION_TYPES[reaction as keyof typeof REACTION_TYPES] || reaction}</span>
                  <span className="font-medium text-[10px]">{users.length}</span>
                </button>
              ))}
            </div>
          )}

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
                    {/* Validation overlay or status */}
                    {attachment.validationStatus === 'infected' ? (
                      <div className="flex items-center gap-2 text-destructive text-sm p-1 border rounded border-destructive/20 bg-destructive/5">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="font-medium text-xs">File chứa mã độc - Đã chặn</span>
                      </div>
                    ) : attachment.validationStatus === 'error' ? (
                      <div className="flex items-center gap-2 text-yellow-600 text-sm p-1 border rounded border-yellow-500/20 bg-yellow-500/5">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="font-medium text-xs">Lỗi quét virus</span>
                      </div>
                    ) : (
                      <a
                        href={attachment.validationStatus === 'pending' ? '#' : attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ${attachment.validationStatus === 'pending' ? 'cursor-not-allowed opacity-70' : ''
                          }`}
                        onClick={(e) => attachment.validationStatus === 'pending' && e.preventDefault()}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{attachment.name}</span>
                        {attachment.validationStatus === 'pending' && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Footer - Bottom Right */}
          {(hasAnnotation || (comment.timestamp !== undefined && comment.timestamp !== null)) && (
            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              {hasAnnotation && (
                <div className="flex items-center gap-1" title="Có ghi chú">
                  <StickyNote className="w-3.5 h-3.5" />
                </div>
              )}
              {comment.timestamp !== undefined && comment.timestamp !== null && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isSequence
                      ? `Frame ${Math.floor(comment.timestamp) + 1}`
                      : `${Math.floor(comment.timestamp / 60)}:${String(Math.floor(comment.timestamp % 60)).padStart(2, '0')}`
                    }
                  </span>
                </div>
              )}
            </div>
          )}

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
