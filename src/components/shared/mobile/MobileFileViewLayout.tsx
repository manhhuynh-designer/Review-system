import { useState, useEffect, type ReactNode } from 'react'
import { MobileViewToggle } from './MobileViewToggle'
import { Button } from '@/components/ui/button'
import {
    Download,
    Share2,
    X,
    Clock,
    ChevronDown,
    Layers,
    PenTool
} from 'lucide-react'
import { format } from 'date-fns'
import { formatFileSize } from '@/lib/utils'
import type { File as FileType, Comment, AnnotationObject } from '@/types'
import { CommentsList } from '@/components/comments/CommentsList'
import { AddComment } from '@/components/comments/AddComment'
import { AnnotationToolbar } from '@/components/annotations/AnnotationToolbar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MobileFileViewLayoutProps {
    // File info
    file: FileType
    current: any // Version data
    effectiveUrl: string

    // Render functions (passed from parent)
    renderFilePreview: () => ReactNode

    // Comments
    comments: Comment[]
    currentUserName: string
    onUserNameChange: (name: string) => void
    onAddComment: (userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[]) => Promise<void>
    onResolveToggle?: (commentId: string, isResolved: boolean) => void
    onEditComment?: (commentId: string, newContent: string) => Promise<void>
    onDeleteComment?: (commentId: string) => Promise<void>
    onTimestampClick?: (timestamp: number) => void
    onViewAnnotation?: (data: string, comment: any) => void

    // State
    isAdmin?: boolean
    isLocked?: boolean
    viewAllVersions: boolean
    onViewAllVersionsChange: (value: boolean) => void

    // Video/Sequence specific
    currentTimestamp?: number
    showTimestamp?: boolean

    // Annotation props
    isAnnotating?: boolean
    isReadOnly?: boolean
    annotationData?: AnnotationObject[] | null
    annotationTool?: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser'
    annotationColor?: string
    annotationStrokeWidth?: number
    onAnnotationClick?: () => void
    onAnnotationToolChange?: (tool: 'pen' | 'rect' | 'arrow' | 'select' | 'eraser') => void
    onAnnotationColorChange?: (color: string) => void
    onAnnotationStrokeWidthChange?: (width: number) => void
    onAnnotationUndo?: () => void
    onAnnotationRedo?: () => void
    onAnnotationClear?: () => void
    onAnnotationDone?: () => void
    canUndoAnnotation?: boolean
    canRedoAnnotation?: boolean

    // Actions
    onClose: () => void
    onDownload: (e: React.MouseEvent<HTMLAnchorElement>) => void
    onShare: () => void

    // Version switching
    uniqueVersions: any[]
    currentVersion: number
    onSwitchVersion?: (fileId: string, version: number) => void
}

/**
 * Mobile-specific layout for file viewing
 * Provides fullscreen toggle between file preview and comments
 * With full annotation support
 */
export function MobileFileViewLayout({
    file,
    current,
    effectiveUrl,
    renderFilePreview,
    comments,
    currentUserName,
    onUserNameChange,
    onAddComment,
    onResolveToggle,
    onEditComment,
    onDeleteComment,
    onTimestampClick,
    onViewAnnotation,
    isAdmin = false,
    isLocked = false,
    viewAllVersions,
    onViewAllVersionsChange,
    currentTimestamp,
    showTimestamp = false,
    // Annotation props
    isAnnotating = false,
    isReadOnly = false,
    annotationData,
    annotationTool = 'pen',
    annotationColor = '#ffff00',
    annotationStrokeWidth = 2,
    onAnnotationClick,
    onAnnotationToolChange,
    onAnnotationColorChange,
    onAnnotationStrokeWidthChange,
    onAnnotationUndo,
    onAnnotationRedo,
    onAnnotationClear,
    onAnnotationDone,
    canUndoAnnotation = false,
    canRedoAnnotation = false,
    // Actions
    onClose,
    onDownload,
    onShare,
    uniqueVersions,
    currentVersion,
    onSwitchVersion,
}: MobileFileViewLayoutProps) {
    const [activeView, setActiveView] = useState<'file' | 'comments'>('file')

    const uploadDate = current?.uploadedAt?.toDate ? current.uploadedAt.toDate() : new Date()

    // Lock body scroll when mobile view is active
    useEffect(() => {
        const originalStyle = document.body.style.overflow
        const originalPosition = document.body.style.position
        const originalWidth = document.body.style.width

        // Prevent scrolling on the underlying body
        document.body.style.overflow = 'hidden'
        // iOS fix: position fixed ensures no background scrolling
        document.body.style.position = 'fixed'
        document.body.style.width = '100%'

        return () => {
            document.body.style.overflow = originalStyle
            document.body.style.position = originalPosition
            document.body.style.width = originalWidth
        }
    }, [])

    // Handle switching to comments after annotation is done
    const handleSwitchToComments = () => {
        setActiveView('comments')
    }

    return (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* Header - Compact for mobile */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur-lg safe-area-pt">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {/* Version dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                                        v{currentVersion}
                                        <ChevronDown className="w-3 h-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                                    {(uniqueVersions || []).map((v: any) => (
                                        <DropdownMenuItem
                                            key={v.version}
                                            onClick={() => onSwitchVersion?.(file.id, v.version)}
                                            className={v.version === currentVersion ? 'bg-accent' : ''}
                                        >
                                            v{v.version}
                                            {v.version === currentVersion && ' (hiện tại)'}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <h2 className="font-medium text-sm truncate">{file.name}</h2>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{formatFileSize(current?.metadata?.size || 0)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(uploadDate, 'dd/MM/yyyy')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1">
                    {/* Annotation button - only show in file view */}
                    {activeView === 'file' && !isAnnotating && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={onAnnotationClick}
                            title="Thêm ghi chú"
                        >
                            <PenTool className="w-4 h-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onShare}
                    >
                        <Share2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                    >
                        <a
                            href={effectiveUrl}
                            download={file.name}
                            onClick={onDownload}
                        >
                            <Download className="w-4 h-4" />
                        </a>
                    </Button>
                </div>
            </div>



            {/* Annotation Status Bar - Show when viewing annotation */}
            {isAnnotating && isReadOnly && activeView === 'file' && (
                <div className="px-3 py-2 border-b bg-primary/5 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Đang xem ghi chú</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={onAnnotationDone}
                    >
                        Đóng
                    </Button>
                </div>
            )}

            {/* Content area with slide animation */}
            <div className="flex-1 relative overflow-hidden">
                {/* File View */}
                <div
                    className={`absolute inset-0 transition-transform duration-300 ease-out ${activeView === 'file' ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    <div className="w-full h-full overflow-auto pb-16">
                        {renderFilePreview()}
                    </div>
                </div>

                {/* Comments View */}
                <div
                    className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${activeView === 'comments' ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    {/* Comments Header */}
                    <div className="p-3 border-b flex items-center justify-between bg-muted/10 flex-shrink-0">
                        <div className="text-sm font-medium">
                            Bình luận ({comments.length})
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewAllVersionsChange(!viewAllVersions)}
                            className={`h-7 px-2 text-xs gap-1.5 ${viewAllVersions
                                ? 'bg-primary/10 text-primary border-primary/50'
                                : 'text-muted-foreground border-dashed'
                                }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{viewAllVersions ? 'Tất cả' : 'Phiên bản này'}</span>
                        </Button>
                    </div>

                    {/* Annotation Indicator - Show when there's pending annotation data */}
                    {annotationData && annotationData.length > 0 && !isReadOnly && (
                        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                            <span className="text-xs text-yellow-700 dark:text-yellow-400">
                                Ghi chú đã được thêm - Gửi bình luận để lưu
                            </span>
                        </div>
                    )}

                    {/* Comments List */}
                    <div className="flex-1 overflow-y-auto p-3 pb-32">
                        <CommentsList
                            comments={comments}
                            currentUserName={currentUserName}
                            onResolveToggle={onResolveToggle}
                            onTimestampClick={(timestamp) => {
                                onTimestampClick?.(timestamp)
                                // Switch to file view when clicking timestamp
                                setActiveView('file')
                            }}
                            onViewAnnotation={(data, comment) => {
                                onViewAnnotation?.(data, comment)
                                // Switch to file view to see annotation
                                setActiveView('file')
                            }}
                            onReply={async (parentCommentId, userName, content) => {
                                await onAddComment(userName, content, undefined, parentCommentId)
                            }}
                            isSequence={file.type === 'sequence'}
                            isAdmin={isAdmin}
                            onEdit={onEditComment}
                            onDelete={onDeleteComment}
                            isLocked={isLocked}
                            showVersionBadge={viewAllVersions}
                        />
                        {comments.length === 0 && (
                            <div className="text-center text-muted-foreground py-12">
                                <div className="text-4xl mb-2">💬</div>
                                <div>Chưa có bình luận nào</div>
                                <div className="text-xs mt-1 text-muted-foreground/60">
                                    Hãy là người đầu tiên bình luận
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Comment - Fixed at bottom */}
                    <div className="absolute bottom-16 left-0 right-0 p-3 border-t bg-background/95 backdrop-blur-lg safe-area-pb">
                        {isLocked ? (
                            <div className="text-center text-muted-foreground py-2 px-2 bg-muted/30 rounded-md">
                                <div className="flex items-center justify-center gap-2 text-xs">
                                    <span>🔒</span>
                                    <span>Bình luận đang tạm khóa</span>
                                </div>
                            </div>
                        ) : (
                            <AddComment
                                isMobile={true}
                                onSubmit={async (userName, content, timestamp, parentCommentId, annotationDataStr, attachments) => {
                                    await onAddComment(userName, content, timestamp, parentCommentId, annotationDataStr, attachments)
                                }}
                                userName={currentUserName}
                                onUserNameChange={onUserNameChange}
                                currentTimestamp={currentTimestamp}
                                showTimestamp={showTimestamp}
                                annotationData={!isReadOnly ? annotationData : null}
                                onAnnotationClick={() => {
                                    // Switch to file view and start annotation
                                    setActiveView('file')
                                    onAnnotationClick?.()
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Annotation Toolbar - Show when annotating */}
            {isAnnotating && !isReadOnly && activeView === 'file' && onAnnotationToolChange && (
                <div className="border-b bg-background/95 backdrop-blur-lg fixed bottom-0 left-0 right-0 z-[60] safe-area-pb">
                    <AnnotationToolbar
                        tool={annotationTool}
                        onToolChange={onAnnotationToolChange}
                        color={annotationColor}
                        onColorChange={onAnnotationColorChange || (() => { })}
                        strokeWidth={annotationStrokeWidth}
                        onStrokeWidthChange={onAnnotationStrokeWidthChange || (() => { })}
                        onUndo={onAnnotationUndo || (() => { })}
                        onRedo={onAnnotationRedo || (() => { })}
                        onClear={onAnnotationClear || (() => { })}
                        onDone={() => {
                            onAnnotationDone?.()
                            // Switch to comments to submit
                            handleSwitchToComments()
                        }}
                        canUndo={canUndoAnnotation}
                        canRedo={canRedoAnnotation}
                    />
                </div>
            )}

            {/* Bottom Toggle Navigation - Hide when annotating to show AnnotationToolbar */}
            {!isAnnotating && (
                <MobileViewToggle
                    activeView={activeView}
                    onViewChange={setActiveView}
                    commentCount={comments.length}
                />
            )}
        </div>
    )
}
