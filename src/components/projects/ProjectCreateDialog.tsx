import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjectStore } from '@/stores/projects'
import { useClientStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { Plus, UserPlus } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ClientDialog } from '@/components/clients/ClientDialog'

export function ProjectCreateDialog() {
  const [open, setOpen] = useState(false)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState<string>('none')
  const [deadline, setDeadline] = useState('')
  const [tags, setTags] = useState('')
  
  const createProject = useProjectStore(s => s.createProject)
  const user = useAuthStore(s => s.user)
  const { clients, subscribeToClients } = useClientStore()

  useEffect(() => {
    if (user?.email && open) {
      subscribeToClients(user.email)
    }
  }, [user?.email, open, subscribeToClients])

  const onCreate = async () => {
    if (!name.trim() || !user?.email) return
    
    const selectedClient = clientId && clientId !== 'none' ? clients.find(c => c.id === clientId) : null
    
    const projectData: Partial<any> = {
      name: name.trim(),
      adminEmail: user.email,
      description: description.trim() || undefined,
      tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
    }

    if (selectedClient) {
      projectData.clientId = clientId
      projectData.clientName = selectedClient.name
      projectData.clientEmail = selectedClient.email
    }

    if (deadline) {
      projectData.deadline = Timestamp.fromDate(new Date(deadline))
    }

    await createProject(projectData)
    
    // Reset form
    setName('')
    setDescription('')
    setClientId('none')
    setDeadline('')
    setTags('')
    setOpen(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Tạo dự án
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo dự án mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Tên dự án *</Label>
              <Input 
                id="project-name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ví dụ: TVC - Spring 2026"
                autoFocus
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
                <Select value={clientId} onValueChange={setClientId}>
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
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={onCreate} disabled={!name.trim()}>Tạo dự án</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
      />
    </>
  )
}
