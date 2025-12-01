import { useEffect, useMemo, useState } from 'react'
import { useFileStore } from '@/stores/files'
import { useCommentStore } from '@/stores/comments'
import { useAuthStore } from '@/stores/auth'
import { FileCardShared } from '@/components/shared/FileCardShared'
import { FileViewDialogShared } from '@/components/shared/FileViewDialogShared'
import { DeleteFileDialog } from './DeleteFileDialog'
import { Button } from '@/components/ui/button'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import type { File as FileType } from '@/types'

type SortOption = 'name' | 'date' | 'type' | 'size'
type SortDirection = 'asc' | 'desc'

interface FilesListProps {
  projectId: string
  sortBy?: SortOption
  sortDirection?: SortDirection
  searchTerm?: string
}

const getFileTypeLabel = (type: string) => {
  if (type === 'image') return 'Hình ảnh'
  if (type === 'video') return 'Video'
  if (type === 'model') return 'Mô hình 3D'
  return 'Tệp tin'
}

export function FilesList({ projectId, sortBy = 'date', sortDirection = 'desc', searchTerm = '' }: FilesListProps) {
  const { files, switchVersion, uploading, deleteFile, deleting, uploadFile, setSequenceViewMode, updateFrameCaption, selectedFile: storeSelectedFile, selectFile: storeSelectFile } = useFileStore()
  const { comments, subscribeToComments, addComment, toggleResolve, cleanup: cleanupComments } = useCommentStore()
  const { user } = useAuthStore()
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileType | null>(null)
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('reviewUserName') || ''
  })
  const [displayLimit, setDisplayLimit] = useState(20) // Pagination: show 20 files initially

  const getKey = (fileId: string, version: number) => `${fileId}-v${version}`

  const ensureDownloadUrl = async (fileId: string, version: number, storagePath: string, currentUrl?: string) => {
    const key = getKey(fileId, version)
    if (resolvedUrls[key]) return resolvedUrls[key]

    const needsFix = currentUrl?.includes('firebasestorage.app')
    if (!needsFix) return currentUrl

    try {
      const url = await getDownloadURL(ref(storage, storagePath))
      setResolvedUrls(prev => ({ ...prev, [key]: url }))
      return url
    } catch (e: any) {
      // Only log warnings for actual errors, ignore 404s as we fall back to existing URL
      if (e.code === 'storage/object-not-found') {
        // console.warn(`File not found in storage: ${storagePath}. Using existing URL.`)
      } else {
        console.warn('Failed to refresh URL:', e)
      }
      return currentUrl
    }
  }

  // Fix invalid legacy download URLs once per file-version
  useEffect(() => {
    const run = async () => {
      const tasks: Promise<any>[] = []
      for (const f of files || []) {
        const current = f.versions.find(v => v.version === f.currentVersion) || f.versions[0]
        if (!current?.url || !current?.metadata?.name) continue

        // Skip if URL already has a token (likely valid)
        if (current.url.includes('token=')) continue

        const key = getKey(f.id, current.version)
        if (resolvedUrls[key]) continue
        if (!current.url.includes('firebasestorage.app')) continue

        const storagePath = `projects/${projectId}/${f.id}/v${current.version}/${current.metadata.name}`
        tasks.push(ensureDownloadUrl(f.id, current.version, storagePath, current.url))
      }
      if (tasks.length) {
        await Promise.allSettled(tasks)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, projectId])

  // Subscribe to comments for this project
  useEffect(() => {
    subscribeToComments(projectId)
    return () => cleanupComments()
  }, [projectId, subscribeToComments, cleanupComments])

  // Sync with store selectedFile (for external triggers like notifications)
  useEffect(() => {
    if (storeSelectedFile && storeSelectedFile.projectId === projectId) {
      setSelectedFile(storeSelectedFile)
      setDialogOpen(true)
      // Clear store selection after opening
      setTimeout(() => storeSelectFile(null), 100)
    }
  }, [storeSelectedFile, projectId, storeSelectFile])

  // Auto-update selected file when files array changes (version switch, upload, etc)
  useEffect(() => {
    if (selectedFile && files) {
      const updatedFile = files.find(f => f.id === selectedFile.id)
      if (updatedFile && updatedFile.currentVersion !== selectedFile.currentVersion) {
        setSelectedFile({ ...updatedFile })
      }
    }
  }, [files, selectedFile])

  // Get comment count for a file
  const getCommentCount = (fileId: string, version: number) => {
    return comments.filter(c => c.fileId === fileId && c.version === version).length
  }

  // Handle file card click
  const handleFileClick = (file: FileType) => {
    setSelectedFile(file)
    setDialogOpen(true)
  }

  // Handle version switch in dialog
  const handleSwitchVersion = async (fileId: string, version: number) => {
    await switchVersion(fileId, version)
    // Update selected file to reflect new version after store updates
    const updatedFile = files?.find(f => f.id === fileId)
    if (updatedFile) {
      setSelectedFile({ ...updatedFile })
    }
  }

  const handleUserNameChange = (name: string) => {
    setCurrentUserName(name)
    localStorage.setItem('reviewUserName', name)
  }

  const handleAddComment = async (userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => {
    if (selectedFile) {
      await addComment(projectId, selectedFile.id, selectedFile.currentVersion, userName, content, timestamp, parentCommentId, annotationData, attachments)
    }
  }

  const handleResolveToggle = (commentId: string, isResolved: boolean) => {
    if (user) {
      toggleResolve(projectId, commentId, isResolved)
    }
  }

  const handleDeleteClick = (file: FileType) => {
    setFileToDelete(file)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      try {
        await deleteFile(projectId, fileToDelete.id)
        setDeleteDialogOpen(false)
        setFileToDelete(null)
        // Close view dialog if it's the deleted file
        if (selectedFile?.id === fileToDelete.id) {
          setDialogOpen(false)
          setSelectedFile(null)
        }
      } catch (error) {
        // Error is handled in store
      }
    }
  }

  const handleUploadNewVersion = async (newFile: File, existingFileId: string) => {
    if (user) {
      try {
        await uploadFile(projectId, newFile, existingFileId)
      } catch (error) {
        // Error is handled in store
      }
    }
  }

  const handleSequenceViewModeChange = async (fileId: string, mode: 'video' | 'carousel' | 'grid') => {
    await setSequenceViewMode(projectId, fileId, mode)
  }

  const handleCaptionChange = async (fileId: string, version: number, frame: number, caption: string) => {
    await updateFrameCaption(projectId, fileId, version, frame, caption)
  }
  const filteredAndSortedFiles = useMemo(() => {
    if (!files) return []

    // First filter by search term
    let filtered = files
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      filtered = files.filter(file => {
        const matchesName = file.name.toLowerCase().includes(term)
        const matchesType = getFileTypeLabel(file.type).toLowerCase().includes(term)
        const currentVersion = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
        const matchesFileName = currentVersion?.metadata.name.toLowerCase().includes(term)

        return matchesName || matchesType || matchesFileName
      })
    }

    // Then sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let compareValue = 0

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name)
          break
        case 'date':
          compareValue = a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
          break
        case 'type':
          compareValue = a.type.localeCompare(b.type)
          break
        case 'size': {
          const aVersion = a.versions.find(v => v.version === a.currentVersion) || a.versions[0]
          const bVersion = b.versions.find(v => v.version === b.currentVersion) || b.versions[0]
          const aSize = aVersion?.metadata.size || 0
          const bSize = bVersion?.metadata.size || 0
          compareValue = aSize - bSize
          break
        }
        default:
          return 0
      }

      return sortDirection === 'asc' ? compareValue : -compareValue
    })

    return sorted
  }, [files, sortBy, sortDirection, searchTerm])

  // Paginated files
  const displayedFiles = filteredAndSortedFiles.slice(0, displayLimit)
  const hasMore = filteredAndSortedFiles.length > displayLimit

  if (uploading) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          Đang xử lý file...
        </div>
      </div>
    )
  }

  if (!filteredAndSortedFiles.length) {
    if (searchTerm.trim()) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-lg mb-2">Không tìm thấy kết quả</div>
          <div className="text-sm">Thử tìm kiếm với từ khóa khác</div>
        </div>
      )
    }
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
          <span className="text-2xl">📁</span>
        </div>
        <div className="text-lg font-medium mb-2">Chưa có tài liệu nào</div>
        <div className="text-sm text-muted-foreground">Hãy tải lên file đầu tiên cho dự án này</div>
      </div>
    )
  }

  return (
    <>
      {/* Grid of file cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayedFiles.map((file) => {
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
              onDelete={user ? () => handleDeleteClick(file) : undefined}
              isAdmin={!!user}
            />
          )
        })}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={() => setDisplayLimit(prev => prev + 20)}
            className="gap-2"
          >
            Xem thêm ({filteredAndSortedFiles.length - displayLimit} files)
          </Button>
        </div>
      )}

      {/* File view dialog */}
      {selectedFile && (
        <FileViewDialogShared
          file={selectedFile}
          projectId={projectId}
          resolvedUrl={resolvedUrls[getKey(selectedFile.id, selectedFile.currentVersion)]}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSwitchVersion={handleSwitchVersion}
          onUploadNewVersion={user ? handleUploadNewVersion : undefined}
          onSequenceViewModeChange={user ? handleSequenceViewModeChange : undefined}
          comments={comments}
          currentUserName={currentUserName}
          onUserNameChange={handleUserNameChange}
          onAddComment={handleAddComment}
          onResolveToggle={user ? handleResolveToggle : undefined}

          isAdmin={!!user}
          onCaptionChange={user ? handleCaptionChange : undefined}
        />
      )}

      {/* Delete confirmation dialog */}
      {fileToDelete && (
        <DeleteFileDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          fileName={fileToDelete.name}
          loading={deleting}
        />
      )}
    </>
  )
}
