import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, StickyNote } from 'lucide-react'
import type { Comment } from '@/types'
import './CustomVideoPlayer.css'

interface CustomVideoPlayerProps {
    src: string
    comments: Comment[]
    currentTime?: number
    onTimeUpdate: (time: number) => void
    onCommentMarkerClick: (comment: Comment) => void
    onLoadedMetadata?: (duration: number, fps: number) => void
    onFullscreenChange?: (isFullscreen: boolean) => void
    className?: string
}

export function CustomVideoPlayer({
    src,
    comments,
    currentTime,
    onTimeUpdate,
    onCommentMarkerClick,
    onLoadedMetadata,
    onFullscreenChange,
    className = ''
}: CustomVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [duration, setDuration] = useState(0)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [localCurrentTime, setLocalCurrentTime] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)

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
            onLoadedMetadata?.(dur, 30)
        }

        const handleTimeUpdate = () => {
            setLocalCurrentTime(video.currentTime)
            onTimeUpdate(video.currentTime)
        }

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)

        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('timeupdate', handleTimeUpdate)
        video.addEventListener('play', handlePlay)
        video.addEventListener('pause', handlePause)

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('timeupdate', handleTimeUpdate)
            video.removeEventListener('play', handlePlay)
            video.removeEventListener('pause', handlePause)
        }
    }, [onTimeUpdate, onLoadedMetadata])

    // Seek to external currentTime changes (from frame navigation)
    useEffect(() => {
        const video = videoRef.current
        if (video && currentTime !== undefined && !isNaN(currentTime)) {
            const diff = Math.abs(video.currentTime - currentTime)
            // Use smaller threshold for frame-accurate seeking
            if (diff > 0.01) {
                video.currentTime = currentTime
                setLocalCurrentTime(currentTime)
            }
        }
    }, [currentTime])

    const handleMarkerClick = (comment: Comment) => {
        if (comment.timestamp !== null) {
            if (videoRef.current) {
                videoRef.current.pause()
            }
            // Rely on parent prop update to trigger seek via useEffect
            // This avoids double-seeking and potential conflicts
            onCommentMarkerClick(comment)
        }
    }

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
        if (containerRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen()
            } else {
                containerRef.current.requestFullscreen()
            }
        }
    }

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

    return (
        <div ref={containerRef} className={`custom-video-player ${className}`}>
            <video
                ref={videoRef}
                src={src}
                className={`w-full h-auto bg-black ${!isFullscreen ? 'max-h-[55vh] xl:max-h-[50vh] 2xl:max-h-[45vh]' : ''}`}
                style={isFullscreen ? {
                    maxHeight: 'calc(100vh - 120px)',
                    objectFit: 'contain'
                } : undefined}
                onClick={togglePlayPause}
            />

            {/* Custom Controls */}
            <div className="video-controls">
                {/* Timeline with markers */}
                <div className="timeline-wrapper" onClick={handleTimelineClick}>
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

                        <button onClick={toggleFullscreen} className="control-btn" title="Fullscreen">
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
