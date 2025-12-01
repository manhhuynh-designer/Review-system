import { useState, useRef, Suspense } from 'react'
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
import { 
  Download, 
  Clock, 
  FileImage, 
  Video, 
  Box,
  ChevronDown,
  MessageSquare
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GLBViewer } from '@/components/viewers/GLBViewer'
import { AddComment } from '@/components/comments/AddComment'
import { CommentsList } from '@/components/comments/CommentsList'
import { useCommentStore } from '@/stores/comments'
import { useAuthStore } from '@/stores/auth'

interface Props {
  file: FileType | null
  projectId: string
  resolvedUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchVersion?: (fileId: string, version: number) => void
}

const getFileTypeIcon = (type: string) => {
  if (type === 'image') return <FileImage className="w-5 h-5 text-green-500" />
  if (type === 'video') return <Video className="w-5 h-5 text-blue-500" />
  if (type === 'model') return <Box className="w-5 h-5 text-purple-500" />
  return <FileImage className="w-5 h-5 text-gray-500" />
}

const getFileTypeLabel = (type: string) => {
  if (type === 'image') return 'Hình ảnh'
  if (type === 'video') return 'Video'
  if (type === 'model') return 'Mô hình 3D'
  return 'Tệp tin'
}

export function FileViewDialog({ file, projectId, resolvedUrl, open, onOpenChange, onSwitchVersion }: Props) {
  const { comments, addComment, toggleResolve } = useCommentStore()
  const { user } = useAuthStore()
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('reviewUserName') || ''
  })
  const [showComments, setShowComments] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  if (!file) return null

  const current = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
  const effectiveUrl = resolvedUrl || current?.url
  const uploadDate = current?.uploadedAt?.toDate ? current.uploadedAt.toDate() : new Date()
  
  const fileComments = comments.filter(c => c.fileId === file.id && c.version === file.currentVersion)

  const handleUserNameChange = (name: string) => {
    setCurrentUserName(name)
    localStorage.setItem('reviewUserName', name)
  }

  const handleTimestampClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp
      videoRef.current.play()
    }
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

    if (file.type === 'image') {
      return (
        <div className="relative bg-muted/20">
          <img
            src={effectiveUrl}
            alt={file.name}
            className="w-full h-auto max-h-[55vh] xl:max-h-[50vh] 2xl:max-h-[45vh] object-contain mx-auto"
          />
        </div>
      )
    }

    if (file.type === 'video') {
      return (
        <div className="relative bg-black">
          <video
            ref={videoRef}
            src={effectiveUrl}
            controls
            className="w-full h-auto max-h-[55vh] xl:max-h-[50vh] 2xl:max-h-[45vh] mx-auto"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
        </div>
      )
    }

    if (file.type === 'model') {
      return (
        <div className="h-[70vh] bg-muted/20">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Đang tải mô hình 3D...</p>
              </div>
            </div>
          }>
            <GLBViewer url={effectiveUrl} />
          </Suspense>
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {getFileTypeIcon(file.type)}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base truncate">{file.name}</DialogTitle>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {getFileTypeLabel(file.type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(current?.metadata?.size || 0)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(uploadDate, 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Version selector */}
              {file.versions.length > 1 && onSwitchVersion && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      V{file.currentVersion}
                      <ChevronDown className="w-3 h-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {file.versions.map(v => (
                      <DropdownMenuItem
                        key={v.version}
                        onClick={() => onSwitchVersion(file.id, v.version)}
                        className={v.version === file.currentVersion ? 'bg-accent' : ''}
                      >
                        Version {v.version}
                        {v.version === file.currentVersion && ' (hiện tại)'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Download button */}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  effectiveUrl && window.open(effectiveUrl, '_blank')
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Tải xuống
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content - Split view */}
        <div className="flex h-[calc(95vh-100px)] min-h-0">
          {/* File Preview - Left side */}
          <div className="flex-1 overflow-auto">
            {renderFilePreview()}
          </div>

          {/* Comments - Right sidebar */}
          <div className="w-96 border-l flex flex-col bg-muted/10 min-h-0">
            {/* Comments header */}
            <div className="p-4 border-b bg-background shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Góp ý ({fileComments.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComments(!showComments)}
                >
                  {showComments ? 'Ẩn' : 'Hiện'}
                </Button>
              </div>
            </div>

            {showComments && (
              <>
                {/* Comments list */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {fileComments.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Chưa có góp ý nào. Hãy là người đầu tiên!
                    </div>
                  ) : (
                    <CommentsList
                      comments={fileComments}
                      onTimestampClick={file.type === 'video' ? handleTimestampClick : undefined}
                      onResolveToggle={user ? (commentId, isResolved) => toggleResolve(projectId, commentId, isResolved) : undefined}
                    />
                  )}
                </div>

                {/* Add comment form */}
                <div className="p-4 border-t bg-background shrink-0">
                  <AddComment
                    userName={currentUserName}
                    onUserNameChange={handleUserNameChange}
                    onSubmit={(userName, content, timestamp, parentId, annotationData) => 
                      addComment(projectId, file.id, file.currentVersion, userName, content, timestamp, parentId, annotationData)
                    }
                    currentTimestamp={file.type === 'video' ? currentTime : undefined}
                    showTimestamp={file.type === 'video'}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
