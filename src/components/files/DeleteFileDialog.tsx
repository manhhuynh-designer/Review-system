import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  fileName: string
  loading?: boolean
}

export function DeleteFileDialog({ open, onOpenChange, onConfirm, fileName, loading }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa file</AlertDialogTitle>
          <AlertDialogDescription asChild className="space-y-2">
            <div>
              <p>
                Bạn có chắc chắn muốn xóa file <span className="font-semibold">"{fileName}"</span> không?
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Hành động này không thể hoàn tác. Tất cả phiên bản và bình luận liên quan sẽ bị xóa vĩnh viễn.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? 'Đang xóa...' : 'Xóa file'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
