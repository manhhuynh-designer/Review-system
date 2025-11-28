import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'

export function ProjectCreateDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createProject = useProjectStore(s => s.createProject)
  const user = useAuthStore(s => s.user)

  const onCreate = async () => {
    if (!name.trim() || !user?.email) return
    await createProject(name.trim(), user.email)
    setName('')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tạo dự án</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo dự án mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="project-name">Tên dự án</Label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: TVC - Spring 2026" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={onCreate} disabled={!name.trim()}>Tạo</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
