'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getMediaTypes, createMediaType } from '@/app/actions/media'

export default function MediaPage() {
    const [mediaTypes, setMediaTypes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newCategory, setNewCategory] = useState({ id: '', description: '', keywords: '' })
    const [creating, setCreating] = useState(false)

    const fetchMedia = async () => {
        setLoading(true)
        try {
            const data = await getMediaTypes()
            setMediaTypes(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMedia()
    }, [])

    const handleCreate = async () => {
        if (!newCategory.id) return
        setCreating(true)
        try {
            await createMediaType({
                id: newCategory.id,
                description: newCategory.description,
                keywords: newCategory.keywords.split(',').map(k => k.trim())
            })
            setIsCreateOpen(false)
            setNewCategory({ id: '', description: '', keywords: '' })
            fetchMedia()
        } catch (error) {
            alert('Failed to create category')
        } finally {
            setCreating(false)
        }
    }

    if (loading && mediaTypes.length === 0) return <div className="p-10">Loading media...</div>

    return (
        <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Media Gallery</h2>
                    <p className="text-muted-foreground">Manage content available for the AI to send.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Category
                </Button>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Media Category</DialogTitle>
                        <DialogDescription>
                            Define a new type of media (e.g. "photo_feet") that the AI can recognize and offer.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ID (Slug)</Label>
                            <Input
                                placeholder="e.g. photo_face, video_greeting"
                                value={newCategory.id}
                                onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                placeholder="e.g. Selfies of my face"
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Keywords (comma separated)</Label>
                            <Textarea
                                placeholder="e.g. face, selfie, visage, portrait"
                                value={newCategory.keywords}
                                onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newCategory.id}>
                            {creating ? 'Creating...' : 'Create Category'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {mediaTypes.length === 0 ? (
                <div className="p-10 text-center border rounded-lg bg-slate-50 border-dashed">
                    <h2 className="text-2xl font-bold mb-2">Gallery Empty</h2>
                    <p className="text-muted-foreground mb-6">Create a category to get started.</p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Category
                    </Button>
                </div>
            ) : (
                <Tabs defaultValue={mediaTypes[0]?.id} className="w-full">
                    <TabsList className="mb-6 flex-wrap h-auto w-full justify-start bg-transparent border-b rounded-none p-0 gap-2">
                        {mediaTypes.map((type: any) => (
                            <TabsTrigger
                                key={type.id}
                                value={type.id}
                                className="px-4 py-2 border rounded-t-md data-[state=active]:bg-white data-[state=active]:border-b-white translate-y-[1px] shadow-sm"
                            >
                                {type.id}
                                <Badge variant="secondary" className="ml-2">{type.medias.length}</Badge>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {mediaTypes.map((type: any) => (
                        <TabsContent key={type.id} value={type.id} className="mt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {type.medias.map((media: any) => (
                                    <Card key={media.id} className="overflow-hidden hover:shadow-lg transition-all group relative border-0 ring-1 ring-slate-200">
                                        <div className="aspect-square relative bg-slate-100">
                                            {media.url.startsWith('data:video') || media.url.includes('video') /* Rough check if mime missing */ ? (
                                                <video src={media.url} className="w-full h-full object-cover" controls />
                                            ) : (
                                                <img src={media.url} alt={type.id} className="w-full h-full object-cover" />
                                            )}
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Badge className="bg-black/50 hover:bg-black/70">{media.sentTo.length} sent</Badge>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                                {type.medias.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
                                        <p className="mb-2">No media in '{type.id}' yet.</p>
                                        <p className="text-sm">Send a photo/video to the Media Source Number (+{type.id}) to add it here.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </div>
    )
}
