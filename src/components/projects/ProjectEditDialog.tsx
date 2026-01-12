import { useState, useEffect } from 'react'
import { useProjectStore } from '@/stores/projects'
import { useClientStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, X, UserPlus, Link2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ClientDialog } from '@/components/clients/ClientDialog'

interface Props {
  project: Project
  triggerAsMenuItem?: boolean
}

export function ProjectEditDialog({ project, triggerAsMenuItem = false }: Props) {
  const [open, setOpen] = useState(false)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [clientId, setClientId] = useState(project.clientId || '')
  const [deadline, setDeadline] = useState(
    project.deadline ? new Date(project.deadline.toMillis()).toISOString().split('T')[0] : ''
  )
  const [tags, setTags] = useState(project.tags?.join(', ') || '')
  const [archiveUrl, setArchiveUrl] = useState(project.archiveUrl || '')

  const { updateProject, loading } = useProjectStore()
  const { clients, subscribeToClients } = useClientStore()
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    if (user?.email && open) {
      subscribeToClients(user.email)
    }
  }, [user?.email, open, subscribeToClients])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const selectedClient = clientId && clientId !== 'none' ? clients.find(c => c.id === clientId) : null

      const updateData: Partial<Project> = {
        name: name.trim(),
        description: description.trim() || undefined,
        clientId: selectedClient ? clientId : undefined,
        clientName: selectedClient?.name || undefined,
        clientEmail: selectedClient?.email || undefined,
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : undefined,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        archiveUrl: archiveUrl.trim() || undefined
      }

      await updateProject(project.id, updateData)
      setOpen(false)
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {triggerAsMenuItem ? (
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault()
              setOpen(true)
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </DropdownMenuItem>
          ) : (
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa dự án</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên dự án *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên dự án"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Mô tả <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chi tiết về dự án..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Khách hàng <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
              <div className="flex gap-2">
                <Select value={clientId || 'none'} onValueChange={setClientId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Chọn khách hàng (tùy chọn)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không chọn</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{client.name}</span>
                          {client.company && (
                            <span className="text-xs text-muted-foreground">{client.company}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setClientDialogOpen(true)}
                  title="Thêm khách hàng mới"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="animation, 3d, urgent (phân tách bằng dấu phẩy)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="archiveUrl">Link lưu trữ <span className="text-xs text-muted-foreground">(Bắt buộc khi lưu trữ)</span></Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="archiveUrl"
                  value={archiveUrl}
                  onChange={(e) => setArchiveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4 mr-2" />
                Hủy
              </Button>
              <Button type="submit" disabled={loading || !name.trim()}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
      />
    </>
  )
}
