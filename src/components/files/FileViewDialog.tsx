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
  MessageSquare,
  Share2,
  Check,
  Copy,
  MoreHorizontal,
  ShieldAlert,
  Loader2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { GLBViewer } from '@/components/viewers/GLBViewer'
import { AddComment } from '@/components/comments/AddComment'
import { CommentsList } from '@/components/comments/CommentsList'
import { useCommentStore } from '@/stores/comments'
import { useAuthStore } from '@/stores/auth'
import toast from 'react-hot-toast'

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
  const [copied, setCopied] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Generate shareable link for this file
  const getShareLink = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/share/p/${projectId}/file/${file?.id}`
  }

  const copyShareLink = async () => {
    const link = getShareLink()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Đã sao chép link chia sẻ!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Không thể sao chép link')
    }
  }

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

    // Check validation status
    if (current?.validationStatus === 'infected') {
      return (
        <div className="aspect-video bg-destructive/10 flex items-center justify-center p-6">
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

    if (current?.validationStatus === 'pending') {
      return (
        <div className="aspect-video bg-muted/20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-lg">Đang kiểm tra bảo mật...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Hệ thống đang quét virus và kiểm tra định dạng file.
                <br />Vui lòng đợi trong giây lát.
              </p>
            </div>
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
              {/* Desktop: Version selector */}
              {file.versions.length > 1 && onSwitchVersion && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="hidden sm:flex">
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

              {/* Desktop: Download button */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex"
                onClick={(e) => {
                  e.stopPropagation()
                  effectiveUrl && window.open(effectiveUrl, '_blank')
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Tải xuống
              </Button>

              {/* Desktop: Share button */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Share2 className="w-4 h-4 mr-2" />
                    Chia sẻ
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

              {/* Mobile: Dropdown menu with all actions */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {file.versions.length > 1 && onSwitchVersion && (
                      <>
                        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                          Phiên bản
                        </div>
                        {file.versions.map(v => (
                          <DropdownMenuItem
                            key={v.version}
                            onClick={() => onSwitchVersion(file.id, v.version)}
                            className={v.version === file.currentVersion ? 'bg-accent' : ''}
                          >
                            V{v.version} {v.version === file.currentVersion && '(hiện tại)'}
                          </DropdownMenuItem>
                        ))}
                        <div className="h-px bg-border my-1" />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => effectiveUrl && window.open(effectiveUrl, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Tải xuống
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyShareLink}>
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2 text-green-500" />
                          Đã sao chép link!
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 mr-2" />
                          Chia sẻ link
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
