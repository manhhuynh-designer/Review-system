import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useInvitationStore } from '@/stores/invitationStore'
import { Share2, Mail, Link as LinkIcon, Trash2, CheckCircle } from 'lucide-react'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

interface ProjectShareDialogProps {
    projectId: string
    resourceType?: 'project' | 'file'
    resourceId?: string
    resourceName?: string
    trigger?: React.ReactNode
}

export function ProjectShareDialog({
    projectId,
    resourceType = 'project',
    resourceId = projectId, // Default to projectId if not provided
    resourceName = 'Project',
    trigger
}: ProjectShareDialogProps) {
    const [open, setOpen] = useState(false)
    const [emails, setEmails] = useState('')
    const [isPrivate, setIsPrivate] = useState(false)
    const [sending, setSending] = useState(false)

    const {
        createInvitations,
        getInvitations,
        revokeInvitation,
        invitations
    } = useInvitationStore()

    // Subscribe to invitations when dialog is open
    useEffect(() => {
        if (open) {
            const unsubscribe = getInvitations(projectId)
            return () => unsubscribe()
        }
    }, [open, projectId, getInvitations])

    const handleSend = async () => {
        if (!emails.trim()) return

        setSending(true)
        // Split by comma, semicolon, space, or newline
        const emailList = emails
            .split(/[\s,;]+/)
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes('@'))

        if (emailList.length === 0) {
            setSending(false)
            return
        }

        try {
            await createInvitations(projectId, emailList, resourceType, resourceId, isPrivate)
            setEmails('')
            // Don't close dialog, let user see it sent
        } catch (error) {
            // Toast handled in store
        } finally {
            setSending(false)
        }
    }

    const filteredInvitations = invitations.filter(
        inv => inv.resourceId === resourceId
    )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Share2 className="h-4 w-4" />
                        Chia sẻ
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Chia sẻ {resourceType === 'project' ? 'Dự án' : 'File'}</DialogTitle>
                    <DialogDescription>
                        Quản lý quyền truy cập cho <span className="font-medium text-foreground">{resourceName}</span>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="invite" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="invite">Gửi lời mời</TabsTrigger>
                        <TabsTrigger value="manage">Quản lý truy cập ({filteredInvitations.filter(i => i.status !== 'revoked').length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="invite" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="emails">Email người nhận</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <textarea
                                    id="emails"
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-10 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="nhanvien@congty.com, khachhang@gmail.com..."
                                    value={emails}
                                    onChange={(e) => setEmails(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Nhập nhiều email cách nhau bằng dấu phẩy, khoảng trắng hoặc xuống dòng.
                            </p>
                        </div>

                        <div className="flex items-start space-x-2 border rounded-md p-3 bg-muted/30">
                            <Checkbox
                                id="private"
                                checked={isPrivate}
                                onCheckedChange={(c) => setIsPrivate(c as boolean)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label
                                    htmlFor="private"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Chế độ bảo mật (OTP)
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Người nhận sẽ cần xác thực mã OTP gửi về email mỗi khi truy cập trên thiết bị mới.
                                    Link sẽ không thể chia sẻ công khai.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={handleSend} disabled={sending || !emails.trim()}>
                                {sending ? 'Đang gửi...' : 'Gửi lời mời'}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="manage" className="space-y-4">
                        {filteredInvitations.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Chưa có lời mời nào được gửi cho tài nguyên này.
                            </div>
                        ) : (
                            <div className="rounded-md border max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Trạng thái</TableHead>
                                            <TableHead>Ngày gửi</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredInvitations.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{inv.email}</span>
                                                        {inv.allowedDevices?.length > 0 && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {inv.allowedDevices.length} thiết bị
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {inv.status === 'accepted' && (
                                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Đã nhận
                                                        </Badge>
                                                    )}
                                                    {inv.status === 'pending' && (
                                                        <Badge variant="secondary">
                                                            <Clock className="w-3 h-3 mr-1" /> Đang chờ
                                                        </Badge>
                                                    )}
                                                    {inv.status === 'revoked' && (
                                                        <Badge variant="destructive">
                                                            <LinkIcon className="w-3 h-3 mr-1" /> Đã hủy
                                                        </Badge>
                                                    )}
                                                    {inv.status === 'expired' && (
                                                        <Badge variant="outline" className="text-muted-foreground">
                                                            Hết hạn
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(inv.createdAt.toMillis(), { addSuffix: true, locale: vi })}
                                                </TableCell>
                                                <TableCell>
                                                    {inv.status !== 'revoked' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            onClick={() => revokeInvitation(inv.id)}
                                                            title="Hủy quyền truy cập"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
