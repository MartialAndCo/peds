'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function WorkspaceMediaPage() {
    const [mediaTypes, setMediaTypes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newCategory, setNewCategory] = useState({ id: '', description: '', keywords: '' })
    const [creating, setCreating] = useState(false)

    const fetchMedia = () => {
        setLoading(true)
        axios.get('/api/media')
            .then(res => setMediaTypes(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchMedia()
    }, [])

    const handleCreate = async () => {
        if (!newCategory.id) return
        setCreating(true)
        try {
            await axios.post('/api/media', {
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

    if (loading && mediaTypes.length === 0) return <div className="p-10 text-white/50">Loading media...</div>

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Media Gallery</h2>
                    <p className="text-white/50">View available media for this agent.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    New Category
                </Button>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-slate-900 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Create Media Category</DialogTitle>
                        <DialogDescription className="text-white/50">
                            Define a new type of media (e.g. "photo_feet") that the AI can recognize.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-white">ID (Slug)</Label>
                            <Input
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="e.g. photo_face, video_greeting"
                                value={newCategory.id}
                                onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">Description</Label>
                            <Input
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="e.g. Selfies of my face"
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">Keywords (comma separated)</Label>
                            <Textarea
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="e.g. face, selfie, visage, portrait"
                                value={newCategory.keywords}
                                onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white hover:bg-white/10">Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newCategory.id} className="bg-blue-600 hover:bg-blue-700">
                            {creating ? 'Creating...' : 'Create Category'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {mediaTypes.length === 0 ? (
                <div className="p-10 text-center border rounded-lg border-white/10 border-dashed bg-white/5">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-white/50" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-2 text-white">Gallery Empty</h2>
                    <p className="text-white/50 mb-6">Create a category to get started.</p>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Category
                    </Button>
                </div>
            ) : (
                <Tabs defaultValue={mediaTypes[0]?.id} className="w-full">
                    <TabsList className="mb-6 flex-wrap h-auto w-full justify-start bg-transparent border-b border-white/10 rounded-none p-0 gap-2">
                        {mediaTypes.map((type: any) => (
                            <TabsTrigger
                                key={type.id}
                                value={type.id}
                                className="px-4 py-2 border border-transparent rounded-t-md data-[state=active]:bg-white/10 data-[state=active]:border-white/10 data-[state=active]:text-white text-white/50 hover:text-white/70"
                            >
                                {type.id}
                                <Badge variant="secondary" className="ml-2 bg-white/10 hover:bg-white/20 text-white">{type.medias.length}</Badge>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {mediaTypes.map((type: any) => (
                        <TabsContent key={type.id} value={type.id} className="mt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {type.medias.map((media: any) => (
                                    <Card key={media.id} className="overflow-hidden bg-black/40 hover:ring-2 hover:ring-blue-500 transition-all group relative border-white/10">
                                        <div className="aspect-square relative flex items-center justify-center bg-black">
                                            {media.url.startsWith('data:video') || media.url.includes('video') ? (
                                                <video src={media.url} className="w-full h-full object-cover" controls />
                                            ) : (
                                                <img src={media.url} alt={type.id} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    </Card>
                                ))}
                                {type.medias.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-white/40 bg-white/5 rounded-xl border border-white/10 border-dashed">
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
