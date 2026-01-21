import { useEffect, useMemo, useState } from 'react'
import { useFileStore } from '@/stores/files'
import { useCommentStore } from '@/stores/comments'
import { useProjectStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import { FileCardShared } from '@/components/shared/FileCardShared'
import { FileViewDialogShared } from '@/components/shared/FileViewDialogShared'
import { DeleteFileDialog } from './DeleteFileDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { formatFileSize } from '@/lib/utils'
import { Trash2, X, CheckSquare, Square, Grid3x3, List, MessageSquare, Calendar, FileImage, Video, Box, FileText, Download } from 'lucide-react'
import type { File as FileType } from '@/types'
import { useBulkDownload } from '@/hooks/useBulkDownload'
import { DownloadProgressDialog } from '@/components/dashboard/DownloadProgressDialog'

type SortOption = 'name' | 'date' | 'type' | 'size'
type SortDirection = 'asc' | 'desc'
type ViewMode = 'grid' | 'list'

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
  if (type === 'sequence') return 'Image Sequence'
  if (type === 'pdf') return 'PDF'
  return 'Tệp tin'
}

export function FilesList({ projectId, sortBy = 'date', sortDirection = 'desc', searchTerm = '' }: FilesListProps) {
  const { files, switchVersion, deleteFile, deleting, uploadFile, setSequenceViewMode, updateFrameCaption, renameFile, toggleFileLock, selectedFile: storeSelectedFile, selectFile: storeSelectFile } = useFileStore()
  const { comments, subscribeToComments, addComment, toggleResolve, editComment, deleteComment, cleanup: cleanupComments } = useCommentStore()
  const { user } = useAuthStore()
  const project = useProjectStore(s => s.project)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileType | null>(null)
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('reviewUserName') || ''
  })
  const [displayLimit, setDisplayLimit] = useState(20) // Pagination: show 20 files initially

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const {
    handleBulkDownload,
    isDownloading,
    downloadProgress,
    downloadMessage,
    currentDownloadFile
  } = useBulkDownload()

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('filesViewMode') as ViewMode) || 'grid'
  })

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('filesViewMode', viewMode)
  }, [viewMode])

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

  // Auto-update selected file when files array changes (version switch, upload, rename, etc)
  useEffect(() => {
    if (selectedFile && files) {
      const updatedFile = files.find(f => f.id === selectedFile.id)
      if (updatedFile && (
        updatedFile.currentVersion !== selectedFile.currentVersion ||
        updatedFile.name !== selectedFile.name ||
        updatedFile.updatedAt?.toMillis() !== selectedFile.updatedAt?.toMillis()
      )) {
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

  const handleEditComment = async (commentId: string, newContent: string) => {
    await editComment(projectId, commentId, newContent)
  }

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(projectId, commentId)
  }

  const filteredAndSortedFiles = useMemo(() => {
    if (!files) return []

    // Filter by project and exclude trashed files
    let filtered = files.filter(f => f.projectId === projectId && !f.isTrashed)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(file => {
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

  // Multi-select handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => {
      if (prev) {
        // Exiting selection mode, clear selections
        setSelectedFileIds(new Set())
      }
      return !prev
    })
  }

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      return newSet
    })
  }

  const selectAllDisplayed = () => {
    const allIds = displayedFiles.map(f => f.id)
    setSelectedFileIds(new Set(allIds))
  }

  const deselectAllFiles = () => {
    setSelectedFileIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedFileIds.size === 0) return

    setBulkDeleting(true)
    try {
      // Delete files sequentially to avoid overwhelming the server
      for (const fileId of selectedFileIds) {
        await deleteFile(projectId, fileId)
      }

      // Clear selection and close dialog
      setSelectedFileIds(new Set())
      setBulkDeleteDialogOpen(false)
      setIsSelectionMode(false)
    } catch (error) {
      console.error('Bulk delete failed:', error)
    } finally {
      setBulkDeleting(false)
    }
  }

  // REMOVED: Full page spinner during upload to prevent list from disappearing
  // The progress is now handled by UploadDialog or global indicators
  // if (uploading) {
  //   return (
  //     <div className="text-center py-8">
  //       <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
  //         <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
  //         Đang xử lý file...
  //       </div>
  //     </div>
  //   )
  // }

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
      {/* Compact Selection Toolbar */}
      {user && filteredAndSortedFiles.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filteredAndSortedFiles.length} file{filteredAndSortedFiles.length !== 1 ? 's' : ''}</span>
            {isSelectionMode && selectedFileIds.size > 0 && (
              <span className="text-primary font-medium">
                • Đã chọn {selectedFileIds.size}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const filesToDownload = isSelectionMode && selectedFileIds.size > 0
                  ? files.filter(f => selectedFileIds.has(f.id))
                  : filteredAndSortedFiles

                // Add project name to files for zip structure
                const filesWithProject = filesToDownload.map(f => ({ ...f, projectName: 'Project Files' }))
                handleBulkDownload(filesWithProject, comments)
              }}
              className="h-7 px-2 text-xs mr-2"
              title={isSelectionMode && selectedFileIds.size > 0 ? 'Tải xuống đã chọn' : 'Tải xuống tất cả'}
            >
              <Download className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">
                {isSelectionMode && selectedFileIds.size > 0 ? 'Tải đã chọn' : 'Tải tất cả'}
              </span>
            </Button>

            {/* View mode toggle */}
            <div className="flex items-center border rounded-md mr-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-7 px-2 rounded-r-none"
                title="Xem dạng lưới"
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 px-2 rounded-l-none border-l"
                title="Xem dạng danh sách"
              >
                <List className="w-3.5 h-3.5" />
              </Button>
            </div>

            {isSelectionMode ? (
              <>
                {selectedFileIds.size < displayedFiles.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllDisplayed}
                    className="h-7 px-2 text-xs"
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1" />
                    Tất cả
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllFiles}
                    className="h-7 px-2 text-xs"
                  >
                    <Square className="w-3.5 h-3.5 mr-1" />
                    Bỏ chọn
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={selectedFileIds.size === 0}
                  className="h-7 px-2 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Xóa
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectionMode}
                  className="h-7 px-2 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectionMode}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                Chọn
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedFiles.map((file) => {
            const current = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
            const urlKey = getKey(file.id, current?.version ?? 1)
            const effectiveUrl = resolvedUrls[urlKey] ?? current?.url
            const commentCount = getCommentCount(file.id, file.currentVersion)
            const isSelected = selectedFileIds.has(file.id)

            return (
              <div key={file.id} className="relative">
                {/* Selection checkbox overlay - positioned at top-right to avoid badge */}
                {isSelectionMode && (
                  <div
                    className={`absolute top-2 right-2 z-10 transition-all ${isSelected ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                      className="h-5 w-5 bg-background border-2 shadow-sm"
                    />
                  </div>
                )}

                {/* Selection highlight */}
                <div className={`rounded-lg transition-all ${isSelectionMode && isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                  <FileCardShared
                    file={file}
                    resolvedUrl={effectiveUrl}
                    commentCount={commentCount}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleFileSelection(file.id)
                      } else {
                        handleFileClick(file)
                      }
                    }}
                    onDelete={user && !isSelectionMode ? () => handleDeleteClick(file) : undefined}
                    onToggleLock={user && !isSelectionMode ? () => toggleFileLock(projectId, file.id, !file.isCommentsLocked) : undefined}
                    isLocked={file.isCommentsLocked}
                    isAdmin={!!user}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-1">
          {displayedFiles.map((file) => {
            const current = file.versions.find(v => v.version === file.currentVersion) || file.versions[0]
            const urlKey = getKey(file.id, current?.version ?? 1)
            const effectiveUrl = resolvedUrls[urlKey] ?? current?.url
            const commentCount = getCommentCount(file.id, file.currentVersion)
            const isSelected = selectedFileIds.has(file.id)

            // Render thumbnail based on file type
            const renderListThumbnail = () => {
              // Image files
              if (file.type === 'image' && effectiveUrl) {
                return (
                  <img
                    src={effectiveUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )
              }

              // Sequence files - show first frame with badge
              if (file.type === 'sequence' && effectiveUrl) {
                return (
                  <div className="relative w-full h-full">
                    <img
                      src={effectiveUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <Badge
                      variant="secondary"
                      className="absolute bottom-1 right-1 text-[10px] px-1 py-0 h-4 backdrop-blur-sm bg-black/60 text-white border-0"
                    >
                      {current?.frameCount || 0}f
                    </Badge>
                  </div>
                )
              }

              // Video files - show as static thumbnail with play icon overlay
              if (file.type === 'video' && effectiveUrl) {
                return (
                  <div className="relative w-full h-full bg-muted">
                    {/* Use img instead of video for better performance and no autoplay issues */}
                    <img
                      src={effectiveUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Video className="w-6 h-6 text-white drop-shadow" />
                    </div>
                  </div>
                )
              }

              // Model files - show thumbnail if available, otherwise icon
              if (file.type === 'model') {
                if (current?.thumbnailUrl) {
                  return (
                    <img
                      src={current.thumbnailUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )
                }
                return (
                  <div className="w-full h-full flex items-center justify-center bg-purple-100 dark:bg-purple-950/30">
                    <Box className="w-8 h-8 text-purple-500" />
                  </div>
                )
              }

              // PDF files - show thumbnail if available, otherwise icon
              if (file.type === 'pdf') {
                if (current?.thumbnailUrl) {
                  return (
                    <img
                      src={current.thumbnailUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )
                }
                return (
                  <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-950/30">
                    <FileText className="w-8 h-8 text-red-500" />
                  </div>
                )
              }

              // Fallback for unknown types
              return (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <FileImage className="w-8 h-8 text-muted-foreground" />
                </div>
              )
            }

            return (
              <div
                key={file.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${isSelectionMode && isSelected ? 'ring-2 ring-primary ring-offset-1 bg-primary/5' : ''
                  }`}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleFileSelection(file.id)
                  } else {
                    handleFileClick(file)
                  }
                }}
              >
                {/* Checkbox */}
                {isSelectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleFileSelection(file.id)}
                    className="h-4 w-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                {/* Thumbnail */}
                <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0 relative">
                  {renderListThumbnail()}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{file.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                      {getFileTypeLabel(file.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {file.createdAt.toDate().toLocaleDateString('vi-VN')}
                    </span>
                    <span>{formatFileSize(current?.metadata.size || 0)}</span>
                    {file.versions.length > 1 && (
                      <span>v{file.currentVersion} ({file.versions.length} phiên bản)</span>
                    )}
                    {commentCount > 0 && (
                      <span className="flex items-center gap-1 text-primary">
                        <MessageSquare className="w-3 h-3" />
                        {commentCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {user && !isSelectionMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(file)
                    }}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

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
          onEditComment={user ? handleEditComment : undefined}
          onDeleteComment={user ? handleDeleteComment : undefined}
          onRenameFile={user ? async (fileId, newName) => await renameFile(projectId, fileId, newName) : undefined}
          project={project || undefined}
          isArchived={project?.status === 'archived'}
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

      {/* Bulk delete confirmation dialog */}
      <DeleteFileDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        fileName={`${selectedFileIds.size} file đã chọn`}
        loading={bulkDeleting}
      />
      <DownloadProgressDialog
        open={isDownloading}
        progress={downloadProgress}
        message={downloadMessage}
        fileName={currentDownloadFile}
      />
    </>
  )
}
