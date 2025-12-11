import { useState } from 'react'
import type { File as FileType } from '@/types'
import { format } from 'date-fns'
import { formatFileSize } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileImage, Video, Box, MessageSquare, Clock, Trash2, Film, FileText } from 'lucide-react'

interface Props {
  file: FileType
  resolvedUrl?: string
  commentCount: number
  onClick: () => void
  onDelete?: () => void
  compact?: boolean
  isAdmin?: boolean
}

const getFileTypeIcon = (type: string, size: string = 'w-8 h-8') => {
  if (type === 'image') return <FileImage className={`${size} text-green-500`} />
  if (type === 'video') return <Video className={`${size} text-blue-500`} />
  if (type === 'model') return <Box className={`${size} text-purple-500`} />
  if (type === 'sequence') return <Film className={`${size} text-orange-500`} />
  if (type === 'pdf') return <FileText className={`${size} text-red-500`} />
  return <FileImage className={`${size} text-gray-500`} />
}

const getFileTypeLabel = (type: string) => {
  if (type === 'image') return 'Hình ảnh'
  if (type === 'video') return 'Video'
  if (type === 'model') return 'Mô hình 3D'
  if (type === 'sequence') return 'Image Sequence'
  if (type === 'pdf') return 'PDF'
  return 'Tệp tin'
}

export function FileCardShared({ file, resolvedUrl, commentCount, onClick, onDelete, compact = false, isAdmin = false }: Props) {
  const current = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
  const effectiveUrl = resolvedUrl || current?.url
  const uploadDate = current?.uploadedAt?.toDate ? current.uploadedAt.toDate() : new Date()
  const [imageError, setImageError] = useState(false)

  const renderThumbnail = () => {
    if (file.type === 'image' && effectiveUrl && !imageError) {
      return (
        <img
          src={effectiveUrl}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )
    }

    if (file.type === 'sequence' && effectiveUrl && !imageError) {
      // Show first frame as thumbnail for sequences
      return (
        <div className="relative w-full h-full">
          <img
            src={effectiveUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
          <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <Film className="w-3 h-3" />
            {current?.frameCount || 0} frames
          </div>
        </div>
      )
    }

    if (file.type === 'video' && effectiveUrl) {
      return (
        <video
          src={effectiveUrl}
          className="w-full h-full object-cover"
          muted
        />
      )
    }

    if (file.type === 'model' && current?.thumbnailUrl && !imageError) {
      return (
        <img
          src={current.thumbnailUrl}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )
    }

    if (file.type === 'pdf' && current?.thumbnailUrl && !imageError) {
      return (
        <img
          src={current.thumbnailUrl}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )
    }

    // Fallback icon
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50">
        {getFileTypeIcon(file.type, 'w-16 h-16')}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="group rounded-lg border bg-card overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer"
    >
      {/* Thumbnail */}
      <div className={`${compact ? 'aspect-square' : 'aspect-video'} bg-muted/20 relative overflow-hidden`}>
        {renderThumbnail()}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-sm font-medium">
            Nhấn để xem chi tiết
          </div>
        </div>

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-background/80">
            {getFileTypeLabel(file.type)}
          </Badge>
        </div>

        {/* Version badge - positioned at bottom-left to avoid selection checkbox */}
        <div className="absolute bottom-2 left-2">
          <Badge 
            variant="outline" 
            className="text-xs backdrop-blur-sm bg-background/90 border-primary/30"
            title={`Phiên bản ${current?.version}${current?.versionLabel ? ` (${current.versionLabel})` : ''} - ${format(uploadDate, 'dd/MM/yy HH:mm')}`}
          >
            {current?.versionLabel || `v${current?.version}`}
          </Badge>
        </div>

        {/* Comment count badge */}
        {commentCount > 0 && (
          <div className="absolute bottom-2 right-2">
            <Badge variant="default" className="text-xs backdrop-blur-sm gap-1">
              <MessageSquare className="w-3 h-3" />
              {commentCount}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm truncate flex-1">{file.name}</h3>
          {isAdmin && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatFileSize(current?.metadata?.size || 0)}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(uploadDate, 'dd/MM/yy')}
          </span>
        </div>
      </div>
    </div>
  )
}
