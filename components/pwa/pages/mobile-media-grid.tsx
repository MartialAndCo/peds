'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Play, Image as ImageIcon, Video, Grid } from 'lucide-react'
import Image from 'next/image'
import { cn } from "@/lib/utils"

interface MediaItem {
    id: string
    url: string
    type: 'image' | 'video' | 'audio'
    mime_type?: string
}

interface MobileMediaGridProps {
    media: MediaItem[]
    loading: boolean
}

export function MobileMediaGrid({ media, loading }: MobileMediaGridProps) {
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null)
    const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')

    const filteredMedia = useMemo(() => {
        if (filter === 'all') return media
        return media.filter(item => item.type === filter)
    }, [media, filter])

    // Group by date (mock implementation for now, or just flat list if no dates)
    // For iOS feel, we just want precise grid

    if (loading) {
        return <div className="text-center py-20 text-white/30 text-sm font-medium animate-pulse">Syncing Library...</div>
    }

    if (media.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-white/30 gap-4">
                <Grid className="w-12 h-12 opacity-20" />
                <span className="text-sm font-medium">No Media Found</span>
            </div>
        )
    }

    return (
        <div className="space-y-0 min-h-screen bg-[#000000] pb-24">
            {/* Sticky Header with "Segmented Control" */}
            <div className="sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] pt-12 pb-2 px-2 pwa-safe-area-top-margin">
                <div className="flex items-center justify-between mb-3 px-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">Gallery</h1>
                    <span className="text-white/40 text-xs font-medium">{media.length} Items</span>
                </div>

                {/* Tabs / Filter Pills */}
                <div className="flex gap-2 px-1">
                    <button
                        onClick={() => setFilter('all')}
                        className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                            filter === 'all'
                                ? "bg-white text-black shadow-lg"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('image')}
                        className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                            filter === 'image'
                                ? "bg-white text-black shadow-lg"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                    >
                        Photos
                    </button>
                    <button
                        onClick={() => setFilter('video')}
                        className={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                            filter === 'video'
                                ? "bg-white text-black shadow-lg"
                                : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                    >
                        Videos
                    </button>
                </div>
            </div>

            {/* Strict 3-Column Grid (1px gap) */}
            <div className="grid grid-cols-3 gap-[1px]">
                {filteredMedia.map((item) => (
                    <div
                        key={item.id}
                        className="relative aspect-square cursor-pointer bg-white/5 overflow-hidden group"
                        onClick={() => setSelectedMedia(item)}
                    >
                        {item.type === 'image' ? (
                            <Image
                                src={item.url}
                                alt="Media"
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                sizes="33vw"
                                quality={50} // Optimize for grid
                            />
                        ) : item.type === 'video' ? (
                            <>
                                <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                                        <Play className="h-4 w-4 text-white fill-white" />
                                    </div>
                                </div>
                                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Video className="h-3 w-3 text-white/80" />
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/10">
                                <span className="text-xs text-white/50">Audio</span>
                            </div>
                        )}

                        {/* Touch Overlay (Active State) */}
                        <div className="absolute inset-0 bg-black/0 active:bg-black/20 transition-colors" />
                    </div>
                ))}
            </div>

            {/* Fullscreen Viewer Modal */}
            <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
                <DialogContent className="max-w-[100vw] h-[100dvh] w-screen bg-black/95 border-0 shadow-none p-0 flex flex-col items-center justify-center outline-none !rounded-none">
                    {selectedMedia && (
                        <>
                            {/* Overlay Header */}
                            <div className="absolute top-0 left-0 right-0 p-4 pwa-safe-area-top-margin z-50 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pb-10">
                                <button onClick={() => setSelectedMedia(null)} className="text-white/80 hover:text-white px-4 py-2 text-sm font-medium shadow-black/50 drop-shadow-md">
                                    Close
                                </button>
                            </div>

                            <div className="w-full h-full flex items-center justify-center p-0">
                                {selectedMedia.type === 'image' ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img
                                            src={selectedMedia.url}
                                            alt="Full view"
                                            className="max-w-full max-h-full object-contain w-full"
                                        />
                                    </div>
                                ) : selectedMedia.type === 'video' ? (
                                    <video src={selectedMedia.url} controls autoPlay className="w-full max-h-full object-contain" />
                                ) : (
                                    <div className="bg-[#0f172a] p-8 rounded-xl border border-white/10 w-full max-w-sm mx-4">
                                        <audio src={selectedMedia.url} controls className="w-full" />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
