import { useState } from 'react'
import type { File as FileType } from '@/types'
import { format } from 'date-fns'
import { formatFileSize } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FileImage, Video, Box, MessageSquare, Clock } from 'lucide-react'

interface Props {
  file: FileType
  resolvedUrl?: string
  commentCount: number
  onClick: () => void
}

const getFileTypeIcon = (type: string, size: string = 'w-8 h-8') => {
  if (type === 'image') return <FileImage className={`${size} text-green-500`} />
  if (type === 'video') return <Video className={`${size} text-blue-500`} />
  if (type === 'model') return <Box className={`${size} text-purple-500`} />
  return <FileImage className={`${size} text-gray-500`} />
}

const getFileTypeLabel = (type: string) => {
  if (type === 'image') return 'Hình ảnh'
  if (type === 'video') return 'Video'
  if (type === 'model') return 'Mô hình 3D'
  return 'Tệp tin'
}

export function FileCard({ file, resolvedUrl, commentCount, onClick }: Props) {
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

    if (file.type === 'video' && effectiveUrl) {
      return (
        <video
          src={effectiveUrl}
          className="w-full h-full object-cover"
          muted
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
      <div className="aspect-video bg-muted/20 relative overflow-hidden">
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
        <h3 className="font-medium text-sm truncate mb-2">{file.name}</h3>
        
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
