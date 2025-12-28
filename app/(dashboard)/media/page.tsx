
'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function MediaPage() {
    const [mediaTypes, setMediaTypes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('/api/media')
            .then(res => setMediaTypes(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-10">Loading media...</div>

    if (mediaTypes.length === 0) return (
        <div className="p-10 text-center">
            <h2 className="text-2xl font-bold">No Media Found</h2>
            <p className="text-muted-foreground">Upload media via WhatsApp (send to Admin/Source number) to populate this gallery.</p>
        </div>
    )

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Media Gallery</h2>
                <p className="text-muted-foreground">Manage and view content available for the AI to send.</p>
            </div>

            <Tabs defaultValue={mediaTypes[0]?.id} className="w-full">
                <TabsList className="mb-4 flex-wrap h-auto">
                    {mediaTypes.map((type: any) => (
                        <TabsTrigger key={type.id} value={type.id} className="px-4 py-2">
                            {type.id}
                            <Badge variant="secondary" className="ml-2">{type.medias.length}</Badge>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {mediaTypes.map((type: any) => (
                    <TabsContent key={type.id} value={type.id}>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {type.medias.map((media: any) => (
                                <Card key={media.id} className="overflow-hidden hover:shadow-lg transition-all group relative">
                                    <div className="aspect-square relative bg-slate-100">
                                        {/* Auto-detect if video or image based on URL extension or MIME (not stored currently, assume image mainly) */}
                                        {media.url.endsWith('.mp4') ? (
                                            <video src={media.url} className="w-full h-full object-cover" controls />
                                        ) : (
                                            <img src={media.url} alt={type.id} className="w-full h-full object-cover" />
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Sent: {media.sentTo.length} times
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {type.medias.length === 0 && (
                                <div className="col-span-full text-center py-10 text-muted-foreground bg-slate-50 rounded border border-dashed">
                                    No media in this category yet.
                                </div>
                            )}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
