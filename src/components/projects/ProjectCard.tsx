import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProjectStore } from '@/stores/projects'
import { useNavigate } from 'react-router-dom'
import { useProjectThumbnail } from '@/hooks/useProjectThumbnail'
import { useFileStore } from '@/stores/files'
import type { Project } from '@/types'
import { ProjectEditDialog } from './ProjectEditDialog'
import { ProjectDeleteDialog } from './ProjectDeleteDialog'
import { ProjectArchiveDialog } from './ProjectArchiveDialog'
import { formatFileSize } from '@/lib/utils'
import { Calendar, User, Mail, AlertCircle, MoreVertical, Archive, ArchiveRestore, Image as ImageIcon, HardDrive, Play, Lock, Unlock } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ViewMode = 'list' | 'thumbnails'

export function ProjectCard({ project, viewMode = 'list' }: { project: Project; viewMode?: ViewMode }) {
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const { updateProject } = useProjectStore()
  const navigate = useNavigate()

  const { thumbnailData } = useProjectThumbnail(project.id)
  const allFiles = useFileStore(s => s.files)

  const created = project.createdAt?.toDate ? project.createdAt.toDate() : new Date()
  const deadline = project.deadline?.toDate ? project.deadline.toDate() : null
  const isOverdue = deadline && deadline < new Date()

  // Memoize filtered files to prevent infinite loop
  const files = useMemo(() => allFiles.filter(f => f.projectId === project.id), [allFiles, project.id])

  // Calculate total file size
  const totalSize = useMemo(() => {
    return files.reduce((total, file) => {
      const fileSize = file.versions.reduce((sum, version) => sum + (version.metadata.size || 0), 0)
      return total + fileSize
    }, 0)
  }, [files])

  if (viewMode === 'thumbnails') {
    return (
      <>
        <div
          className="rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden"
          onClick={() => navigate(`/app/projects/${project.id}`)}
        >
          {/* Thumbnail Image */}
          <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
            {thumbnailData ? (
              thumbnailData.type === 'video' ? (
                <div className="relative w-full h-full group-hover:scale-105 transition-transform duration-300 bg-black">
                  <video
                    src={thumbnailData.url}
                    className="w-full h-full object-cover opacity-90"
                    muted
                    loop
                    playsInline
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                      <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={thumbnailData.url}
                  alt={project.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 text-primary/40">
                <ImageIcon className="h-12 w-12" />
                <span className="text-xs">Chưa có file</span>
              </div>
            )}
            <div className="absolute top-2 right-2 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur-sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ProjectEditDialog project={project} triggerAsMenuItem />
                  <DropdownMenuSeparator />
                  {project.status === 'active' ? (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      setIsArchiveDialogOpen(true)
                    }}>
                      <Archive className="h-4 w-4 mr-2" />
                      Lưu trữ
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      updateProject(project.id, { status: 'active' })
                    }}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Khôi phục
                    </DropdownMenuItem>

                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    const updateLock = useProjectStore.getState().toggleProjectLock
                    updateLock(project.id, !project.isCommentsLocked)
                  }}>
                    {project.isCommentsLocked ? (
                      <>
                        <Unlock className="h-4 w-4 mr-2" />
                        Mở khóa bình luận
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Khóa bình luận
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ProjectDeleteDialog project={project} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-4">
            {/* Project Name */}
            <h3 className="text-base font-semibold mb-2 line-clamp-2 min-h-[48px]">
              {project.name}
            </h3>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {project.description}
              </p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-1 mb-3">
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {project.status === 'active' ? 'Hoạt động' : 'Lưu trữ'}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  Quá hạn
                </Badge>
              )}
            </div>

            {/* Tags */}
            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {project.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {project.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{project.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Footer Info */}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-3 border-t">
              {project.clientName && (
                <div className="flex items-center gap-1 truncate">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{project.clientName}</span>
                </div>
              )}
              {deadline && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span>{format(deadline, 'dd/MM/yyyy', { locale: vi })}</span>
                </div>
              )}
              {files.length > 0 && (
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3 flex-shrink-0" />
                  <span>{formatFileSize(totalSize)}</span>
                </div>
              )}
            </div>
          </div>
        </div >
        <ProjectArchiveDialog
          project={project}
          open={isArchiveDialogOpen}
          onOpenChange={setIsArchiveDialogOpen}
        />
      </>
    )
  }

  return (
    <>
      <div className="rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                {project.status === 'active' ? 'Đang hoạt động' : 'Đã lưu trữ'}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Quá hạn
                </Badge>
              )}
            </div>

            {project.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Tạo: {format(created, 'dd/MM/yyyy', { locale: vi })}</span>

              {project.clientName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {project.clientName}
                </span>
              )}

              {project.clientEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {project.clientEmail}
                </span>
              )}

              {deadline && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                  <Calendar className="h-3 w-3" />
                  Deadline: {format(deadline, 'dd/MM/yyyy', { locale: vi })}
                </span>
              )}

              {files.length > 0 && (
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(totalSize)}
                </span>
              )}
              {project.isCommentsLocked && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Lock className="h-3 w-3" />
                  Đã khóa bình luận
                </span>
              )}
            </div>

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {project.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="secondary" onClick={() => navigate(`/app/projects/${project.id}`)}>
              Mở
            </Button>

            <ProjectEditDialog project={project} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {project.status === 'active' ? (
                  <DropdownMenuItem onClick={() => setIsArchiveDialogOpen(true)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Lưu trữ
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => updateProject(project.id, { status: 'active' })}>
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Khôi phục
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  const updateLock = useProjectStore.getState().toggleProjectLock
                  updateLock(project.id, !project.isCommentsLocked)
                }}>
                  {project.isCommentsLocked ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Mở khóa bình luận
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Khóa bình luận
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ProjectDeleteDialog project={project} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <ProjectArchiveDialog
        project={project}
        open={isArchiveDialogOpen}
        onOpenChange={setIsArchiveDialogOpen}
      />
    </>
  )
}
