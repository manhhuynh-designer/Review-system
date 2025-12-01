import { useState, useEffect } from 'react'
import { useClientStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import type { Client } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client
}

export function ClientDialog({ open, onOpenChange, client }: Props) {
  const user = useAuthStore(s => s.user)
  const { createClient, updateClient, loading } = useClientStore()
  
  const [name, setName] = useState(client?.name || '')
  const [email, setEmail] = useState(client?.email || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [company, setCompany] = useState(client?.company || '')
  const [notes, setNotes] = useState(client?.notes || '')

  // Update form when client prop changes or dialog opens
  useEffect(() => {
    if (open && client) {
      setName(client.name || '')
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setCompany(client.company || '')
      setNotes(client.notes || '')
    }
  }, [open, client])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !user?.email) return

    try {
      if (client) {
        await updateClient(client.id, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          notes: notes.trim() || undefined,
        })
      } else {
        await createClient({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          notes: notes.trim() || undefined,
        }, user.email)
      }
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error('Client save failed:', error)
    }
  }

  const resetForm = () => {
    if (!client) {
      setName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setNotes('')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm()
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên khách hàng *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Công ty <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Tên công ty"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú <span className="text-xs text-muted-foreground">(Tùy chọn)</span></Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú về khách hàng..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Hủy
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {client ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
