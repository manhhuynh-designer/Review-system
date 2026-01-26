import { File, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileViewToggleProps {
    activeView: 'file' | 'comments'
    onViewChange: (view: 'file' | 'comments') => void
    commentCount?: number
}

/**
 * Bottom navigation toggle bar for mobile file view
 * Switches between fullscreen file preview and fullscreen comments
 */
export function MobileViewToggle({
    activeView,
    onViewChange,
    commentCount = 0
}: MobileViewToggleProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t safe-area-pb">
            <div className="flex items-center justify-center p-2 gap-1">
                <div className="flex items-center bg-muted rounded-full p-1 gap-1">
                    {/* File View Toggle */}
                    <button
                        onClick={() => onViewChange('file')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out",
                            activeView === 'file'
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <File className="w-4 h-4" />
                        <span className="text-sm font-medium">Xem file</span>
                    </button>

                    {/* Comments View Toggle */}
                    <button
                        onClick={() => onViewChange('comments')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ease-out relative",
                            activeView === 'comments'
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm font-medium">Bình luận</span>
                        {/* Badge for comment count */}
                        {commentCount > 0 && activeView !== 'comments' && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1">
                                {commentCount > 99 ? '99+' : commentCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
