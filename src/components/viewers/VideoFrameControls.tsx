import { Button } from '@/components/ui/button'
import { SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react'

interface VideoControlsProps {
    onPrevFrame: () => void
    onNextFrame: () => void
    onSkipBackward: () => void
    onSkipForward: () => void
    disabled?: boolean
    currentFps?: number
}

export function VideoFrameControls({
    onPrevFrame,
    onNextFrame,
    onSkipBackward,
    onSkipForward,
    disabled = false,
    currentFps = 30
}: VideoControlsProps) {
    return (
        <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40 rounded-lg border border-border/50">
            <div className="flex items-center gap-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSkipBackward}
                    disabled={disabled}
                    title="Lùi 5 giây (J)"
                    className="h-9 px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <SkipBack className="w-4 h-4" />
                    <span className="ml-1.5 text-xs font-medium">5s</span>
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrevFrame}
                    disabled={disabled}
                    title={`Frame trước (1/${currentFps}s)`}
                    className="h-9 px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="ml-1.5 text-xs font-medium">-1F</span>
                </Button>
            </div>

            <div className="px-4 py-1.5 bg-primary/10 rounded-md border border-primary/20">
                <span className="text-xs font-semibold text-primary">Frame Navigation</span>
            </div>

            <div className="flex items-center gap-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextFrame}
                    disabled={disabled}
                    title={`Frame tiếp theo (1/${currentFps}s)`}
                    className="h-9 px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <span className="mr-1.5 text-xs font-medium">+1F</span>
                    <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSkipForward}
                    disabled={disabled}
                    title="Tiến 5 giây (L)"
                    className="h-9 px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <span className="mr-1.5 text-xs font-medium">5s</span>
                    <SkipForward className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
