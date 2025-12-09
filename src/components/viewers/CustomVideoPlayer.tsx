import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback, memo } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, StickyNote, Camera } from 'lucide-react'
import type { Comment } from '@/types'
import './CustomVideoPlayer.css'

export interface CustomVideoPlayerRef {
    exportFrame: () => void
    seekTo: (time: number) => void
    pause: () => void
}

interface CustomVideoPlayerProps {
    src: string
    comments: Comment[]
    currentTime?: number
    onTimeUpdate: (time: number) => void
    onCommentMarkerClick: (comment: Comment) => void
    onLoadedMetadata?: (duration: number, fps: number) => void
    onFullscreenChange?: (isFullscreen: boolean) => void
    onExportFrame?: (dataUrl: string, timestamp: number) => void
    onPlay?: () => void
    onPause?: () => void
    className?: string
}

export const CustomVideoPlayer = memo(forwardRef<CustomVideoPlayerRef, CustomVideoPlayerProps>(({
    src,
    comments,
    currentTime,
    onTimeUpdate,
    onCommentMarkerClick,
    onLoadedMetadata,
    onFullscreenChange,
    onExportFrame,
    onPlay,
    onPause,
    className = ''
}, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [duration, setDuration] = useState(0)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [localCurrentTime, setLocalCurrentTime] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isPortrait, setIsPortrait] = useState(false)

    // Ref to track if the current time update was triggered by the video itself
    // This prevents the "fighting" loop where onTimeUpdate -> parent -> currentTime prop -> seek -> stutter
    const isUpdatingTimeRef = useRef(false)

    // Fullscreen change event listener
    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreen = !!document.fullscreenElement
            setIsFullscreen(fullscreen)
            onFullscreenChange?.(fullscreen)
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
        }
    }, [onFullscreenChange])

    useEffect(() => {
        const video = videoRef.current
        if (!video) return

        const handleLoadedMetadata = () => {
            const dur = video.duration
            setDuration(dur)

            // Detect aspect ratio
            const videoWidth = video.videoWidth
            const videoHeight = video.videoHeight
            if (videoWidth && videoHeight) {
                const ratio = videoWidth / videoHeight
                setIsPortrait(ratio < 1) // Portrait if width < height
            }

            onLoadedMetadata?.(dur, 30)
        }

        // Throttle timeupdate events using requestAnimationFrame
        // This reduces state updates while maintaining smooth progress bar
        let rafId: number | null = null
        let lastUpdateTime = 0
        const handleTimeUpdate = () => {
            if (rafId !== null) return // Already scheduled

            rafId = requestAnimationFrame(() => {
                const now = performance.now()
                // Update at most 10 times per second for smooth progress bar
                if (now - lastUpdateTime >= 100) {
                    setLocalCurrentTime(video.currentTime)

                    // Mark that we are updating the time, so the incoming prop change should be ignored
                    isUpdatingTimeRef.current = true
                    onTimeUpdate(video.currentTime)

                    lastUpdateTime = now
                }
                rafId = null
            })
        }

        const handlePlay = () => {
            setIsPlaying(true)
            onPlay?.()
        }
        const handlePause = () => {
            setIsPlaying(false)
            onPause?.()
        }

        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId)
            }
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('play', handlePlay)
            video.removeEventListener('pause', handlePause)
        }
    }, [onTimeUpdate, onLoadedMetadata, onPlay, onPause])

    // Seek to external currentTime changes (from frame navigation)
    useEffect(() => {
        const video = videoRef.current
        if (video && currentTime !== undefined && !isNaN(currentTime)) {
            // If this update was triggered by our own onTimeUpdate, ignore it
            if (isUpdatingTimeRef.current) {
                isUpdatingTimeRef.current = false
                return
            }

            const diff = Math.abs(video.currentTime - currentTime)
            // Use smaller threshold for frame-accurate seeking
            if (diff > 0.01) {
                video.currentTime = currentTime
                setLocalCurrentTime(currentTime)
            }
        }
    }, [currentTime])

    const handleMarkerClick = useCallback((comment: Comment) => {
        if (comment.timestamp !== null) {
            // Force reset the update flag to ensure we process the seek from props
            isUpdatingTimeRef.current = false

            if (videoRef.current) {
                videoRef.current.pause()
            }
            // Rely on parent prop update to trigger seek via useEffect
            // This avoids double-seeking and potential conflicts
            onCommentMarkerClick(comment)
        }
    }, [onCommentMarkerClick])

    const handlePlaybackRateChange = (rate: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = rate
            setPlaybackRate(rate)
        }
    }

    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause()
            } else {
                videoRef.current.play()
            }
        }
    }

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted
            setIsMuted(!isMuted)
        }
    }

    const toggleFullscreen = () => {
        const video = videoRef.current
        const container = containerRef.current
        
        // Check if we're currently in fullscreen
        const isCurrentlyFullscreen = document.fullscreenElement || 
            (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement

        if (isCurrentlyFullscreen) {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen()
            } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
                (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen()
            }
        } else {
            // Enter fullscreen - try container first, then video for iOS
            if (container?.requestFullscreen) {
                container.requestFullscreen().catch(() => {
                    // Fallback to video element fullscreen for iOS
                    if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
                        (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen()
                    }
                })
            } else if (container && (container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
                (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen()
            } else if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
                // iOS Safari fallback - use video's native fullscreen
                (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen()
            }
        }
    }

    const handleExportFrame = useCallback(async () => {
        const video = videoRef.current
        if (!video) return

        try {
            // Pause video to ensure we capture the exact current frame
            const wasPlaying = !video.paused
            if (wasPlaying) {
                video.pause()
            }

            // Wait a tiny bit for the frame to stabilize
            await new Promise(resolve => setTimeout(resolve, 50))

            // Create or get canvas
            let canvas = canvasRef.current
            if (!canvas) {
                canvas = document.createElement('canvas')
                canvasRef.current = canvas
            }

            // Set canvas size to match video
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight

            // Draw current frame to canvas
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Convert to blob instead of dataURL to avoid CORS issues
            canvas.toBlob((blob) => {
                if (!blob) {
                    alert('Không thể xuất frame. Vui lòng thử lại.')
                    return
                }

                // Create object URL from blob
                const url = URL.createObjectURL(blob)

                // Get current timestamp for filename
                const currentTimestamp = video.currentTime
                const timestamp = formatTime(currentTimestamp).replace(':', '-')

                // Callback with blob URL or download directly
                if (onExportFrame) {
                    // For callback, we still need to convert to dataURL
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        onExportFrame(reader.result as string, currentTimestamp)
                    }
                    reader.readAsDataURL(blob)
                } else {
                    // Default behavior: download the image directly
                    const link = document.createElement('a')
                    link.download = `frame-${timestamp}.png`
                    link.href = url
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)

                    // Clean up the object URL after download
                    setTimeout(() => URL.revokeObjectURL(url), 100)
                }
            }, 'image/png')
        } catch (error) {
            console.error('Failed to export frame:', error)
            alert('Không thể xuất frame. Vui lòng thử lại.')
        }
    }, [onExportFrame])

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const timeline = e.currentTarget
        const rect = timeline.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, clickX / rect.width))
        const newTime = percentage * duration

        if (videoRef.current && duration > 0) {
            videoRef.current.currentTime = newTime
            setLocalCurrentTime(newTime) // Update local state immediately for responsiveness
            onTimeUpdate(newTime) // Notify parent immediately
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const currentProgress = duration > 0 ? (localCurrentTime / duration) * 100 : 0

    // Expose exportFrame method via ref
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        exportFrame: handleExportFrame,
        seekTo: (time: number) => {
            if (videoRef.current) {
                videoRef.current.currentTime = time
                setLocalCurrentTime(time)
                // We are seeking programmatically, so we might want to set the update flag
                // to avoid the feedback loop if the parent also updates the prop
                isUpdatingTimeRef.current = true
                onTimeUpdate(time)
            }
        },
        pause: () => {
            if (videoRef.current) {
                videoRef.current.pause()
            }
        }
    }), [handleExportFrame, onTimeUpdate])

    // Dynamic max-height based on aspect ratio
    const getVideoMaxHeight = () => {
        if (isFullscreen) return 'calc(100vh - 120px)'
        if (isPortrait) {
            // Portrait videos get more height
            return 'max-h-[70vh] xl:max-h-[65vh] 2xl:max-h-[60vh]'
        }
        // Default landscape
        return 'max-h-[55vh] xl:max-h-[50vh] 2xl:max-h-[45vh]'
    }

    return (
        <div ref={containerRef} className={`custom-video-player ${isPortrait ? 'portrait-video' : 'landscape-video'} ${className}`}>
            <video
                ref={videoRef}
                src={src}
                crossOrigin="anonymous"
                playsInline
                webkit-playsinline=""
                preload="auto"
                className={`w-full h-auto bg-black ${!isFullscreen ? getVideoMaxHeight() : ''}`}
                style={isFullscreen ? {
                    maxHeight: 'calc(100vh - 120px)',
                    objectFit: 'contain'
                } : undefined}
                onClick={togglePlayPause}
            />
            {/* Hidden canvas for frame export */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Custom Controls */}
            <div className="video-controls">
                {/* Timeline with markers */}
                <div id="video-timeline-container" className="timeline-wrapper" onClick={handleTimelineClick}>
                    <div className="timeline-track">
                        {/* Progress bar */}
                        <div className="timeline-progress" style={{ width: `${currentProgress}%` }} />

                        {/* Comment markers */}
                        {comments
                            .filter(c => c.timestamp !== null && c.timestamp !== undefined)
                            .map((comment, index) => {
                                const position = ((comment.timestamp! / duration) * 100).toFixed(2)
                                return (
                                    <div
                                        key={`${comment.id}-${index}`}
                                        className={`timeline-marker ${comment.isResolved ? 'resolved' : 'unresolved'}`}
                                        style={{ left: `${position}%` }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleMarkerClick(comment)
                                        }}
                                    >
                                        <div className="marker-line" />
                                        <div className="marker-tooltip">
                                            <div className="tooltip-header">
                                                {comment.userName}
                                                {comment.annotationData && (
                                                    <StickyNote className="inline-block w-3 h-3 ml-1" />
                                                )}
                                            </div>
                                            <div className="tooltip-content">{comment.content.substring(0, 100)}</div>
                                            {comment.annotationData && (
                                                <div className="tooltip-annotation">
                                                    📝 Có ghi chú đính kèm
                                                </div>
                                            )}
                                            <div className="tooltip-time">{formatTime(comment.timestamp!)}</div>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>

                {/* Control buttons */}
                <div className="controls-bar">
                    <div className="controls-left">
                        <button onClick={togglePlayPause} className="control-btn" title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>

                        <button onClick={toggleMute} className="control-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>

                        <div className="time-display">
                            {formatTime(localCurrentTime)} / {formatTime(duration)}
                        </div>
                    </div>

                    <div className="controls-right">
                        <div className="playback-speed">
                            <select
                                value={playbackRate}
                                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                                className="speed-select"
                                aria-label="Playback speed"
                                title="Playback speed"
                            >
                                <option value={0.25}>0.25x</option>
                                <option value={0.5}>0.5x</option>
                                <option value={0.75}>0.75x</option>
                                <option value={1}>Normal</option>
                                <option value={1.25}>1.25x</option>
                                <option value={1.5}>1.5x</option>
                                <option value={2}>2x</option>
                            </select>
                        </div>

                        <button id="video-controls-export" onClick={handleExportFrame} className="control-btn" title="Xuất frame hiện tại">
                            <Camera className="w-5 h-5" />
                        </button>
                        <button id="video-controls-fullscreen" onClick={toggleFullscreen} className="control-btn" title="Fullscreen">
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}))
