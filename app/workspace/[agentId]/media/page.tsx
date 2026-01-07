'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { Plus, Image as ImageIcon, Trash2, Upload, EyeOff, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useDropzone } from 'react-dropzone' // Need to check if installed or implement custom
import { cn } from '@/lib/utils'

// Simple custom dropzone if lib missing, but let's assume standard drag events for now to avoid dep hell if not installed.
// Or just basic input[type=file] styled.

export default function WorkspaceMediaPage() {
    const [mediaTypes, setMediaTypes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newCategory, setNewCategory] = useState({ id: '', description: '', keywords: '' })
    const [creating, setCreating] = useState(false)
    const [isBlurred, setIsBlurred] = useState(false) // Default to false or true based on preference
    // Drag state
    const [dragActive, setDragActive] = useState(false)
    const [uploading, setUploading] = useState(false)

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

    const handleDeleteCategory = async (categoryId: string) => {
        if (!confirm(`Are you sure you want to delete category "${categoryId}" and all its media?`)) return

        try {
            await axios.delete(`/api/media/${categoryId}`)
            setMediaTypes(prev => prev.filter(t => t.id !== categoryId))
        } catch (error) {
            alert('Failed to delete category')
            console.error(error)
        }
    }

    const handleDeleteMedia = async (mediaId: number) => {
        if (!confirm('Delete this media?')) return

        try {
            await axios.delete(`/api/media/item/${mediaId}`)
            fetchMedia() // Refresh to be safe or update local state deeply
        } catch (error) {
            console.error(error)
            alert('Failed to delete media')
        }
    }

    const handleDrop = async (e: React.DragEvent, categoryId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            await handleUpload(file, categoryId)
        }
    }

    const handleUpload = async (file: File, categoryId: string) => {
        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('categoryId', categoryId)

        try {
            await axios.post('/api/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            fetchMedia()
        } catch (error) {
            console.error(error)
            alert('Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
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
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                        <Switch
                            id="blur-mode"
                            checked={isBlurred}
                            onCheckedChange={setIsBlurred}
                        />
                        <Label htmlFor="blur-mode" className="text-white cursor-pointer flex items-center gap-2">
                            {isBlurred ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {isBlurred ? ' Blur On' : ' Blur Off'}
                        </Label>
                    </div>

                    <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-2 h-4 w-4" />
                        New Category
                    </Button>
                </div>
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
                            <div className="flex justify-end mb-4">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteCategory(type.id)}
                                    className="opacity-80 hover:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete {type.id}
                                </Button>
                            </div>

                            <div
                                className={cn(
                                    "relative rounded-xl border-2 border-dashed border-transparent transition-all min-h-[200px] flex flex-col",
                                    dragActive ? "border-blue-500 bg-blue-500/10" : ""
                                )}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={(e) => handleDrop(e, type.id)}
                            >
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
                                    {type.medias.map((media: any) => (
                                        <Card key={media.id} className="overflow-hidden bg-black/40 hover:ring-2 hover:ring-blue-500 transition-all group relative border-white/10">
                                            <div className="aspect-square relative flex items-center justify-center bg-black">
                                                {media.url.startsWith('data:video') || media.url.includes('video') || media.url.endsWith('.mp4') ? (
                                                    <video
                                                        src={media.url}
                                                        className={cn("w-full h-full object-cover", isBlurred && "filter blur-md transition-all duration-300")}
                                                        controls
                                                    />
                                                ) : (
                                                    <img
                                                        src={media.url}
                                                        alt={type.id}
                                                        className={cn("w-full h-full object-cover", isBlurred && "filter blur-md transition-all duration-300")}
                                                    />
                                                )}

                                                {/* Delete Overlay */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full"
                                                        onClick={() => handleDeleteMedia(media.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}

                                    {/* Upload Placeholder */}
                                    <div className="aspect-square relative flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group border-dashed">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleUpload(e.target.files[0], type.id)
                                            }}
                                        />
                                        <div className="flex flex-col items-center gap-2 text-white/50 group-hover:text-white">
                                            {uploading ? (
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                            ) : (
                                                <>
                                                    <Upload className="h-8 w-8" />
                                                    <span className="text-xs font-medium">Upload</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {type.medias.length === 0 && !uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center text-white/40">
                                            <p>Drop files here to upload</p>
                                        </div>
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
