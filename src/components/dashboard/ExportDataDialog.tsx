import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Download } from 'lucide-react'
import { formatBytes } from '@/lib/storageUtils'
import type { ExportData } from '@/stores/statistics'

interface ExportDataDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onExport: (type: 'files' | 'comments' | 'all') => Promise<ExportData>
    fileCount: number
    commentCount: number
    totalSize: number
}

export function ExportDataDialog({
    open,
    onOpenChange,
    onExport,
    fileCount,
    commentCount,
    totalSize
}: ExportDataDialogProps) {
    const [exportType, setExportType] = useState<'files' | 'comments' | 'all'>('all')
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        setLoading(true)
        try {
            await onExport(exportType)
            onOpenChange(false)
        } catch (error) {
            console.error('Export error:', error)
        } finally {
            setLoading(false)
        }
    }

    const getPreviewText = () => {
        switch (exportType) {
            case 'files':
                return `${fileCount} files (${formatBytes(totalSize)})`
            case 'comments':
                return `${commentCount} comments`
            case 'all':
                return `${fileCount} files, ${commentCount} comments (${formatBytes(totalSize)})`
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Export dữ liệu
                    </DialogTitle>
                    <DialogDescription>
                        Xuất dữ liệu ra file ZIP bao gồm JSON metadata và các file thực tế
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-3">
                        <Label>Chọn dữ liệu cần export:</Label>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="export-files"
                                checked={exportType === 'files'}
                                onCheckedChange={(checked) => checked && setExportType('files')}
                            />
                            <Label htmlFor="export-files" className="cursor-pointer">
                                Files data ({fileCount} files, {formatBytes(totalSize)}) - bao gồm 20 files lớn nhất
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="export-comments"
                                checked={exportType === 'comments'}
                                onCheckedChange={(checked) => checked && setExportType('comments')}
                            />
                            <Label htmlFor="export-comments" className="cursor-pointer">
                                Comments ({commentCount} comments)
                            </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="export-all"
                                checked={exportType === 'all'}
                                onCheckedChange={(checked) => checked && setExportType('all')}
                            />
                            <Label htmlFor="export-all" className="cursor-pointer font-medium">
                                Tất cả (Projects, Files, Comments)
                            </Label>
                        </div>
                    </div>

                    <div className="bg-muted p-3 rounded-md">
                        <div className="text-sm text-muted-foreground mb-1">Sẽ export:</div>
                        <div className="font-medium">{getPreviewText()}</div>
                    </div>

                    {loading && (
                        <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Đang tạo file export...</div>
                            <Progress value={undefined} className="h-2" />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={loading}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {loading ? 'Đang export...' : 'Download ZIP'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
