'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Play } from 'lucide-react'
import Image from 'next/image'

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

    if (loading) {
        return <div className="text-center py-10 text-white/30">Loading media...</div>
    }

    if (media.length === 0) {
        return <div className="text-center py-10 text-white/30">No media found</div>
    }

    return (
        <div className="space-y-4 pb-24">
            <h1 className="text-2xl font-bold text-white px-1 mb-4">Media Gallery</h1>

            <div className="grid grid-cols-3 gap-0.5">
                {media.map((item) => (
                    <div
                        key={item.id}
                        className="relative aspect-square cursor-pointer bg-white/5"
                        onClick={() => setSelectedMedia(item)}
                    >
                        {item.type === 'image' ? (
                            <Image
                                src={item.url}
                                alt="Media"
                                fill
                                className="object-cover"
                                sizes="33vw"
                            />
                        ) : item.type === 'video' ? (
                            <>
                                <video src={item.url} className="w-full h-full object-cover" muted />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="h-8 w-8 text-white opacity-80" />
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/10">
                                <span className="text-xs text-white/50">Audio</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
                <DialogContent className="max-w-md bg-transparent border-0 shadow-none p-0 flex items-center justify-center">
                    {selectedMedia && (
                        selectedMedia.type === 'image' ? (
                            <img src={selectedMedia.url} alt="Full view" className="w-full h-auto rounded-xl" />
                        ) : selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} controls className="w-full h-auto rounded-xl" />
                        ) : (
                            <div className="bg-[#0f172a] p-8 rounded-xl border border-white/10">
                                <audio src={selectedMedia.url} controls />
                            </div>
                        )
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
