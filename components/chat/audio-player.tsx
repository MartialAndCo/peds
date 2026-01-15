"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

interface AudioPlayerProps {
    src: string
    isMe?: boolean
}

export function AudioPlayer({ src, isMe = false }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const setAudioData = () => {
            setDuration(audio.duration)
            setIsLoading(false)
        }

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime)
        }

        const handleEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }

        // Add event listeners
        audio.addEventListener("loadedmetadata", setAudioData)
        audio.addEventListener("timeupdate", setAudioTime)
        audio.addEventListener("ended", handleEnded)

        // Preload metadata to get duration calculation
        audio.preload = "metadata"

        return () => {
            audio.removeEventListener("loadedmetadata", setAudioData)
            audio.removeEventListener("timeupdate", setAudioTime)
            audio.removeEventListener("ended", handleEnded)
        }
    }, [])

    const togglePlayPause = () => {
        const audio = audioRef.current
        if (!audio) return

        if (isPlaying) {
            audio.pause()
        } else {
            audio.play()
        }
        setIsPlaying(!isPlaying)
    }

    const handleSeek = (value: number[]) => {
        const audio = audioRef.current
        if (!audio) return

        audio.currentTime = value[0]
        setCurrentTime(value[0])
    }

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00"
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, "0")}`
    }

    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl min-w-[200px] max-w-[300px]",
            isMe ? "bg-white/10" : "bg-black/5"
        )}>
            <audio ref={audioRef} src={src} />

            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-10 w-10 rounded-full shrink-0 transition-colors",
                    isMe
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                )}
                onClick={togglePlayPause}
                disabled={isLoading}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                ) : (
                    <Play className="h-4 w-4 ml-1 fill-current" />
                )}
            </Button>

            <div className="flex-1 space-y-1">
                <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleSeek}
                    className={cn(
                        "w-full cursor-pointer",
                        isMe ? "[&>.relative>.bg-primary]:bg-white/80 [&>.relative>.bg-secondary]:bg-white/20" : ""
                    )}
                />
                <div className={cn(
                    "flex justify-between text-[10px] font-mono",
                    isMe ? "text-white/70" : "text-gray-500"
                )}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    )
}
