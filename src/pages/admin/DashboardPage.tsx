import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/files'
import { useProjectStore } from '@/stores/projects'
import { useCommentStore } from '@/stores/comments'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw } from 'lucide-react'
import { StorageOverviewCard } from '@/components/dashboard/StorageOverviewCard'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { StorageChart } from '@/components/dashboard/StorageChart'
import { DataTable } from '@/components/dashboard/DataTable'
import { DeleteConfirmDialog } from '@/components/dashboard/DeleteConfirmDialog'
import { ExportDataDialog } from '@/components/dashboard/ExportDataDialog'
import { RecentCommentsCard } from '@/components/dashboard/RecentCommentsCard'
import { FileViewDialogShared } from '@/components/shared/FileViewDialogShared'
import { formatBytes, calculateTotalSize } from '@/lib/storageUtils'
import type { File as FileType, Comment } from '@/types'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { DownloadProgressDialog } from '@/components/dashboard/DownloadProgressDialog'

interface FileWithProject extends FileType {
    projectName?: string
    projectStatus?: 'active' | 'archived'
}

// Helper functions for file extensions
const getFileExtension = (url: string, mimeType?: string, fileType?: string): string => {
    // Try to extract from URL first (works for direct storage paths)
    // Firebase URLs often have format: ...%2Ffilename.ext?alt=media&token=...
    // So we need to decode and extract the extension
    let urlMatch = url.match(/\.([^./?#]+)(?=[?#]|$)/)
    
    if (!urlMatch && url.includes('%2F')) {
        // Try to find extension in encoded URL path
        const decoded = decodeURIComponent(url.split('?')[0])
        urlMatch = decoded.match(/\.([^./?#]+)$/)
    }
    
    if (urlMatch) {
        const ext = urlMatch[1].toLowerCase()
        if (ext === 'jpeg') return '.jpg'
        return `.${ext}`
    }
    
    if (mimeType) {
        const mimeMap: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/quicktime': '.mov',
            'video/x-msvideo': '.avi',
            'application/pdf': '.pdf',
            'model/gltf-binary': '.glb',
            'model/gltf+json': '.gltf',
            'application/octet-stream': '' // Generic binary, can't determine extension
        }
        
        if (mimeMap[mimeType]) return mimeMap[mimeType]
        
        // Fallback: extract from MIME type
        const ext = mimeType.split('/')[1]?.split('+')[0]?.split(';')[0]
        if (ext && ext !== 'octet-stream') {
            return `.${ext.replace('jpeg', 'jpg')}`
        }
    }
    
    // Fallback based on file type
    const typeMap: Record<string, string> = {
        'image': '.jpg',
        'video': '.mp4',
        'pdf': '.pdf',
        'model': '.glb',
        'sequence': '.jpg'
    }
    
    return typeMap[fileType || ''] || ''
}

const ensureFileExtension = (filename: string, url: string, mimeType?: string, fileType?: string): string => {
    const correctExt = getFileExtension(url, mimeType, fileType)
    
    // If no extension found from any source, return as is
    if (!correctExt) {
        console.warn(`No extension found for file: ${filename}`)
        return filename
    }
    
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(filename)
    if (hasExtension) {
        // Replace existing extension with correct one
        return filename.replace(/\.[^.]+$/, correctExt)
    }
    
    // Add extension
    return `${filename}${correctExt}`
}

export default function DashboardPage() {
    const { user } = useAuthStore()
    const { files, deleteFile } = useFileStore()
    const { projects } = useProjectStore()
    const { comments } = useCommentStore()

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<{
        id: string
        projectId: string
        name: string
        size: number
        projectName: string
    } | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [loading, setLoading] = useState(true)

    // Download progress state
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [downloadMessage, setDownloadMessage] = useState('')
    const [currentDownloadFile, setCurrentDownloadFile] = useState('')

    // File view dialog state for comment click
    const [viewDialogOpen, setViewDialogOpen] = useState(false)
    const [viewDialogFile, setViewDialogFile] = useState<FileType | null>(null)
    const [viewDialogProjectId, setViewDialogProjectId] = useState<string>('')
    const [currentUserName, setCurrentUserName] = useState(() => {
        return localStorage.getItem('reviewUserName') || ''
    })

    const adminEmail = user?.email || ''

    // Load files and comments for all projects
    useEffect(() => {
        if (projects.length > 0) {
            setLoading(true)

            // Subscribe to files for each project
            projects.forEach(project => {
                useFileStore.getState().subscribeToFiles(project.id)
            })

            // Subscribe to comments for each project  
            projects.forEach(project => {
                useCommentStore.getState().subscribeToComments(project.id)
            })

            // Give some time for data to load
            const timer = setTimeout(() => {
                setLoading(false)
            }, 2000)

            return () => clearTimeout(timer)
        }
    }, [projects.length])

    // Calculate statistics from existing store data
    const statistics = useMemo(() => {
        // Storage stats
        const totalSize = calculateTotalSize(files)

        // Calculate total file count including sequence frames
        const fileCount = files.reduce((acc, file) => {
            if (file.type === 'sequence') {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                return acc + (currentVersion?.sequenceUrls?.length || 0)
            }
            return acc + 1
        }, 0)

        const byType = {
            image: 0,
            video: 0,
            model: 0,
            sequence: 0
        }

        files.forEach(file => {
            const currentVersion = file.versions.find(v => v.version === file.currentVersion)
            if (currentVersion && file.type in byType) {
                byType[file.type as keyof typeof byType] += currentVersion.metadata?.size || 0
            }
        })

        // Project stats
        const projectMap = new Map(projects.map(p => [p.id, p]))
        const projectStatsMap = new Map<string, {
            projectId: string
            projectName: string
            fileCount: number
            commentCount: number
            totalSize: number
            status: 'active' | 'archived'
        }>()

        files.forEach(file => {
            const project = projectMap.get(file.projectId)
            if (!project) return

            if (!projectStatsMap.has(file.projectId)) {
                projectStatsMap.set(file.projectId, {
                    projectId: file.projectId,
                    projectName: project.name,
                    fileCount: 0,
                    commentCount: 0,
                    totalSize: 0,
                    status: project.status
                })
            }

            const stats = projectStatsMap.get(file.projectId)!

            // Update file count based on type
            if (file.type === 'sequence') {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                stats.fileCount += (currentVersion?.sequenceUrls?.length || 0)
            } else {
                stats.fileCount++
            }

            const currentVersion = file.versions.find(v => v.version === file.currentVersion)
            if (currentVersion) {
                stats.totalSize += currentVersion.metadata?.size || 0
            }
        })

        comments.forEach(comment => {
            const stats = projectStatsMap.get(comment.projectId)
            if (stats) {
                stats.commentCount++
            }
        })

        const projectStats = Array.from(projectStatsMap.values())
            .sort((a, b) => b.totalSize - a.totalSize)

        // Comment stats
        const commentStats = {
            total: comments.length,
            resolved: comments.filter(c => c.isResolved).length,
            pending: comments.filter(c => !c.isResolved).length,
            withAttachments: comments.filter(c => c.attachments && c.attachments.length > 0).length
        }

        // Largest files with project info
        const filesWithProject: FileWithProject[] = files.map(file => {
            const project = projectMap.get(file.projectId)
            return {
                ...file,
                projectName: project?.name,
                projectStatus: project?.status
            }
        }).sort((a, b) => {
            const sizeA = a.versions.find(v => v.version === a.currentVersion)?.metadata?.size || 0
            const sizeB = b.versions.find(v => v.version === b.currentVersion)?.metadata?.size || 0
            return sizeB - sizeA
        }).slice(0, 50)

        return {
            storageStats: { totalSize, fileCount, byType },
            projectStats,
            commentStats,
            largestFiles: filesWithProject
        }
    }, [files, projects, comments])

    // Prepare comments with file info for the card
    const commentsWithFileInfo = useMemo(() => {
        const fileMap = new Map(files.map(f => [f.id, f]))
        const projectMap = new Map(projects.map(p => [p.id, p]))

        return comments.map(comment => {
            const file = fileMap.get(comment.fileId)
            const project = projectMap.get(comment.projectId)
            return {
                ...comment,
                fileName: file?.name,
                projectName: project?.name
            }
        })
    }, [comments, files, projects])

    // Handle comment click to open file dialog
    const handleCommentClick = (comment: Comment & { fileName?: string; projectName?: string }) => {
        const file = files.find(f => f.id === comment.fileId)
        if (!file) {
            toast.error('Không tìm thấy file')
            return
        }

        setViewDialogFile(file)
        setViewDialogProjectId(comment.projectId)
        setViewDialogOpen(true)
    }

    const handleUserNameChange = (name: string) => {
        setCurrentUserName(name)
        localStorage.setItem('reviewUserName', name)
    }

    const handleDeleteClick = (fileId: string, projectId: string) => {
        const file = statistics.largestFiles.find(f => f.id === fileId)
        if (!file) return

        const currentVersion = file.versions.find(v => v.version === file.currentVersion)
        const size = currentVersion?.metadata?.size || 0

        setSelectedFile({
            id: fileId,
            projectId,
            name: file.name,
            size,
            projectName: file.projectName || 'Unknown'
        })
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!selectedFile) return

        setDeleting(true)
        try {
            await deleteFile(selectedFile.projectId, selectedFile.id)
            toast.success('Đã xóa file thành công')
            setDeleteDialogOpen(false)
            setSelectedFile(null)
        } catch (error) {
            console.error('Error deleting file:', error)
            toast.error('Lỗi khi xóa file')
        } finally {
            setDeleting(false)
        }
    }

    const handleExport = async (type: 'files' | 'comments' | 'all') => {
        setIsDownloading(true)
        setDownloadProgress(0)
        setDownloadMessage('Đang chuẩn bị export...')

        try {
            const zip = new JSZip()
            const timestamp = new Date().toISOString().split('T')[0]

            // Create export data
            const exportData: any = {
                exportDate: new Date().toISOString(),
                adminEmail,
                summary: {
                    totalProjects: projects.length,
                    totalFiles: files.length,
                    totalComments: comments.length,
                    totalStorageBytes: statistics.storageStats.totalSize
                },
                projects: type === 'all' ? projects : [],
                files: type === 'files' || type === 'all' ? statistics.largestFiles : [],
                comments: type === 'comments' || type === 'all' ? comments : []
            }

            // Add JSON data to ZIP
            const jsonData = JSON.stringify(exportData, null, 2)
            zip.file(`export-data-${timestamp}.json`, jsonData)

            setDownloadProgress(20)
            setDownloadMessage('Đang tải file metadata...')

            // If exporting files, include actual file data
            if (type === 'files' || type === 'all') {
                const filesToExport = statistics.largestFiles.slice(0, 20) // Limit to 20 largest files
                
                // Calculate total items for progress (including sequence frames)
                let totalItems = 0
                for (const file of filesToExport) {
                    const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                    if (file.type === 'sequence' && currentVersion?.sequenceUrls) {
                        totalItems += currentVersion.sequenceUrls.length
                    } else {
                        totalItems += 1
                    }
                }
                
                let processedItems = 0

                for (const file of filesToExport) {
                    const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                    if (!currentVersion?.url) continue

                    const folderName = file.projectName || 'unknown'

                    try {
                        // Handle image sequences
                        if (file.type === 'sequence' && currentVersion?.sequenceUrls && currentVersion.sequenceUrls.length > 0) {
                            setDownloadMessage(`Đang tải sequence ${file.name}...`)
                            
                            // Create subfolder for sequence: files/projectName/sequenceName/
                            const sequenceFolderName = file.name.replace(/\.[^/.]+$/, '') || file.name
                            const sequenceFolder = zip.folder(`files/${folderName}/${sequenceFolderName}`)
                            
                            if (sequenceFolder) {
                                // Download all frames
                                for (let i = 0; i < currentVersion.sequenceUrls.length; i++) {
                                    try {
                                        setDownloadMessage(`Đang tải frame ${i + 1}/${currentVersion.sequenceUrls.length} của ${file.name}`)
                                        const frameResponse = await fetch(currentVersion.sequenceUrls[i])
                                        
                                        if (frameResponse.ok) {
                                            const frameBlob = await frameResponse.blob()
                                            const mimeType = frameResponse.headers.get('content-type') || frameBlob.type
                                            const ext = getFileExtension(currentVersion.sequenceUrls[i], mimeType, 'image')
                                            const frameName = `frame_${String(i + 1).padStart(4, '0')}${ext || '.jpg'}`
                                            sequenceFolder.file(frameName, frameBlob)
                                        }
                                    } catch (err) {
                                        console.error(`Error fetching frame ${i} of ${file.name}:`, err)
                                    }
                                    
                                    processedItems++
                                    setDownloadProgress(20 + (processedItems / totalItems) * 60)
                                }
                                
                                // Add sequence info file
                                const sequenceInfo = {
                                    name: file.name,
                                    type: 'sequence',
                                    frameCount: currentVersion.sequenceUrls.length,
                                    version: currentVersion.version,
                                    uploadedAt: currentVersion.uploadedAt?.toDate?.()?.toISOString() || null
                                }
                                sequenceFolder.file('sequence-info.json', JSON.stringify(sequenceInfo, null, 2))
                            }
                        } else {
                            // Handle single files
                            setDownloadMessage(`Đang tải ${file.name}...`)
                            const response = await fetch(currentVersion.url)
                            
                            if (response.ok) {
                                const blob = await response.blob()
                                
                                // Get MIME type from response or blob
                                const mimeType = response.headers.get('content-type') || blob.type || currentVersion.metadata?.type
                                
                                // Ensure file has correct extension
                                const fileName = ensureFileExtension(file.name, currentVersion.url, mimeType, file.type)
                                
                                console.log(`Export file: ${file.name} -> ${fileName} (mime: ${mimeType}, type: ${file.type})`)
                                
                                zip.file(`files/${folderName}/${fileName}`, blob)
                            }
                            
                            processedItems++
                            setDownloadProgress(20 + (processedItems / totalItems) * 60)
                        }
                    } catch (err) {
                        console.error(`Error fetching file ${file.name}:`, err)
                        processedItems++
                    }
                }
            } else {
                setDownloadProgress(80)
            }

            // Generate and download ZIP
            setDownloadMessage('Đang nén dữ liệu...')
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                setDownloadProgress(80 + (metadata.percent * 0.2))
            })

            // Download ZIP file
            const filename = `review-system-export-${type}-${timestamp}.zip`
            const link = document.createElement('a')
            link.href = URL.createObjectURL(zipBlob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)

            toast.success('Export thành công!')
            return exportData
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Lỗi khi export dữ liệu')
            throw error
        } finally {
            setIsDownloading(false)
            setDownloadProgress(0)
        }
    }

    const handleBulkDelete = async (filesToDelete: { id: string; projectId: string }[]) => {
        if (filesToDelete.length === 0) return

        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn xóa ${filesToDelete.length} files? Hành động này không thể hoàn tác.`
        )

        if (!confirmed) return

        setLoading(true)
        try {
            let successCount = 0
            let errorCount = 0

            for (const file of filesToDelete) {
                try {
                    await deleteFile(file.projectId, file.id)
                    successCount++
                } catch (error) {
                    console.error(`Error deleting file ${file.id}:`, error)
                    errorCount++
                }
            }

            if (successCount > 0) {
                toast.success(`Đã xóa thành công ${successCount} files`)
            }
            if (errorCount > 0) {
                toast.error(`Lỗi khi xóa ${errorCount} files`)
            }
        } catch (error) {
            console.error('Bulk delete error:', error)
            toast.error('Lỗi khi xóa files')
        } finally {
            setLoading(false)
        }
    }

    const handleBulkDownload = async (filesToDownload: FileWithProject[]) => {
        if (filesToDownload.length === 0) return

        setIsDownloading(true)
        setDownloadProgress(0)
        setDownloadMessage('Đang chuẩn bị...')

        try {
            const zip = new JSZip()

            // Calculate total items for progress
            let totalItems = 0
            for (const file of filesToDownload) {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                if (file.type === 'sequence' && currentVersion?.sequenceUrls) {
                    totalItems += currentVersion.sequenceUrls.length
                } else {
                    totalItems += 1
                }
            }

            let processedItems = 0
            let successCount = 0
            let errorCount = 0

            for (const file of filesToDownload) {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                if (!currentVersion?.url) {
                    console.warn(`No URL found for file: ${file.name}`)
                    errorCount++
                    continue
                }

                setCurrentDownloadFile(file.name)

                try {
                    // For sequences, create a subfolder
                    if (file.type === 'sequence' && currentVersion?.sequenceUrls && currentVersion.sequenceUrls.length > 0) {
                        const folderName = file.name.replace(/\.[^/.]+$/, '') || file.name
                        const folder = zip.folder(folderName)
                        if (!folder) {
                            errorCount++
                            continue
                        }

                        // Add all sequence frames to the folder
                        for (let i = 0; i < currentVersion.sequenceUrls.length; i++) {
                            try {
                                setDownloadMessage(`Đang tải frame ${i + 1}/${currentVersion.sequenceUrls.length} của ${file.name}`)
                                const frameResponse = await fetch(currentVersion.sequenceUrls[i])
                                if (frameResponse.ok) {
                                    const frameBlob = await frameResponse.blob()
                                    const ext = getFileExtension(currentVersion.sequenceUrls[i], frameBlob.type)
                                    const frameName = `frame_${String(i + 1).padStart(4, '0')}${ext || '.jpg'}`
                                    folder.file(frameName, frameBlob)
                                }
                            } catch (err) {
                                console.error(`Error fetching frame ${i}:`, err)
                            }
                            processedItems++
                            setDownloadProgress((processedItems / totalItems) * 80) // Reserve 20% for zipping
                        }

                        // Add comments for sequence
                        const fileComments = comments.filter(c => c.fileId === file.id)
                        if (fileComments.length > 0) {
                            const commentsText = fileComments.map(c => {
                                const date = c.createdAt?.toDate?.() || new Date()
                                return `[${c.isResolved ? 'RESOLVED' : 'PENDING'}] ${c.userName} (${date.toLocaleString('vi-VN')}):\n${c.content}\n${c.annotationData ? `Frame: ${c.timestamp || 0}s` : ''}\n`
                            }).join('\n---\n\n')
                            folder.file('comments.txt', commentsText)
                        }

                        successCount++
                    } else {
                        // Single file download
                        setDownloadMessage(`Đang tải ${file.name}...`)
                        const response = await fetch(currentVersion.url)
                        if (!response.ok) throw new Error(`Failed to fetch ${file.name}`)

                        const blob = await response.blob()

                        // Ensure file has correct extension
                        const fileName = ensureFileExtension(file.name, currentVersion.url, blob.type, file.type)

                        zip.file(fileName, blob)

                        // Add comments for single file
                        const fileComments = comments.filter(c => c.fileId === file.id)
                        if (fileComments.length > 0) {
                            const commentsText = fileComments.map(c => {
                                const date = c.createdAt?.toDate?.() || new Date()
                                return `[${c.isResolved ? 'RESOLVED' : 'PENDING'}] ${c.userName} (${date.toLocaleString('vi-VN')}):\n${c.content}\n${c.annotationData ? `Annotation at ${c.timestamp || 0}s` : ''}\n`
                            }).join('\n---\n\n')

                            const commentFileName = fileName.replace(/\.[^/.]+$/, '') + '_comments.txt'
                            zip.file(commentFileName, commentsText)
                        }

                        processedItems++
                        setDownloadProgress((processedItems / totalItems) * 80)
                        successCount++
                    }
                } catch (error) {
                    console.error(`Error downloading file ${file.name}:`, error)
                    errorCount++
                }
            }

            if (successCount === 0) {
                toast.error('Không thể tải xuống files')
                setIsDownloading(false)
                return
            }

            // Generate ZIP file
            setDownloadMessage('Đang nén files...')
            setCurrentDownloadFile('')
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                setDownloadProgress(80 + (metadata.percent * 0.2))
            })

            // Download ZIP
            const timestamp = new Date().toISOString().split('T')[0]
            const filename = `files-download-${timestamp}.zip`

            const link = document.createElement('a')
            link.href = URL.createObjectURL(zipBlob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)

            toast.success(`Đã tải xuống ${successCount} files${errorCount > 0 ? ` (${errorCount} lỗi)` : ''}`)
        } catch (error) {
            console.error('Bulk download error:', error)
            toast.error('Lỗi khi tải files')
        } finally {
            setIsDownloading(false)
            setDownloadProgress(0)
        }
    }

    const totalProjects = projects.length
    const activeProjects = projects.filter(p => p.status === 'active').length
    const archivedProjects = projects.filter(p => p.status === 'archived').length

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Thống kê và quản lý dữ liệu Firebase
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                        disabled={loading}
                        className="flex-1 sm:flex-none min-w-[120px]"
                    >
                        <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Làm mới</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setExportDialogOpen(true)}
                        className="flex-1 sm:flex-none min-w-[120px]"
                    >
                        <Download className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Export Data</span>
                    </Button>
                </div>
            </div>

            {/* Storage Overview */}
            <StorageOverviewCard
                totalSize={statistics.storageStats.totalSize}
                loading={loading}
            />

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Tổng Projects"
                    value={totalProjects}
                    description={`${activeProjects} active, ${archivedProjects} archived`}
                    icon="projects"
                    loading={loading}
                />
                <StatsCard
                    title="Tổng Files"
                    value={statistics.storageStats.fileCount}
                    description={formatBytes(statistics.storageStats.totalSize)}
                    icon="files"
                    loading={loading}
                />
                <StatsCard
                    title="Tổng Comments"
                    value={statistics.commentStats.total}
                    description={`${statistics.commentStats.resolved} resolved, ${statistics.commentStats.pending} pending`}
                    icon="comments"
                    loading={loading}
                />
                <StatsCard
                    title="Comments có attachments"
                    value={statistics.commentStats.withAttachments}
                    description="Files đính kèm trong comments"
                    icon="files"
                    loading={loading}
                />
            </div>

            {/* Recent Comments Card */}
            <RecentCommentsCard
                comments={commentsWithFileInfo}
                loading={loading}
                onCommentClick={handleCommentClick}
            />

            {/* Charts */}
            <StorageChart
                byType={statistics.storageStats.byType}
                topProjects={statistics.projectStats}
                loading={loading}
            />

            {/* Data Management Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Quản lý Files</h2>
                        <p className="text-sm text-muted-foreground">
                            Danh sách files lớn nhất - Sắp xếp và xóa để giải phóng dung lượng
                        </p>
                    </div>
                </div>

                <DataTable
                    files={statistics.largestFiles}
                    loading={loading}
                    onDelete={handleDeleteClick}
                    onBulkDelete={handleBulkDelete}
                    onBulkDownload={handleBulkDownload}
                />
            </div>

            {/* Delete Confirmation Dialog */}
            {selectedFile && (
                <DeleteConfirmDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    fileName={selectedFile.name}
                    fileSize={selectedFile.size}
                    projectName={selectedFile.projectName}
                    onConfirm={handleDeleteConfirm}
                    loading={deleting}
                />
            )}

            {/* Export Data Dialog */}
            <ExportDataDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                onExport={handleExport}
                fileCount={statistics.storageStats.fileCount}
                commentCount={statistics.commentStats.total}
                totalSize={statistics.storageStats.totalSize}
            />
            <DownloadProgressDialog
                open={isDownloading}
                progress={downloadProgress}
                message={downloadMessage}
                fileName={currentDownloadFile}
            />

            {/* File View Dialog for Comment Click */}
            {viewDialogFile && (
                <FileViewDialogShared
                    file={viewDialogFile}
                    projectId={viewDialogProjectId}
                    open={viewDialogOpen}
                    onOpenChange={setViewDialogOpen}
                    comments={comments}
                    currentUserName={currentUserName}
                    onUserNameChange={handleUserNameChange}
                    onAddComment={async () => { }} // View only mode from dashboard
                    isAdmin={true}
                />
            )}
        </div>
    )
}
