import { useState, useEffect } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Trash2, ArrowUpDown, ChevronLeft, ChevronRight, Download, RotateCcw, Trash } from 'lucide-react'
import { formatBytes, formatDate, getFileTypeColor } from '@/lib/storageUtils'
import type { File as FileType } from '@/types'

interface FileWithProject extends FileType {
    projectName?: string
    projectStatus?: 'active' | 'archived' | 'trash'
}

export type DataTableViewMode = 'active' | 'trash'

interface DataTableProps {
    files: FileWithProject[]
    loading?: boolean
    viewMode?: DataTableViewMode
    onDelete: (fileId: string, projectId: string) => void
    onBulkDelete?: (fileIds: { id: string; projectId: string }[]) => void
    onBulkDownload?: (files: FileWithProject[]) => void
    // Trash-specific actions
    onRestore?: (fileId: string, projectId: string) => void
    onPermanentDelete?: (fileId: string, projectId: string) => void
    onBulkRestore?: (fileIds: { id: string; projectId: string }[]) => void
    onBulkPermanentDelete?: (fileIds: { id: string; projectId: string }[]) => void
}

type SortField = 'name' | 'size' | 'date' | 'project'
type SortOrder = 'asc' | 'desc'

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function DataTable({
    files,
    loading,
    viewMode = 'active',
    onDelete,
    onBulkDelete,
    onBulkDownload,
    onRestore,
    onPermanentDelete,
    onBulkRestore,
    onBulkPermanentDelete
}: DataTableProps) {
    const [sortField, setSortField] = useState<SortField>('date')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [filterType, setFilterType] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterProject, setFilterProject] = useState<string>('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

    // Get unique projects for filter
    const uniqueProjects = Array.from(new Set(files.map(f => f.projectName).filter(Boolean))).sort()

    // Clean up selectedFiles when files are deleted
    useEffect(() => {
        const fileIds = new Set(files.map(f => f.id))
        const newSelected = new Set(
            Array.from(selectedFiles).filter(id => fileIds.has(id))
        )

        // Only update if there's a difference
        if (newSelected.size !== selectedFiles.size) {
            setSelectedFiles(newSelected)
        }
    }, [files.length]) // Only run when file count changes

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('desc')
        }
        setCurrentPage(1)
    }

    const getSortedAndFilteredFiles = () => {
        let filtered = [...files]

        if (filterType !== 'all') {
            filtered = filtered.filter(f => f.type === filterType)
        }
        if (filterStatus !== 'all') {
            filtered = filtered.filter(f => f.projectStatus === filterStatus)
        }
        if (filterProject !== 'all') {
            filtered = filtered.filter(f => f.projectName === filterProject)
        }

        filtered.sort((a, b) => {
            let comparison = 0

            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name)
                    break
                case 'size': {
                    const sizeA = a.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                    const sizeB = b.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                    comparison = sizeA - sizeB
                    break
                }
                case 'date': {
                    const dateA = a.createdAt?.toMillis?.() || 0
                    const dateB = b.createdAt?.toMillis?.() || 0
                    comparison = dateA - dateB
                    break
                }
                case 'project':
                    comparison = (a.projectName || '').localeCompare(b.projectName || '')
                    break
            }

            return sortOrder === 'asc' ? comparison : -comparison
        })

        return filtered
    }

    const sortedFiles = getSortedAndFilteredFiles()
    const totalPages = Math.ceil(sortedFiles.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedFiles = sortedFiles.slice(startIndex, endIndex)

    const handlePageChange = (newPage: number) => {
        setCurrentPage(Math.max(1, Math.min(newPage, totalPages)))
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value))
        setCurrentPage(1)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(paginatedFiles.map(f => f.id))
            setSelectedFiles(allIds)
        } else {
            setSelectedFiles(new Set())
        }
    }

    const handleSelectFile = (fileId: string, checked: boolean) => {
        const newSelected = new Set(selectedFiles)
        if (checked) {
            newSelected.add(fileId)
        } else {
            newSelected.delete(fileId)
        }
        setSelectedFiles(newSelected)
    }

    const handleBulkDeleteClick = () => {
        if (!onBulkDelete || selectedFiles.size === 0) return

        const filesToDelete = Array.from(selectedFiles).map(fileId => {
            const file = files.find(f => f.id === fileId)
            return { id: fileId, projectId: file?.projectId || '' }
        }).filter(f => f.projectId)

        onBulkDelete(filesToDelete)
        setSelectedFiles(new Set())
    }

    const handleBulkDownloadClick = () => {
        if (!onBulkDownload || selectedFiles.size === 0) return

        const filesToDownload = files.filter(f => selectedFiles.has(f.id))
        onBulkDownload(filesToDownload)
    }

    const isAllSelected = paginatedFiles.length > 0 && paginatedFiles.every(f => selectedFiles.has(f.id))
    const isSomeSelected = paginatedFiles.some(f => selectedFiles.has(f.id)) && !isAllSelected

    const SortButton = ({ field, label }: { field: SortField; label: string }) => (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => handleSort(field)}
        >
            {label}
            <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
    )

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions Bar */}
            {selectedFiles.size > 0 && (
                <div className="bg-muted/50 border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                            Đã chọn {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedFiles(new Set())}
                        >
                            Bỏ chọn
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        {viewMode === 'active' ? (
                            <>
                                {onBulkDownload && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBulkDownloadClick}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Tải xuống
                                    </Button>
                                )}
                                {onBulkDelete && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleBulkDeleteClick}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Xóa {selectedFiles.size} files
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                {onBulkRestore && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const filesToRestore = Array.from(selectedFiles).map(fileId => {
                                                const file = files.find(f => f.id === fileId)
                                                return { id: fileId, projectId: file?.projectId || '' }
                                            }).filter(f => f.projectId)
                                            onBulkRestore(filesToRestore)
                                            setSelectedFiles(new Set())
                                        }}
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Khôi phục {selectedFiles.size} files
                                    </Button>
                                )}
                                {onBulkPermanentDelete && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                            const filesToDelete = Array.from(selectedFiles).map(fileId => {
                                                const file = files.find(f => f.id === fileId)
                                                return { id: fileId, projectId: file?.projectId || '' }
                                            }).filter(f => f.projectId)
                                            onBulkPermanentDelete(filesToDelete)
                                            setSelectedFiles(new Set())
                                        }}
                                    >
                                        <Trash className="w-4 h-4 mr-2" />
                                        Xóa vĩnh viễn {selectedFiles.size} files
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 items-center flex-wrap">
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Loại file" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả loại</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="model">3D Model</SelectItem>
                        <SelectItem value="sequence">Sequence</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả trạng thái</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Dự án" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả dự án</SelectItem>
                        {uniqueProjects.map(project => (
                            <SelectItem key={project} value={project as string}>
                                {project}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Hiển thị:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ITEMS_PER_PAGE_OPTIONS.map(option => (
                                <SelectItem key={option} value={option.toString()}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>


                <div className="text-sm text-muted-foreground">
                    {sortedFiles.length} files
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all"
                                    className={isSomeSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                                />
                            </TableHead>
                            <TableHead>
                                <SortButton field="name" label="Tên file" />
                            </TableHead>
                            <TableHead>Loại</TableHead>
                            <TableHead>
                                <SortButton field="project" label="Project" />
                            </TableHead>
                            <TableHead>
                                <SortButton field="size" label="Kích thước" />
                            </TableHead>
                            <TableHead>
                                <SortButton field="date" label="Ngày tạo" />
                            </TableHead>
                            <TableHead className="w-[100px]">Hành động</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedFiles.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    Không có files
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedFiles.map((file) => {

                                const size = file.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                                const isSelected = selectedFiles.has(file.id)

                                return (
                                    <TableRow key={file.id} className={isSelected ? 'bg-muted/50' : ''}>
                                        <TableCell>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => handleSelectFile(file.id, checked as boolean)}
                                                aria-label={`Select ${file.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{file.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getFileTypeColor(file.type)}>
                                                {file.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{file.projectName}</span>
                                                {file.projectStatus === 'archived' && (
                                                    <Badge variant="secondary" className="w-fit text-xs">
                                                        Archived
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {formatBytes(size)}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(file.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            {viewMode === 'active' ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => onDelete(file.id, file.projectId)}
                                                    title="Xóa (vào thùng rác)"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    {onRestore && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                                                            onClick={() => onRestore(file.id, file.projectId)}
                                                            title="Khôi phục"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {onPermanentDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => onPermanentDelete(file.id, file.projectId)}
                                                            title="Xóa vĩnh viễn"
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {
                totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Hiển thị {startIndex + 1} - {Math.min(endIndex, sortedFiles.length)} trong tổng số {sortedFiles.length} files
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Trước
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = currentPage - 2 + i
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? 'default' : 'outline'}
                                            size="sm"
                                            className="w-9"
                                            onClick={() => handlePageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    )
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                Sau
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
