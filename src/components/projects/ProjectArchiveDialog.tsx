import { useState } from 'react'
import { useProjectStore } from '@/stores/projects'
import { useFileStore } from '@/stores/files'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Archive, AlertTriangle, Loader2 } from 'lucide-react'
import type { Project } from '@/types'
import { toast } from 'react-hot-toast'

interface ProjectArchiveDialogProps {
    project: Project
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProjectArchiveDialog({ project, open, onOpenChange }: ProjectArchiveDialogProps) {
    const [archiveUrl, setArchiveUrl] = useState('')
    const [confirmText, setConfirmText] = useState('')
    const [step, setStep] = useState<'info' | 'confirm'>('info')

    const archiveProject = useProjectStore(s => s.archiveProject)
    const cleanupProjectFiles = useFileStore(s => s.cleanupProjectFiles)
    const projectLoading = useProjectStore(s => s.loading)
    const fileDeleting = useFileStore(s => s.deleting)
    const loading = projectLoading || fileDeleting


    const handleArchive = async () => {
        if (!archiveUrl.trim()) {
            toast.error('Vui lòng nhập link lưu trữ')
            return
        }

        if (step === 'info') {
            setStep('confirm')
            return
        }

        if (confirmText !== 'ARCHIVE') {
            toast.error('Vui lòng nhập đúng từ xác nhận')
            return
        }

        try {
            // 1. Archive metadata
            await archiveProject(project.id, archiveUrl.trim())

            // 2. Perform deep cleanup
            await cleanupProjectFiles(project.id)

            onOpenChange(false)
            // Reset state
            setStep('info')
            setArchiveUrl('')
            setConfirmText('')
        } catch (error) {
            console.error('Archive flow failed:', error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!loading) {
                onOpenChange(v)
                if (!v) {
                    setStep('info')
                    setConfirmText('')
                }
            }
        }}>
            <DialogContent className="sm:max-w-[500px] overflow-hidden">
                <DialogHeader className="space-y-2">
                    <DialogTitle className="flex items-center gap-2 pr-6">
                        <Archive className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <span className="truncate">Lưu trữ dự án: {project.name}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'info' ? (
                            "Hành động này sẽ chuyển dự án sang trạng thái lưu trữ và giải phóng dung lượng."
                        ) : (
                            <span className="text-destructive font-bold flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" />
                                CẢNH BÁO: Hành động này không thể hoàn tác!
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === 'info' ? (
                        <>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-2">
                                <p><strong>Điều gì sẽ xảy ra?</strong></p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Toàn bộ file gốc (video, 3D, image sequences) sẽ bị <strong>XÓA VĨNH VIỄN</strong>.</li>
                                    <li>Chỉ giữ lại ảnh thumbnail của phiên bản mới nhất để hiển thị.</li>
                                    <li>Dự án sẽ chuyển sang chế độ <strong>Chỉ đọc</strong> đối với khách hàng.</li>
                                    <li>Bình luận sẽ bị khóa.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="archive-url">Link lưu trữ dài hạn (Google Drive, NAS, etc.) *</Label>
                                <Input
                                    id="archive-url"
                                    placeholder="https://drive.google.com/..."
                                    value={archiveUrl}
                                    onChange={(e) => setArchiveUrl(e.target.value)}
                                    disabled={loading}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Bắt buộc nhập để có thể truy xuất lại file gốc khi cần trong tương lai.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    Xác nhận bạn đã sao lưu dữ liệu sang:
                                </p>
                                <div className="bg-background rounded px-3 py-2 border overflow-hidden">
                                    <span className="text-xs font-mono block break-all" title={archiveUrl}>
                                        {archiveUrl}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                                Toàn bộ file trên hệ thống Review sẽ bị <strong>xóa vĩnh viễn</strong> sau khi nhấn xác nhận.
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-text">
                                    Nhập <code className="bg-muted px-1.5 py-0.5 rounded font-bold">ARCHIVE</code> để xác nhận
                                </Label>
                                <Input
                                    id="confirm-text"
                                    placeholder="ARCHIVE"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                    disabled={loading}
                                    className="font-mono uppercase tracking-widest"
                                />
                            </div>
                        </div>
                    )}
                </div>


                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (step === 'confirm') setStep('info')
                            else onOpenChange(false)
                        }}
                        disabled={loading}
                    >
                        {step === 'confirm' ? 'Quay lại' : 'Hủy'}
                    </Button>
                    <Button
                        variant={step === 'confirm' ? 'destructive' : 'default'}
                        onClick={handleArchive}
                        disabled={loading || (step === 'info' && !archiveUrl.trim()) || (step === 'confirm' && confirmText !== 'ARCHIVE')}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {step === 'info' ? 'Tiếp theo' : 'Xác nhận xóa & lưu trữ'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
