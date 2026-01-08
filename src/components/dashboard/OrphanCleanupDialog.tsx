import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Scan, ShieldCheck } from 'lucide-react'
import { formatBytes } from '@/lib/storageUtils'
import { scanForOrphans, deleteOrphan, type OrphanedItem } from '@/lib/maintenance'
import { useAuthStore } from '@/stores/auth'
import toast from 'react-hot-toast'

interface OrphanCleanupDialogProps {
    trigger?: React.ReactNode
    onCleanupComplete?: () => void
}

export function OrphanCleanupDialog({ trigger, onCleanupComplete }: OrphanCleanupDialogProps) {
    const { user } = useAuthStore()
    const [open, setOpen] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [cleaning, setCleaning] = useState(false)
    const [orphans, setOrphans] = useState<OrphanedItem[]>([])
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [scanComplete, setScanComplete] = useState(false)

    const handleScan = async () => {
        if (!user?.email) return

        setScanning(true)
        setScanComplete(false)
        setOrphans([])
        setSelectedItems(new Set())

        try {
            const results = await scanForOrphans(user.email)
            setOrphans(results)
            // Auto-select all by default? converting path to string for key
            const allPaths = new Set(results.map(o => o.path))
            setSelectedItems(allPaths)
            setScanComplete(true)

            if (results.length === 0) {
                toast.success('Hệ thống sạch sẽ! Không tìm thấy dữ liệu rác.')
            } else {
                toast.success(`Tìm thấy ${results.length} mục dữ liệu rác`)
            }
        } catch (error) {
            console.error('Scan failed:', error)
            toast.error('Lỗi khi quét dữ liệu')
        } finally {
            setScanning(false)
        }
    }

    const handleCleanup = async () => {
        if (selectedItems.size === 0) return

        if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedItems.size} mục đã chọn?`)) {
            return
        }

        setCleaning(true)
        let successCount = 0
        let errorCount = 0

        try {
            const itemsToDelete = orphans.filter(o => selectedItems.has(o.path))

            for (const item of itemsToDelete) {
                try {
                    await deleteOrphan(item)
                    successCount++
                    // Remove from local state
                    setOrphans(prev => prev.filter(o => o.path !== item.path))
                    setSelectedItems(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(item.path)
                        return newSet
                    })
                } catch (error) {
                    console.error(`Failed to delete ${item.path}:`, error)
                    errorCount++
                }
            }

            if (successCount > 0) {
                toast.success(`Đã dọn dẹp ${successCount} mục (${formatBytes(itemsToDelete.reduce((acc, i) => acc + i.size, 0))})`)
                if (onCleanupComplete) onCleanupComplete()
            }
            if (errorCount > 0) {
                toast.error(`Không thể xóa ${errorCount} mục`)
            }

        } catch (error) {
            console.error('Cleanup failed:', error)
            toast.error('Lỗi trong quá trình dọn dẹp')
        } finally {
            setCleaning(false)
        }
    }

    const toggleSelect = (path: string) => {
        const newSet = new Set(selectedItems)
        if (newSet.has(path)) {
            newSet.delete(path)
        } else {
            newSet.add(path)
        }
        setSelectedItems(newSet)
    }

    const totalSelectedSize = orphans
        .filter(o => selectedItems.has(o.path))
        .reduce((acc, o) => acc + o.size, 0)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Scan className="w-4 h-4 mr-2" />
                        Quét dữ liệu rác
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-500" />
                        Dọn dẹp hệ thống (System Cleanup)
                    </DialogTitle>
                    <DialogDescription>
                        Quét và xóa các file rác (orphan files) không còn liên kết với bất kỳ dữ liệu nào trong dự án.
                        Tính năng này giúp giải phóng dung lượng lưu trữ.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-[300px] flex flex-col gap-4 overflow-hidden">
                    {/* Control Panel */}
                    <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-sm">Trạng thái scan</h4>
                            <p className="text-xs text-muted-foreground">
                                {scanning
                                    ? 'Đang quét toàn bộ hệ thống storage...'
                                    : scanComplete
                                        ? `Đã quét xong. Tìm thấy ${orphans.length} mục.`
                                        : 'Chưa bắt đầu quét'
                                }
                            </p>
                        </div>
                        <Button
                            onClick={handleScan}
                            disabled={scanning || cleaning}
                        >
                            {scanning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {scanning ? 'Đang quét...' : 'Bắt đầu quét'}
                        </Button>
                    </div>

                    {/* Results Area */}
                    <div className="flex-1 border rounded-md overflow-hidden relative">
                        {!scanComplete && !scanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-background/50 z-10">
                                <Scan className="w-12 h-12 mb-4 opacity-20" />
                                <p>Nhấn "Bắt đầu quét" để kiểm tra dữ liệu rác</p>
                            </div>
                        )}

                        <div className="h-full overflow-auto">
                            <div className="p-4 space-y-2">
                                {orphans.map((item) => (
                                    <div
                                        key={item.path}
                                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedItems.has(item.path)}
                                            onCheckedChange={() => toggleSelect(item.path)}
                                            disabled={cleaning}
                                            className="mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.type === 'file'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                                    }`}>
                                                    {item.type.toUpperCase()} ORPHAN
                                                </span>
                                                <span className="text-xs font-mono text-muted-foreground">
                                                    {formatBytes(item.size)}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium mt-1 truncate" title={item.path}>
                                                {item.path}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Lý do: {item.reason}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {scanComplete && orphans.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <ShieldCheck className="w-12 h-12 mb-4 text-green-500 opacity-50" />
                                        <p>Không tìm thấy dữ liệu rác nào!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary & Actions */}
                    {orphans.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                            <div className="text-sm">
                                <span className="text-muted-foreground">Đã chọn: </span>
                                <span className="font-bold">{selectedItems.size}</span>
                                <span className="text-muted-foreground"> / {orphans.length} mục </span>
                                <span className="text-muted-foreground mx-2">|</span>
                                <span className="text-muted-foreground">Giải phóng: </span>
                                <span className="font-bold text-red-600 dark:text-red-400">
                                    {formatBytes(totalSelectedSize)}
                                </span>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleCleanup}
                                disabled={selectedItems.size === 0 || cleaning}
                            >
                                {cleaning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {cleaning ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
