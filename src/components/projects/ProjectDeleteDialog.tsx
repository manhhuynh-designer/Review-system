import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/stores/projects'
import { Trash2 } from 'lucide-react'
import type { Project } from '@/types'

interface ProjectDeleteDialogProps {
  project: Project
}

export function ProjectDeleteDialog({ project }: ProjectDeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const deleteProject = useProjectStore(s => s.deleteProject)

  const handleDelete = async () => {
    try {
      await deleteProject(project.id)
      setOpen(false)
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            setOpen(true)
          }}
          onClick={(e) => e.stopPropagation()}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Xóa dự án
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa dự án</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn xóa dự án <strong>{project.name}</strong>?
            <br />
            <br />
            Hành động này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan đến dự án.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
            Xóa dự án
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
