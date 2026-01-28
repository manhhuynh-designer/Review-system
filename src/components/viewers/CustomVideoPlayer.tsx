import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback, memo } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, StickyNote, Camera, Repeat, PictureInPicture2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Comment } from '@/types'
import './CustomVideoPlayer.css'
import {
    VideoSettingsMenu,
    type CompositionGuide
} from './overlays'
import { VideoDisplayArea } from './VideoDisplayArea'
import { useIsMobile } from '@/hooks/useIsMobile'

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
    const [volume, setVolume] = useState(1)
    const [localCurrentTime, setLocalCurrentTime] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isPortrait, setIsPortrait] = useState(false)

    const isMobile = useIsMobile()

    // Enhancement states
    const [showControls, setShowControls] = useState(true)
    const [isBuffering, setIsBuffering] = useState(false)
    const [isLooping, setIsLooping] = useState(false)
    const [hoverTime, setHoverTime] = useState<number | null>(null)
    const [hoverPosition, setHoverPosition] = useState<number>(0)

    // Overlay state
    const [videoRatio, setVideoRatio] = useState(16 / 9)
    const [activeSafeZone, setActiveSafeZone] = useState<string | null>(null)
    const [activeGuides, setActiveGuides] = useState<CompositionGuide[]>([])
    const [overlayOpacity, setOverlayOpacity] = useState(0.2)
    const [guideColor, setGuideColor] = useState('#ffffff')

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

    // Toggle functions with useCallback for keyboard shortcuts
    const togglePlayPause = useCallback(() => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play()
            } else {
                videoRef.current.pause()
            }
        }
    }, [])

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            const newMuted = !videoRef.current.muted
            videoRef.current.muted = newMuted
            setIsMuted(newMuted)
        }
    }, [])

    const toggleFullscreen = useCallback(() => {
        const video = videoRef.current
        const container = containerRef.current

        const isCurrentlyFullscreen = document.fullscreenElement ||
            (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement

        if (isCurrentlyFullscreen) {
            if (document.exitFullscreen) {
                document.exitFullscreen()
            } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
                (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen()
            }
        } else {
            if (container?.requestFullscreen) {
                container.requestFullscreen().catch(() => {
                    if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
                        (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen()
                    }
                })
            } else if (container && (container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
                (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen()
            } else if (video && (video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
                (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen()
            }
        }
    }, [])

    const toggleLoop = useCallback(() => {
        if (videoRef.current) {
            const newLoop = !videoRef.current.loop
            videoRef.current.loop = newLoop
            setIsLooping(newLoop)
        }
    }, [])

    const togglePiP = useCallback(async () => {
        const video = videoRef.current
        if (!video) return

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
            } else if (document.pictureInPictureEnabled) {
                await video.requestPictureInPicture()
            }
        } catch (error) {
            console.error('PiP error:', error)
            toast.error('Picture-in-Picture không khả dụng')
        }
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeElement = document.activeElement
            if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return

            const video = videoRef.current
            if (!video) return

            switch (e.code) {
                case 'Space':
                    e.preventDefault()
                    togglePlayPause()
                    break
                case 'KeyM':
                    e.preventDefault()
                    toggleMute()
                    break
                case 'KeyF':
                    e.preventDefault()
                    toggleFullscreen()
                    break
                case 'KeyL':
                    e.preventDefault()
                    toggleLoop()
                    break
                case 'KeyP':
                    e.preventDefault()
                    togglePiP()
                    break
                case 'ArrowLeft':
                    e.preventDefault()
                    video.currentTime = Math.max(0, video.currentTime - 5)
                    break
                case 'ArrowRight':
                    e.preventDefault()
                    video.currentTime = Math.min(duration, video.currentTime + 5)
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    {
                        const newVol = Math.min(1, video.volume + 0.1)
                        video.volume = newVol
                        setVolume(newVol)
                        if (video.muted && newVol > 0) {
                            video.muted = false
                            setIsMuted(false)
                        }
                    }
                    break
                case 'ArrowDown':
                    e.preventDefault()
                    {
                        const newVol = Math.max(0, video.volume - 0.1)
                        video.volume = newVol
                        setVolume(newVol)
                    }
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [duration, togglePlayPause, toggleMute, toggleFullscreen, toggleLoop, togglePiP])

    // Controls always visible - auto-hide disabled on all platforms
    useEffect(() => {
        setShowControls(true)
    }, [])

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
                setVideoRatio(ratio)
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

        // Buffering events
        const handleWaiting = () => setIsBuffering(true)
        const handleCanPlay = () => setIsBuffering(false)

        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)
        video.addEventListener('waiting', handleWaiting)
        video.addEventListener('canplay', handleCanPlay)

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId)
            }
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('play', handlePlay)
            video.removeEventListener('pause', handlePause)
            video.removeEventListener('waiting', handleWaiting)
            video.removeEventListener('canplay', handleCanPlay)
        }
    }, [onTimeUpdate, onLoadedMetadata, onPlay, onPause])

    // Seek to external currentTime changes (from frame navigation)
    // IMPORTANT: Only apply when video is PAUSED to prevent feedback loop stutters
    useEffect(() => {
        const video = videoRef.current
        if (video && currentTime !== undefined && !isNaN(currentTime)) {
            // Skip if video is playing - let it handle its own time naturally
            // This prevents the feedback loop: onTimeUpdate -> setCurrentTime -> prop change -> seek -> stutter
            if (!video.paused) {
                return
            }

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

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value)
        if (videoRef.current) {
            videoRef.current.volume = newVolume
            setVolume(newVolume)
            if (newVolume === 0 && !isMuted) {
                setIsMuted(true)
            } else if (newVolume > 0 && isMuted) {
                videoRef.current.muted = false
                setIsMuted(false)
            }
        }
    }



    const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
        const timeline = e.currentTarget
        const rect = timeline.getBoundingClientRect()
        const hoverX = e.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, hoverX / rect.width))
        setHoverTime(percentage * duration)
        setHoverPosition(hoverX)
    }

    const handleTimelineLeave = () => {
        setHoverTime(null)
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

            // Convert to blob
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    toast.error('Không thể xuất frame. Vui lòng thử lại.')
                    return
                }

                // If callback provided (rare case usually for parents), use it
                if (onExportFrame) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        onExportFrame(reader.result as string, video.currentTime)
                    }
                    reader.readAsDataURL(blob)
                    return
                }

                // Copy to clipboard
                try {
                    const item = new ClipboardItem({ 'image/png': blob })
                    await navigator.clipboard.write([item])
                    toast.success('Đã lưu frame vào clipboard')
                } catch (err) {
                    console.error('Clipboard write failed:', err)
                    toast.error('Không thể lưu vào clipboard')
                }
            }, 'image/png')
        } catch (error) {
            console.error('Failed to export frame:', error)
            toast.error('Không thể xuất frame. Vui lòng thử lại.')
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

    return (
        <div ref={containerRef} className={`custom-video-player ${isPortrait ? 'portrait-video' : 'landscape-video'} ${!showControls ? 'controls-hidden' : ''} ${className}`}>
            {/* Memoized Video Display Area */}
            <VideoDisplayArea
                ref={videoRef}
                src={src}
                isFullscreen={isFullscreen}
                isBuffering={isBuffering}
                activeSafeZone={activeSafeZone}
                activeGuides={activeGuides}
                videoRatio={videoRatio}
                guideColor={guideColor}
                overlayOpacity={overlayOpacity}
                onClick={togglePlayPause}
                onDoubleClick={toggleFullscreen}
            />

            {/* Hidden canvas for frame export */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Custom Controls */}
            <div className={`video-controls ${!showControls ? 'hidden' : ''}`}>
                {/* Timeline with markers */}
                <div
                    id="video-timeline-container"
                    className="timeline-wrapper"
                    onClick={handleTimelineClick}
                    onMouseMove={handleTimelineHover}
                    onMouseLeave={handleTimelineLeave}
                >
                    <div className="timeline-track">
                        {/* Progress bar */}
                        <div className="timeline-progress" style={{ width: `${currentProgress}%` }} />

                        {/* Hover time preview */}
                        {hoverTime !== null && (
                            <div
                                className="timeline-hover-preview"
                                style={{ left: `${hoverPosition}px` }}
                            >
                                {formatTime(hoverTime)}
                            </div>
                        )}

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

                        <div className="volume-control">
                            <button onClick={toggleMute} className="control-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            {!isMobile && (
                                <div className="volume-slider-container">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="volume-slider"
                                        title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="time-display">
                            {formatTime(localCurrentTime)} / {formatTime(duration)}
                        </div>

                        {!isMobile && (
                            <>
                                <button onClick={toggleLoop} className={`control-btn ${isLooping ? 'active' : ''}`} title={isLooping ? 'Tắt lặp (L)' : 'Bật lặp (L)'}>
                                    <Repeat className="w-5 h-5" />
                                </button>

                                <button onClick={togglePiP} className="control-btn" title="Picture-in-Picture (P)">
                                    <PictureInPicture2 className="w-5 h-5" />
                                </button>
                            </>
                        )}
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

                        {/* Overlay Settings Menu */}
                        <VideoSettingsMenu
                            videoRatio={videoRatio}
                            activeSafeZone={activeSafeZone}
                            onSafeZoneChange={setActiveSafeZone}
                            activeGuides={activeGuides}
                            onGuidesChange={setActiveGuides}
                            opacity={overlayOpacity}
                            onOpacityChange={setOverlayOpacity}
                            guideColor={guideColor}
                            onGuideColorChange={setGuideColor}
                        />


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
