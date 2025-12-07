import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useFileStore } from '@/stores/files'
import { formatFileSize } from '@/lib/utils'
import { Upload, X, Film, FolderOpen, AlertCircle } from 'lucide-react'

interface SequenceUploaderProps {
  projectId: string
  existingFileId?: string
  onUploadComplete?: () => void
}

export function SequenceUploader({ projectId, existingFileId, onUploadComplete }: SequenceUploaderProps) {
  const { uploadSequence, uploading, uploadProgress } = useFileStore()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sequenceName, setSequenceName] = useState('')
  const [fps, setFps] = useState(24)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return
    
    // Validate all files are images
    const invalidFiles = files.filter(f => !f.type.startsWith('image/'))
    if (invalidFiles.length > 0) {
      setError(`${invalidFiles.length} file(s) không phải là ảnh`)
      return
    }
    
    // Sort by name for correct frame order
    const sorted = files.sort((a, b) => a.name.localeCompare(b.name))
    setSelectedFiles(sorted)
    setError(null)
    
    // Auto-generate name from first file if empty
    if (!sequenceName && sorted.length > 0) {
      const baseName = sorted[0].name.replace(/\d+\..*$/, '').replace(/[_-]$/, '')
      setSequenceName(baseName || 'Image Sequence')
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Chưa chọn file nào')
      return
    }
    
    if (!sequenceName.trim()) {
      setError('Vui lòng nhập tên sequence')
      return
    }
    
    try {
      await uploadSequence(projectId, selectedFiles, sequenceName.trim(), fps, existingFileId)
      setSelectedFiles([])
      setSequenceName('')
      setFps(24)
      setError(null)
      if (inputRef.current) inputRef.current.value = ''
      onUploadComplete?.()
    } catch (err: any) {
      setError(err.message || 'Upload thất bại')
    }
  }

  const handleClear = () => {
    setSelectedFiles([])
    setSequenceName('')
    setFps(24)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="space-y-4">
      {/* File Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Chọn ảnh trong sequence</Label>
          {selectedFiles.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedFiles.length} files • {formatFileSize(totalSize)}
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
            aria-label="Chọn nhiều ảnh cho sequence"
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Chọn nhiều ảnh
          </Button>
          {selectedFiles.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              disabled={uploading}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Preview selected files */}
        {selectedFiles.length > 0 && (
          <div className="rounded-lg border p-3 bg-muted/30 max-h-40 overflow-y-auto">
            <div className="text-xs font-medium mb-2 text-muted-foreground">
              Frames (sắp xếp theo tên file):
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {selectedFiles.slice(0, 10).map((file, i) => (
                <div key={i} className="truncate text-muted-foreground">
                  {i + 1}. {file.name}
                </div>
              ))}
              {selectedFiles.length > 10 && (
                <div className="col-span-2 text-muted-foreground italic">
                  ...và {selectedFiles.length - 10} files khác
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sequence Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="sequence-name">Tên sequence</Label>
          <Input
            id="sequence-name"
            placeholder="VD: Character Animation"
            value={sequenceName}
            onChange={(e) => setSequenceName(e.target.value)}
            disabled={uploading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fps">FPS (Frames per second)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="fps"
              type="number"
              min={1}
              max={120}
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value) || 24)}
              disabled={uploading}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              {selectedFiles.length > 0 && (
                <>≈ {(selectedFiles.length / fps).toFixed(1)}s</>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Upload Button */}
      {uploading ? (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Đang upload frames...</span>
              <span className="text-muted-foreground">{selectedFiles.length} files • {uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
      ) : (
        <Button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || !sequenceName.trim()}
          className="w-full"
          size="lg"
        >
          <Upload className="w-4 h-4 mr-2" />
          {existingFileId ? 'Tải phiên bản mới' : 'Tải sequence lên'}
        </Button>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Film className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <div className="font-medium">Lưu ý về Image Sequence:</div>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
            <li>Chọn nhiều ảnh cùng lúc (Ctrl+A hoặc Shift+Click)</li>
            <li>Tên file nên có số thứ tự (VD: frame_001.png, frame_002.png)</li>
            <li>Tất cả ảnh sẽ được sắp xếp theo tên file</li>
            <li>Hỗ trợ các định dạng: JPG, PNG, WebP, GIF</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
