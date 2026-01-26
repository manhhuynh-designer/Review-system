import { Button } from '@/components/ui/button'
import { SkipBack, SkipForward, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface VideoControlsProps {
    onPrevFrame: () => void
    onNextFrame: () => void
    onSkipBackward: () => void
    onSkipForward: () => void
    onPrevMarker?: () => void
    onNextMarker?: () => void
    onFirstMarker?: () => void
    onLastMarker?: () => void
    disabled?: boolean
    currentFps?: number
    mode?: 'frame' | 'marker'
    onModeChange?: (mode: 'frame' | 'marker') => void
}

export function VideoFrameControls({
    onPrevFrame,
    onNextFrame,
    onSkipBackward,
    onSkipForward,
    onPrevMarker,
    onNextMarker,
    onFirstMarker,
    onLastMarker,
    disabled = false,
    currentFps = 30,
    mode = 'frame',
    onModeChange
}: VideoControlsProps) {
    const isFrameMode = mode === 'frame'
    const isMarkerMode = mode === 'marker'

    return (
        <div className="flex items-center justify-center gap-2 sm:gap-3 py-2 sm:py-3 px-2 sm:px-4 bg-gradient-to-r from-muted/40 via-muted/30 to-muted/40 rounded-lg border border-border/50">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={isFrameMode ? onSkipBackward : onFirstMarker}
                    disabled={disabled || (isMarkerMode && !onFirstMarker)}
                    title={isFrameMode ? "Lùi 5 giây (J)" : "Marker đầu tiên"}
                    className="h-9 sm:h-9 px-3 sm:px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    {isFrameMode ? (
                        <>
                            <SkipBack className="w-4 h-4" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">5s</span>
                        </>
                    ) : (
                        <>
                            <ChevronsLeft className="w-4 h-4" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">First</span>
                        </>
                    )}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={isFrameMode ? onPrevFrame : onPrevMarker}
                    disabled={disabled || (isMarkerMode && !onPrevMarker)}
                    title={isFrameMode ? `Frame trước (1/${currentFps}s)` : "Marker trước"}
                    className="h-9 sm:h-9 px-3 sm:px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1.5 text-xs font-medium">
                        {isFrameMode ? '-1F' : 'Prev'}
                    </span>
                </Button>
            </div>

            {/* Mode Toggle Button */}
            <div
                className="hidden sm:flex px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
                onClick={() => onModeChange?.(isFrameMode ? 'marker' : 'frame')}
                title="Click để chuyển đổi chế độ"
            >
                <span className="text-xs font-semibold text-primary">
                    {isFrameMode ? 'Frame Navigation' : 'Marker Navigation'}
                </span>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={isFrameMode ? onNextFrame : onNextMarker}
                    disabled={disabled || (isMarkerMode && !onNextMarker)}
                    title={isFrameMode ? `Frame tiếp theo (1/${currentFps}s)` : "Marker tiếp theo"}
                    className="h-9 sm:h-9 px-3 sm:px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    <span className="hidden sm:inline mr-1.5 text-xs font-medium">
                        {isFrameMode ? '+1F' : 'Next'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={isFrameMode ? onSkipForward : onLastMarker}
                    disabled={disabled || (isMarkerMode && !onLastMarker)}
                    title={isFrameMode ? "Tiến 5 giây (L)" : "Marker cuối cùng"}
                    className="h-9 sm:h-9 px-3 sm:px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                    {isFrameMode ? (
                        <>
                            <span className="hidden sm:inline mr-1.5 text-xs font-medium">5s</span>
                            <SkipForward className="w-3 h-3 sm:w-4 sm:h-4" />
                        </>
                    ) : (
                        <>
                            <span className="hidden sm:inline mr-1.5 text-xs font-medium">Last</span>
                            <ChevronsRight className="w-3 h-3 sm:w-4 sm:h-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
