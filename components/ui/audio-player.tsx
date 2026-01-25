'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'

interface AudioPlayerProps {
    src: string
    compact?: boolean
    showDownload?: boolean
    downloadName?: string
}

export function AudioPlayer({ src, compact = false, showDownload = false, downloadName = 'audio.mp3' }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const progressRef = useRef<HTMLDivElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime)
            setProgress((audio.currentTime / audio.duration) * 100 || 0)
        }

        const handleLoadedMetadata = () => {
            setDuration(audio.duration)
        }

        const handleEnded = () => {
            setIsPlaying(false)
            setProgress(0)
        }

        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('ended', handleEnded)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('ended', handleEnded)
        }
    }, [src])

    const togglePlay = () => {
        const audio = audioRef.current
        if (!audio) return

        if (isPlaying) {
            audio.pause()
        } else {
            audio.play()
        }
        setIsPlaying(!isPlaying)
    }

    const toggleMute = () => {
        const audio = audioRef.current
        if (!audio) return
        audio.muted = !isMuted
        setIsMuted(!isMuted)
    }

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current
        const progressBar = progressRef.current
        if (!audio || !progressBar) return

        const rect = progressBar.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const width = rect.width
        const seekTime = (clickX / width) * audio.duration
        audio.currentTime = seekTime
    }

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00'
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <audio ref={audioRef} src={src} preload="metadata" />
                <button
                    onClick={togglePlay}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                    {isPlaying ? (
                        <Pause className="h-3.5 w-3.5 text-white" />
                    ) : (
                        <Play className="h-3.5 w-3.5 text-white ml-0.5" />
                    )}
                </button>
                <div
                    ref={progressRef}
                    onClick={handleProgressClick}
                    className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden min-w-[80px]"
                >
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-[10px] text-white/40 min-w-[32px]">
                    {formatTime(currentTime)}
                </span>
                <button
                    onClick={toggleMute}
                    className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                    {isMuted ? (
                        <VolumeX className="h-3 w-3 text-white/40" />
                    ) : (
                        <Volume2 className="h-3 w-3 text-white/40" />
                    )}
                </button>
            </div>
        )
    }

    return (
        <div className="w-full p-3 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.08]">
            <audio ref={audioRef} src={src} preload="metadata" />

            <div className="flex items-center gap-3">
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 flex items-center justify-center transition-all shadow-lg shadow-purple-500/20"
                >
                    {isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                    ) : (
                        <Play className="h-4 w-4 text-white ml-0.5" />
                    )}
                </button>

                <div className="flex-1 space-y-1">
                    <div
                        ref={progressRef}
                        onClick={handleProgressClick}
                        className="h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden group"
                    >
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-100 relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-white/40">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <button
                    onClick={toggleMute}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                    {isMuted ? (
                        <VolumeX className="h-4 w-4 text-white/60" />
                    ) : (
                        <Volume2 className="h-4 w-4 text-white/60" />
                    )}
                </button>

                {showDownload && (
                    <a
                        href={src}
                        download={downloadName}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                    >
                        <Download className="h-4 w-4 text-blue-400" />
                    </a>
                )}
            </div>
        </div>
    )
}
