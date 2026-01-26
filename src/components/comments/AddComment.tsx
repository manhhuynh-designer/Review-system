import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextarea, type RichTextareaRef } from '@/components/ui/rich-textarea'
import { Send, PenTool, Image, X, Paperclip, Camera, Link as LinkIcon } from 'lucide-react'
import { LinkDialog } from '@/components/ui/link-dialog'
import toast from 'react-hot-toast'

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
    isMobile?: boolean // Distinguish mobile from desktop for unique IDs
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
    canCaptureView,
    isMobile = false
}: AddCommentProps) {
    const [userName, setUserName] = useState(initialUserName || '')
    const [content, setContent] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Anti-spam measures
    const [honeypotWebsite, setHoneypotWebsite] = useState('')
    const [honeypotPhone, setHoneypotPhone] = useState('')
    const [honeypotEmail, setHoneypotEmail] = useState('')
    const startTimeRef = useRef(Date.now())
    const [attachments, setAttachments] = useState<AttachmentPreview[]>([])
    const [captureView, setCaptureView] = useState(false)
    const [showLinkDialog, setShowLinkDialog] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<RichTextareaRef>(null)
    const [focused, setFocused] = useState(false)

    // Expand textarea when focused or typing
    const computedRows = focused || content.length > 0 ? 5 : 3

    // Detect pasted/typed URLs and wrap with markdown [title](url) for editable display text
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/

    const getDefaultTitle = (raw: string) => {
        const url = raw.startsWith('www.') ? `https://${raw}` : raw
        try {
            const u = new URL(url)
            return u.hostname.replace(/^www\./, '')
        } catch {
            return raw
        }
    }

    const wrapUrlIfNeeded = async (text: string): Promise<string> => {
        // skip if already markdown link
        if (/\[[^\]]+\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/.test(text)) return text
        const m = text.match(urlRegex)
        if (!m) return text
        const raw = m[0]
        const title = getDefaultTitle(raw)
        // replace first occurrence; user can edit the [title] inline
        return text.replace(raw, `[${title}](${raw})`)
    }

    const insertMarkdownLink = (url: string, title: string) => {
        const markdown = `[${title}](${url})`

        const el = textareaRef.current
        if (el) {
            const start = el.selectionStart ?? content.length
            const end = el.selectionEnd ?? content.length
            const newVal = content.slice(0, start) + markdown + content.slice(end)
            setContent(newVal)
            // restore cursor after next tick
            setTimeout(() => {
                el.focus()
                const pos = start + markdown.length
                el.setSelectionRange(pos, pos)
            }, 0)
        } else {
            setContent((prev) => prev + markdown)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!userName.trim() || !content.trim()) return

        // Anti-spam validation
        const timeSpent = Date.now() - startTimeRef.current

        // Check honeypot fields (should be empty)
        if (honeypotWebsite || honeypotPhone || honeypotEmail) {
            console.warn('Bot detected: honeypot fields filled')
            return
        }

        // Minimum time check (human users take time to type)
        if (timeSpent < 3000) {
            toast.error('Vui lòng đợi một chút trước khi gửi bình luận')
            return
        }

        // Content length validation
        if (content.trim().length < 5) {
            toast.error('Bình luận quá ngắn (tối thiểu 5 ký tự)')
            return
        }

        if (content.trim().length > 2000) {
            toast.error('Bình luận quá dài (tối đa 2000 ký tự)')
            return
        }

        if (userName.trim().length > 100) {
            toast.error('Tên quá dài (tối đa 100 ký tự)')
            return
        }

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

        // If not images, try to detect URL and convert to markdown link
        if (imageFiles.length === 0) {
            const pastedText = e.clipboardData.getData('text')
            if (urlRegex.test(pastedText)) {
                e.preventDefault()
                const newText = await wrapUrlIfNeeded(content + pastedText)
                setContent(newText)
            }
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
            {/* Honeypot fields - hidden from users, visible to bots */}
            <div className="hidden" aria-hidden="true">
                <input
                    type="text"
                    name="website"
                    value={honeypotWebsite}
                    onChange={(e) => setHoneypotWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                />
                <input
                    type="tel"
                    name="phone"
                    value={honeypotPhone}
                    onChange={(e) => setHoneypotPhone(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                />
                <input
                    type="email"
                    name="email"
                    value={honeypotEmail}
                    onChange={(e) => setHoneypotEmail(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

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
                <RichTextarea
                    ref={textareaRef}
                    placeholder={showTimestamp && currentTimestamp !== undefined
                        ? `Bình luận tại ${formatTime(currentTimestamp)}...`
                        : 'Viết bình luận...'}
                    value={content}
                    onChange={async (val) => {
                        // Attempt to wrap URL when user types a space after it
                        if (urlRegex.test(val)) {
                            const newVal = await wrapUrlIfNeeded(val)
                            setContent(newVal)
                        } else {
                            setContent(val)
                        }
                    }}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    required
                    rows={computedRows}
                    minRows={3}
                    maxRows={8}
                    className=""
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
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1 max-w-[calc(100%-80px)] scrollbar-hide">
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
                            id={isMobile ? "mobile-comment-attach-button" : "comment-attach-button"}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            title="Đính kèm file"
                        >
                            <Image className="w-4 h-4" />
                        </Button>

                        {/* Insert Link */}
                        <Button
                            id={isMobile ? "mobile-comment-link-button" : "comment-link-button"}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowLinkDialog(true)}
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                            title="Chèn liên kết"
                        >
                            <LinkIcon className="w-4 h-4" />
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
                                id={isMobile ? "mobile-comment-draw-button" : "comment-draw-button"}
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
                        {submitting ? (
                            <span className="flex items-center">
                                {/* Simple spinner using animate-spin */}
                                <span className="mr-2 inline-block h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" aria-hidden="true" />
                                Đang gửi...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                <Send className="w-3 h-3 mr-2" />
                                Gửi
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            <LinkDialog
                open={showLinkDialog}
                onOpenChange={setShowLinkDialog}
                onInsert={insertMarkdownLink}
            />
        </form>
    )
}
