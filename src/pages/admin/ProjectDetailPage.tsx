import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProjectStore } from '@/stores/projects'
import { useFileStore } from '@/stores/files'
import { UploadDialog } from '@/components/files/UploadDialog'
import { FilesList } from '@/components/files/FilesList'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ArrowUpDown, Calendar, FileType, Download, Search, X, Share2, Check } from 'lucide-react'
import type { Project } from '@/types'
import { toast } from 'react-hot-toast'
import { ProjectEditDialog } from '@/components/projects/ProjectEditDialog'
import { ProjectShareDialog } from '@/components/dashboard/ProjectShareDialog'

type SortOption = 'name' | 'date' | 'type' | 'size'
type SortDirection = 'asc' | 'desc'

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const { projects } = useProjectStore()
  const { subscribeToFiles, cleanup: cleanupFiles } = useFileStore()
  const [project, setProject] = useState<Project | null>(
    projects.find(p => p.id === projectId) || null
  )
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopyReviewLink = async () => {
    if (!projectId) return

    const reviewUrl = `${window.location.origin}/share/p/${projectId}`

    try {
      await navigator.clipboard.writeText(reviewUrl)
      setCopied(true)
      toast.success('Đã copy link review!')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Không thể copy link')
    }
  }

  useEffect(() => {
    if (projectId) {

      subscribeToFiles(projectId)
    }
    return () => cleanupFiles()
  }, [projectId, subscribeToFiles, cleanupFiles])

  // Subscribe to the specific project document so detail works independently
  useEffect(() => {
    if (!projectId) return
    const ref = doc(db, 'projects', projectId)
    const off = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProject({ id: snap.id, ...(snap.data() as any) })
      } else {
        setProject(null)
      }
    })
    return off
  }, [projectId])

  // Update page title
  useEffect(() => {
    if (project) {
      document.title = `${project.name} | Review System`
    }

    return () => {
      document.title = 'Review System'
    }
  }, [project])


  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(option)
      setSortDirection('desc')
    }
  }

  if (!project) {
    return <div className="text-muted-foreground">Đang tải dự án...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header với Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Trạng thái: {project.status}</p>
        </div>

        <div className="flex items-center gap-2">
          <ProjectEditDialog project={project} />
          <Button
            variant="outline"
            onClick={handleCopyReviewLink}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Đã copy!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share link review</span>
              </>
            )}
          </Button>
          <ProjectShareDialog
            projectId={projectId!}
            resourceName={project.name}
          />
          {projectId && <UploadDialog projectId={projectId} />}
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm file..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Sắp xếp theo:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {sortBy === 'name' && 'Tên file'}
                  {sortBy === 'date' && 'Ngày tải lên'}
                  {sortBy === 'type' && 'Loại file'}
                  {sortBy === 'size' && 'Kích thước'}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({sortDirection === 'asc' ? '↑' : '↓'})
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSort('name')}>
                <FileType className="w-4 h-4 mr-2" />
                Tên file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('date')}>
                <Calendar className="w-4 h-4 mr-2" />
                Ngày tải lên
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('type')}>
                <FileType className="w-4 h-4 mr-2" />
                Loại file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('size')}>
                <Download className="w-4 h-4 mr-2" />
                Kích thước
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6">
          {projectId && <FilesList projectId={projectId} sortBy={sortBy} sortDirection={sortDirection} searchTerm={searchTerm} />}
        </div>
      </div>
    </div>
  )
}
