import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProjectStore } from '@/stores/projects'
import { useFileStore } from '@/stores/files'
import { useCommentStore } from '@/stores/comments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileCardShared } from '@/components/shared/FileCardShared'
import { FileViewDialogShared } from '@/components/shared/FileViewDialogShared'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import type { File as FileType } from '@/types'

export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { project, fetchProject } = useProjectStore()
  const { files, subscribeToFiles, switchVersion, cleanup: cleanupFiles } = useFileStore()
  const { comments, subscribeToComments, addComment, cleanup: cleanupComments } = useCommentStore()
  
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('reviewUserName') || ''
  })
  const [loading, setLoading] = useState(true)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const getKey = (fileId: string, version: number) => `${fileId}-v${version}`

  // Try to fix legacy/bad URLs by extracting the object path from the URL
  const extractStoragePathFromUrl = (url?: string): string | null => {
    if (!url) return null
    // Firebase download URL format: .../o/<ENCODED_PATH>?...
    const marker = '/o/'
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    const after = url.substring(idx + marker.length)
    const endIdx = after.indexOf('?')
    const encodedPath = endIdx === -1 ? after : after.substring(0, endIdx)
    try {
      return decodeURIComponent(encodedPath)
    } catch {
      return null
    }
  }

  const ensureDownloadUrl = async (fileId: string, version: number, storagePath: string, currentUrl?: string) => {
    const key = getKey(fileId, version)
    if (resolvedUrls[key]) return resolvedUrls[key]
    
    const needsFix = currentUrl?.includes('firebasestorage.app')
    if (!needsFix) return currentUrl
    
    try {
      // Prefer extracting the exact object path from the existing URL (more robust
      // for sequences or legacy uploads where metadata.name doesn't match).
      const extractedPath = extractStoragePathFromUrl(currentUrl)
      const targetPath = extractedPath || storagePath
      const url = await getDownloadURL(ref(storage, targetPath))
      setResolvedUrls(prev => ({ ...prev, [key]: url }))
      return url
    } catch (e) {
      console.error('Failed to fix URL:', e)
      return currentUrl
    }
  }

  useEffect(() => {
    if (!projectId) return

    const load = async () => {
      setLoading(true)
      try {
        await fetchProject(projectId)
        subscribeToFiles(projectId)
        subscribeToComments(projectId)
      } catch (error) {
        console.error('Failed to load project:', error)
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => {
      cleanupFiles()
      cleanupComments()
    }
  }, [projectId, fetchProject, subscribeToFiles, subscribeToComments, cleanupFiles, cleanupComments])

  // Fix URLs for files
  useEffect(() => {
    const run = async () => {
      const tasks: Promise<any>[] = []
      for (const f of files || []) {
        const current = f.versions.find(v => v.version === f.currentVersion) || f.versions[0]
        if (!current?.url) continue
        const key = getKey(f.id, current.version)
        if (resolvedUrls[key]) continue
        if (!current.url.includes('firebasestorage.app')) continue
        // Build a best-effort storagePath as fallback; prefer extracting from URL inside ensureDownloadUrl
        const fallbackPath = `projects/${projectId}/${f.id}/v${current.version}/${current.metadata.name}`
        tasks.push(ensureDownloadUrl(f.id, current.version, fallbackPath, current.url))
      }
      if (tasks.length) {
        await Promise.allSettled(tasks)
      }
    }
    run()
  }, [files, projectId, resolvedUrls])

  // Show name prompt if user doesn't have a name
  useEffect(() => {
    if (!loading && !currentUserName) {
      setShowNamePrompt(true)
    }
  }, [loading, currentUserName])

  // Auto-update selected file when files array changes (version switch, etc)
  useEffect(() => {
    if (selectedFile && files) {
      const updatedFile = files.find(f => f.id === selectedFile.id)
      if (updatedFile && updatedFile.currentVersion !== selectedFile.currentVersion) {
        setSelectedFile({ ...updatedFile })
      }
    }
  }, [files, selectedFile])

  const handleUserNameChange = (name: string) => {
    setCurrentUserName(name)
    localStorage.setItem('reviewUserName', name)
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = (e.target as HTMLFormElement).elements.namedItem('userName') as HTMLInputElement
    const name = input.value.trim()
    if (name) {
      handleUserNameChange(name)
      setShowNamePrompt(false)
    }
  }

  // Get comment count for a file
  const getCommentCount = (fileId: string, version: number) => {
    return comments.filter(c => c.fileId === fileId && c.version === version).length
  }

  // Handle file card click
  const handleFileClick = (file: FileType) => {
    setSelectedFile(file)
    setDialogOpen(true)
  }

  const handleAddComment = async (userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => {
    if (selectedFile) {
      await addComment(projectId!, selectedFile.id, selectedFile.currentVersion, userName, content, timestamp, parentCommentId, annotationData, attachments)
    }
  }

  const handleSwitchVersion = async (fileId: string, version: number) => {
    await switchVersion(fileId, version)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Đang tải dự án...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold">Không tìm thấy dự án</p>
          <p className="text-muted-foreground">Link review không hợp lệ hoặc dự án đã bị xóa</p>
        </div>
      </div>
    )
  }

  const projectFiles = files.filter(f => f.projectId === projectId)

  return (
    <div className="min-h-screen bg-background">
      {/* UserName Prompt Dialog */}
      <Dialog open={showNamePrompt} onOpenChange={setShowNamePrompt}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Chào mừng đến với Review</DialogTitle>
            <DialogDescription>
              Vui lòng nhập tên của bạn để tiếp tục xem và bình luận
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <Input
              name="userName"
              placeholder="Nhập tên của bạn..."
              required
              autoFocus
              className="w-full"
            />
            <Button type="submit" className="w-full">
              Tiếp tục
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Review công khai</span>
                <span>•</span>
                <span>{projectFiles.length} tệp tin</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {projectFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
            <div className="text-lg font-medium mb-2">Chưa có tài liệu nào</div>
            <div className="text-sm text-muted-foreground">Dự án chưa có file nào được tải lên</div>
          </div>
        ) : (
          <>
            {/* Grid of file cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projectFiles.map((file) => {
                const current = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
                const urlKey = getKey(file.id, current?.version ?? 1)
                const effectiveUrl = resolvedUrls[urlKey] ?? current?.url
                const commentCount = getCommentCount(file.id, file.currentVersion)

                return (
                  <FileCardShared
                    key={file.id}
                    file={file}
                    resolvedUrl={effectiveUrl}
                    commentCount={commentCount}
                    onClick={() => handleFileClick(file)}
                  />
                )
              })}
            </div>

            {/* File view dialog */}
            {selectedFile && (
              <FileViewDialogShared
                file={selectedFile}
                projectId={projectId!}
                resolvedUrl={resolvedUrls[getKey(selectedFile.id, selectedFile.currentVersion)]}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSwitchVersion={handleSwitchVersion}
                comments={comments}
                currentUserName={currentUserName}
                onUserNameChange={handleUserNameChange}
                onAddComment={handleAddComment}
                isAdmin={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
