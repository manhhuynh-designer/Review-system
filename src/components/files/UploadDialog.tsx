import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileUploader } from './FileUploader'
import { SequenceUploader } from './SequenceUploader'
import { Upload, Plus, Film, FileImage } from 'lucide-react'

interface UploadDialogProps {
  projectId: string
  existingFileId?: string
  trigger?: React.ReactNode
  initialFiles?: File[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function UploadDialog({ projectId, existingFileId, trigger, initialFiles, open: controlledOpen, onOpenChange: setControlledOpen }: UploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('single')

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen

  const handleUploadComplete = () => {
    setOpen(false)
    setActiveTab('single') // Reset to single mode
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            {existingFileId ? (
              <>
                <Plus className="w-4 h-4" />
                Thêm phiên bản
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Tải tài liệu lên
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {existingFileId ? 'Tải phiên bản mới' : 'Tải tài liệu lên'}
          </DialogTitle>
        </DialogHeader>

        {!existingFileId && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="gap-2">
                <FileImage className="w-4 h-4" />
                File đơn
              </TabsTrigger>
              <TabsTrigger value="sequence" className="gap-2">
                <Film className="w-4 h-4" />
                Image Sequence
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <FileUploader
                projectId={projectId}
                existingFileId={existingFileId}
                onUploadComplete={handleUploadComplete}
                initialFiles={initialFiles}
              />
            </TabsContent>

            <TabsContent value="sequence" className="mt-4">
              <SequenceUploader
                projectId={projectId}
                onUploadComplete={handleUploadComplete}
              />
            </TabsContent>
          </Tabs>
        )}

        {existingFileId && (
          <div className="space-y-4">
            <FileUploader
              projectId={projectId}
              existingFileId={existingFileId}
              onUploadComplete={handleUploadComplete}
              initialFiles={initialFiles}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}