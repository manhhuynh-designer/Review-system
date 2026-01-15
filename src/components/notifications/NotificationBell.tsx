import { useEffect, useState } from 'react'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useFileStore } from '@/stores/files'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Check,
  CheckCheck,
  FileUp,
  MessageSquare,
  CheckCircle2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

export function NotificationBell() {
  const { user } = useAuthStore()
  const {
    notifications,
    unreadCount,
    subscribeToNotifications,
    markAsRead,
    markAllAsRead,
    cleanup
  } = useNotificationStore()
  const { files, selectFile } = useFileStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (user?.email) {
      const normalized = user.email.toLowerCase()

      subscribeToNotifications(normalized)
    } else {

    }
    return () => {

      cleanup()
    }
  }, [user?.email, subscribeToNotifications, cleanup])

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    // If notification has fileId, find and select the file
    if (notification.fileId) {
      const file = files.find(f => f.id === notification.fileId)
      if (file) {
        selectFile(file)
      }
    }

    // Navigate to project (will trigger FilesList to open dialog if file was selected)
    navigate(`/app/projects/${notification.projectId}`)
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    if (user?.email) {
      await markAllAsRead(user.email.toLowerCase())
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <FileUp className="h-4 w-4 text-green-500" />
      case 'comment':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'resolve':
        return <CheckCircle2 className="h-4 w-4 text-purple-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const displayNotifications = notifications.slice(0, 10)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-2 border-b">
          <h3 className="font-semibold text-sm">Thông báo</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Đánh dấu đã đọc
            </Button>
          )}
        </div>

        {displayNotifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Chưa có thông báo nào</p>
          </div>
        ) : (
          <>
            {displayNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.isRead ? 'bg-primary/5' : ''
                  }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="mt-0.5 shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm leading-tight line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(notification.createdAt.toDate(), {
                        addSuffix: true,
                        locale: vi
                      })}
                    </span>
                    {!notification.isRead && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
                {notification.isRead && (
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            {notifications.length > 10 && (
              <>
                <DropdownMenuSeparator />
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Hiển thị 10/{notifications.length} thông báo
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
