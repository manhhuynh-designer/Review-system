import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Mail, Loader2, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

interface EmailSettings {
    comment: boolean
    upload: boolean
    version: boolean
    resolve: boolean
}

interface UserSettings {
    defaultNotificationEmail?: string
    emailSettings?: EmailSettings
    updatedAt?: Date
}

const defaultEmailSettings: EmailSettings = {
    comment: true,
    upload: true,
    version: true,
    resolve: true
}

export function AccountSettingsDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notificationEmail, setNotificationEmail] = useState('')
    const [emailSettings, setEmailSettings] = useState<EmailSettings>(defaultEmailSettings)
    const { user } = useAuthStore()

    // Load user settings when dialog opens
    useEffect(() => {
        if (open && user?.email) {
            loadSettings()
        }
    }, [open, user?.email])

    const loadSettings = async () => {
        if (!user?.email) return
        setLoading(true)
        try {
            const settingsDoc = await getDoc(doc(db, 'userSettings', user.email))
            if (settingsDoc.exists()) {
                const data = settingsDoc.data() as UserSettings
                setNotificationEmail(data.defaultNotificationEmail || '')
                setEmailSettings({ ...defaultEmailSettings, ...data.emailSettings })
            }
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!user?.email) return
        setSaving(true)
        try {
            await setDoc(doc(db, 'userSettings', user.email), {
                defaultNotificationEmail: notificationEmail.trim() || null,
                emailSettings,
                updatedAt: new Date()
            }, { merge: true })
            toast.success('Đã lưu cài đặt')
            setOpen(false)
        } catch (error) {
            console.error('Failed to save settings:', error)
            toast.error('Không thể lưu cài đặt')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <Settings className="h-4 w-4" />
                    Cài đặt tài khoản
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Cài đặt tài khoản</DialogTitle>
                    <DialogDescription>
                        Quản lý cài đặt thông báo và tài khoản của bạn
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Email Notification Address */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-primary" />
                                <Label className="text-base font-medium">Email nhận thông báo</Label>
                            </div>
                            <div className="space-y-2 pl-6">
                                <Input
                                    id="notificationEmail"
                                    type="email"
                                    value={notificationEmail}
                                    onChange={(e) => setNotificationEmail(e.target.value)}
                                    placeholder="email-nhan-thongbao@example.com"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Email này sẽ nhận thông báo cho TẤT CẢ dự án (trừ khi dự án có cài đặt email riêng).
                                    <br />
                                    Để trống nếu muốn dùng email đăng nhập: <strong>{user?.email}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Notification Toggles */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-primary" />
                                <Label className="text-base font-medium">Tùy chọn thông báo Email</Label>
                            </div>
                            <div className="space-y-4 pl-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">Bình luận mới</Label>
                                        <p className="text-xs text-muted-foreground">Nhận email khi có bình luận mới</p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.comment}
                                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, comment: checked }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">File mới</Label>
                                        <p className="text-xs text-muted-foreground">Nhận email khi có file được tải lên</p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.upload}
                                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, upload: checked }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">Phiên bản mới</Label>
                                        <p className="text-xs text-muted-foreground">Nhận email khi có phiên bản mới của file</p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.version}
                                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, version: checked }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">Bình luận đã giải quyết</Label>
                                        <p className="text-xs text-muted-foreground">Nhận email khi bình luận được đánh dấu đã giải quyết</p>
                                    </div>
                                    <Switch
                                        checked={emailSettings.resolve}
                                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, resolve: checked }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                disabled={saving}
                            >
                                Hủy
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Lưu cài đặt
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
