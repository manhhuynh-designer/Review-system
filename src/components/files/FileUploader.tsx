import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useFileStore } from '@/stores/files'
import { formatFileSize } from '@/lib/utils'
import { Upload, X, CheckCircle, AlertCircle, FileImage, Video, Box } from 'lucide-react'

interface FileUploaderProps {
  projectId: string
  existingFileId?: string
  onUploadComplete?: () => void
}

const MAX_SIZE = 200 * 1024 * 1024 // 200MB for GLB files
const ALLOWED_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  // Videos
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  // 3D Models
  'model/gltf-binary': '.glb',
  'model/gltf+json': '.gltf',
  // Handle GLB files that might be detected as application/octet-stream
  'application/octet-stream': '.glb',
  // Documents
  'application/pdf': '.pdf'
}

export function FileUploader({ projectId, existingFileId, onUploadComplete }: FileUploaderProps) {
  const { uploadFile, uploading } = useFileStore()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_SIZE) {
      return `File quá lớn (${formatFileSize(file.size)}). Tối đa ${formatFileSize(MAX_SIZE)}.`
    }

    // Special handling for GLB files (might be detected as application/octet-stream)
    const isGLB = file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')
    const hasValidType = Object.keys(ALLOWED_TYPES).includes(file.type)

    if (!hasValidType && !isGLB) {
      const allowedExts = Object.values(ALLOWED_TYPES).join(', ')
      return `Định dạng không hỗ trợ. Chỉ chấp nhận: ${allowedExts}`
    }

    // Additional validation for GLB files
    if (isGLB && file.size < 100) {
      return 'File GLB có vẻ không hợp lệ (quá nhỏ)'
    }

    return null
  }

  const onSelect = async (file?: File) => {
    if (!file) return

    console.log('📂 File selected:', { name: file.name, size: file.size, type: file.type })

    setError(null)
    const validationError = validateFile(file)
    if (validationError) {
      console.warn('⚠️ Validation failed:', validationError)
      setError(validationError)
      return
    }

    setSelectedFile(file)

    try {
      console.log('🎯 Starting upload process...')
      await uploadFile(projectId, file, existingFileId)
      console.log('🎉 Upload completed successfully')
      setSelectedFile(null)
      setError(null)
      // Clear input
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      // Trigger completion callback
      onUploadComplete?.()
    } catch (err: any) {
      console.error('💥 Upload error caught:', err)
      const errorMsg = err.message || 'Upload thất bại'
      setError(errorMsg)
      setSelectedFile(null)
      // Clear input
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    await onSelect(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    await onSelect(file)
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Main Upload Area */}
      <div
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200
          ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border'}
          ${uploading ? 'opacity-70 pointer-events-none' : 'hover:border-primary/60 hover:bg-primary/[0.02]'}
          ${error ? 'border-destructive/50 bg-destructive/5' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false)
          }
        }}
        onDrop={onDrop}
      >
        {uploading ? (
          <div className="px-8 py-12 text-center">
            <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
            <div className="text-lg font-medium mb-2">Đang tải lên...</div>
            <div className="text-sm text-muted-foreground mb-4">{selectedFile?.name}</div>
            <div className="max-w-xs mx-auto">
              <Progress value={75} className="h-2" />
            </div>
          </div>
        ) : (
          <div className="px-8 py-12 text-center">
            <div className={`mx-auto w-16 h-16 mb-4 rounded-full flex items-center justify-center transition-all ${dragOver ? 'bg-primary/20 scale-110' : 'bg-muted/50'
              }`}>
              <Upload className={`w-8 h-8 transition-colors ${dragOver ? 'text-primary' : 'text-muted-foreground'
                }`} />
            </div>

            <div className="mb-6">
              <div className={`text-lg font-medium mb-2 transition-colors ${dragOver ? 'text-primary' : 'text-foreground'
                }`}>
                {existingFileId ? 'Tải phiên bản mới' : 'Kéo thả tệp tin vào đây'}
              </div>
              <div className="text-sm text-muted-foreground">
                hoặc nhấn vào nút bên dưới để chọn file
              </div>
            </div>

            {/* File Type Hints */}
            <div className="flex justify-center gap-6 mb-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileImage className="w-4 h-4 text-green-500" />
                <span>Hình ảnh</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Video className="w-4 h-4 text-blue-500" />
                <span>Video</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Box className="w-4 h-4 text-purple-500" />
                <span>3D GLB</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 flex items-center justify-center font-bold text-red-500 text-[10px] border border-red-500 rounded-[2px]">PDF</div>
                <span>PDF</span>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,.glb,.gltf,.pdf"
              className="hidden"
              aria-label={existingFileId ? 'Chọn file phiên bản mới' : 'Chọn file để tải lên'}
              onChange={onInputChange}
            />

            <Button
              size="lg"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={dragOver ? 'bg-primary' : ''}
            >
              <Upload className="w-4 h-4 mr-2" />
              {existingFileId ? 'Chọn phiên bản mới' : 'Chọn tệp tin'}
            </Button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-destructive mb-1">Lỗi tải file</div>
            <div className="text-xs text-destructive/80">{error}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="p-1 h-auto hover:bg-destructive/20">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {!uploading && !error && selectedFile && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/20">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-green-800 dark:text-green-200">Tải thành công</div>
            <div className="text-xs text-green-600 dark:text-green-400">{selectedFile.name}</div>
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">
          Hỗ trợ: JPG, PNG, WebP, GIF, MP4, MOV, WebM, GLB, GLTF, PDF • Tối đa {formatFileSize(MAX_SIZE)}
        </div>
      </div>
    </div>
  )
}
