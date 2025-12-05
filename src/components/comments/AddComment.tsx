import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Send, PenTool, Image, X, Paperclip, Camera } from 'lucide-react'

interface AttachmentPreview {
    id: string
    file: File
    url: string
    type: 'image' | 'file'
}

interface AddCommentProps {
    onSubmit: (userName: string, content: string, timestamp?: number, parentCommentId?: string, annotationData?: string | null, attachments?: File[], captureView?: boolean) => Promise<void>
    currentTimestamp?: number
    showTimestamp?: boolean
    userName?: string
    onUserNameChange?: (name: string) => void
    isSequence?: boolean // For image sequences, timestamp is frame number
    annotationData?: any[] | null
    onAnnotationClick?: () => void
    canCaptureView?: boolean
}

export function AddComment({
    onSubmit,
    currentTimestamp,
    showTimestamp = false,
    userName: initialUserName,
    onUserNameChange,
    isSequence = false,
    annotationData,
    onAnnotationClick,
    canCaptureView
}: AddCommentProps) {
    const [userName, setUserName] = useState(initialUserName || '')
    const [content, setContent] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [attachments, setAttachments] = useState<AttachmentPreview[]>([])
    const [captureView, setCaptureView] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!userName.trim() || !content.trim()) return

        setSubmitting(true)
        try {
            const attachmentFiles = attachments.map(att => att.file)
            await onSubmit(
                userName.trim(),
                content.trim(),
                showTimestamp ? currentTimestamp : undefined,
                undefined,
                null, // annotationData is handled by parent
                attachmentFiles.length > 0 ? attachmentFiles : undefined,
                captureView
            )
            // Clear immediately on success
            setContent('')
            setAttachments([])
            setCaptureView(false)
            if (onUserNameChange) {
                onUserNameChange(userName.trim())
            }
        } catch (error) {
            // Keep content on error so user can retry
            console.error('Failed to submit comment:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        handleFiles(files)
    }

    const handleFiles = (files: File[]) => {
        const validFiles = files.filter(file => {
            // Accept images and some common file types
            return file.type.startsWith('image/') ||
                ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)
        })

        const newAttachments: AttachmentPreview[] = validFiles.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : 'file'
        }))

        setAttachments(prev => [...prev, ...newAttachments])

        // Clear file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items || [])
        const imageFiles: File[] = []

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    imageFiles.push(file)
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault()
            handleFiles(imageFiles)
        }
    }

    const removeAttachment = (id: string) => {
        setAttachments(prev => {
            const updated = prev.filter(att => att.id !== id)
            // Cleanup object URLs to prevent memory leaks
            const toRemove = prev.find(att => att.id === id)
            if (toRemove) {
                URL.revokeObjectURL(toRemove.url)
            }
            return updated
        })
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        handleFiles(files)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const formatTime = (seconds?: number) => {
        if (seconds === undefined || seconds === null) return ''
        if (isSequence) {
            return `Frame ${Math.floor(seconds) + 1}`
        }
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const hasAnnotations = annotationData && annotationData.length > 0

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {!initialUserName && (
                <Input
                    placeholder="Tên của bạn"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                    className="text-sm"
                />
            )}

            <div className="space-y-2">
                <Textarea
                    ref={textareaRef}
                    placeholder={showTimestamp && currentTimestamp !== undefined
                        ? `Bình luận tại ${formatTime(currentTimestamp)}...`
                        : 'Viết bình luận...'}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    required
                    rows={3}
                    className="text-sm resize-none min-h-[80px]"
                />

                {/* Attachment Previews */}
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {attachments.map(attachment => (
                            <div key={attachment.id} className="relative group">
                                {attachment.type === 'image' ? (
                                    <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                                        <img
                                            src={attachment.url}
                                            alt={attachment.file.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => removeAttachment(attachment.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md border border-border">
                                        <Paperclip className="w-4 h-4" />
                                        <span className="text-xs truncate max-w-20">{attachment.file.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 hover:bg-destructive hover:text-destructive-foreground"
                                            onClick={() => removeAttachment(attachment.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.txt,.doc,.docx"
                            onChange={handleFileSelect}
                            className="hidden"
                            aria-label="Chọn file đính kèm"
                        />

                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            title="Đính kèm file"
                        >
                            <Image className="w-4 h-4" />
                        </Button>

                        {canCaptureView && (
                            <Button
                                type="button"
                                size="sm"
                                variant={captureView ? 'secondary' : 'ghost'}
                                onClick={() => setCaptureView(!captureView)}
                                className={`h-8 px-2 ${!captureView ? 'text-muted-foreground hover:text-foreground' : ''}`}
                                title={captureView ? 'Đã lưu góc nhìn' : 'Lưu góc nhìn hiện tại'}
                            >
                                <Camera className="w-4 h-4 mr-1" />
                                {captureView && <span className="text-xs">Đã lưu</span>}
                            </Button>
                        )}

                        {onAnnotationClick && (
                            <Button
                                type="button"
                                size="sm"
                                variant={hasAnnotations ? 'secondary' : 'ghost'}
                                onClick={onAnnotationClick}
                                className={`h-8 px-2 ${!hasAnnotations ? 'text-muted-foreground hover:text-foreground' : ''}`}
                                title={hasAnnotations ? `${annotationData.length} annotations` : 'Add annotation'}
                            >
                                <PenTool className="w-4 h-4 mr-1" />
                                {hasAnnotations && <span className="text-xs">Đã vẽ</span>}
                            </Button>
                        )}
                    </div>

                    <Button
                        type="submit"
                        size="sm"
                        disabled={submitting || !userName.trim() || (!content.trim() && attachments.length === 0)}
                        className="h-8 px-4"
                    >
                        <Send className="w-3 h-3 mr-2" />
                        Gửi
                    </Button>
                </div>
            </div>
        </form>
    )
}
