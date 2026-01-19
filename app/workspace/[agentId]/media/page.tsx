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

import { usePWAMode } from '@/hooks/use-pwa-mode'
import { MobileMediaGrid } from '@/components/pwa/pages/mobile-media-grid'

// Simple custom dropzone if lib missing, but let's assume standard drag events for now to avoid dep hell if not installed.
// Or just basic input[type=file] styled.

export default function WorkspaceMediaPage() {
    const { isPWAStandalone } = usePWAMode()
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

    // ... (rest of the functions remain the same)

    if (isPWAStandalone) {
        // Flatten media for mobile grid for now, or we could group sections
        const allMedia = mediaTypes.flatMap(type => type.medias.map((m: any) => ({
            id: m.id,
            url: m.url,
            type: (m.url.includes('video') || m.url.endsWith('.mp4')) ? 'video' : 'image'
        })))

        return <MobileMediaGrid media={allMedia} loading={loading} />
    }

    if (loading && mediaTypes.length === 0) return <div className="p-10 text-white/50">Loading media...</div>

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            if (!newCategory.id) return
            setCreating(true)
            try {
                await axios.post('/api/media', {
                    id: newCategory.id,
                    description: newCategory.description,
                    keywords: newCategory.keywords.split(',').map(k => k.trim())
                })
            setIsCreateOpen(false)
            setNewCategory({id: '', description: '', keywords: '' })
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
            <div className="space-y-10 pb-20 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-col space-y-1">
                        <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">Media Vault</h2>
                        <p className="text-white/30 text-sm font-light tracking-wide">Secure repository for agent assets and training material.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center space-x-3 glass px-4 py-2 rounded-xl border-white/10 shadow-lg">
                            <Switch
                                id="blur-mode"
                                checked={isBlurred}
                                onCheckedChange={setIsBlurred}
                                className="data-[state=checked]:bg-blue-500"
                            />
                            <Label htmlFor="blur-mode" className="text-white/60 text-[10px] font-bold uppercase tracking-widest cursor-pointer flex items-center gap-2">
                                {isBlurred ? <EyeOff className="h-3 w-3 text-orange-400" /> : <Eye className="h-3 w-3 text-emerald-400" />}
                                {isBlurred ? 'Safe View' : 'Raw View'}
                            </Label>
                        </div>

                        <Button onClick={() => setIsCreateOpen(true)} className="glass-strong border-white/10 hover:bg-white/10 text-white font-bold uppercase text-[10px] tracking-widest px-6 h-11 transition-all shadow-2xl">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Category
                        </Button>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="glass-strong border-white/10 text-white max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold tracking-tight">New Category Definition</DialogTitle>
                            <DialogDescription className="text-white/40 italic">
                                Map a new intent to a specific set of media assets.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-5 py-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Identifier (Slug)</Label>
                                <Input
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/10 focus:ring-blue-500/20 h-11"
                                    placeholder="e.g. photo_face"
                                    value={newCategory.id}
                                    onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Manifest Description</Label>
                                <Input
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/10 focus:ring-blue-500/20 h-11"
                                    placeholder="What does the AI see?"
                                    value={newCategory.description}
                                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Triggers (Keywords)</Label>
                                <Textarea
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/10 focus:ring-blue-500/20 min-h-[100px]"
                                    placeholder="Coma separated tags..."
                                    value={newCategory.keywords}
                                    onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-3">
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white/40 hover:text-white hover:bg-white/5 uppercase text-[10px] font-bold tracking-widest">Abort</Button>
                            <Button onClick={handleCreate} disabled={creating || !newCategory.id} className="glass-strong border-blue-500/30 text-white hover:bg-white/10 px-8 uppercase text-[10px] font-bold tracking-widest">
                                {creating ? 'Inscribing...' : 'Finalize Category'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {mediaTypes.length === 0 ? (
                    <div className="p-20 text-center glass border border-white/10 border-dashed rounded-3xl bg-white/2 space-y-6">
                        <div className="flex justify-center">
                            <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                                <ImageIcon className="h-8 w-8 text-white/20" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tighter italic">Vault is Empty</h2>
                            <p className="text-white/20 text-sm font-light max-w-xs mx-auto">No training assets detected. Initialize a category to begin population.</p>
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)} className="glass-strong border-white/10 hover:bg-white/10 text-white uppercase text-[10px] font-bold tracking-widest px-8">
                            <Plus className="mr-2 h-4 w-4" />
                            Initialize First Category
                        </Button>
                    </div>
                ) : (
                    <Tabs defaultValue={mediaTypes[0]?.id} className="w-full">
                        {/* Scrollable Tab List */}
                        <div className="relative mb-8 pt-2">
                            <div className="overflow-x-auto pb-4 scrollbar-hide">
                                <TabsList className="flex w-max bg-transparent border-b border-white/5 rounded-none p-0 gap-6 h-auto">
                                    {mediaTypes.map((type: any) => (
                                        <TabsTrigger
                                            key={type.id}
                                            value={type.id}
                                            className="relative px-0 py-4 border-none bg-transparent rounded-none data-[state=active]:bg-transparent data-[state=active]:text-white text-white/30 hover:text-white/50 transition-all font-bold uppercase text-[11px] tracking-[0.2em] group"
                                        >
                                            <span className="flex items-center gap-2">
                                                {type.id}
                                                <Badge className="bg-white/5 text-white/40 border-white/10 group-data-[state=active]:bg-white/10 group-data-[state=active]:text-white transition-colors">
                                                    {type.medias.length}
                                                </Badge>
                                            </span>
                                            {/* Underline for active state */}
                                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 scale-x-0 group-data-[state=active]:scale-x-100 transition-transform duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </div>
                        </div>

                        {mediaTypes.map((type: any) => (
                            <TabsContent key={type.id} value={type.id} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xs font-bold text-white/20 uppercase tracking-[0.3em]">Category View</h3>
                                        <p className="text-lg font-semibold text-white/80">{type.id}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteCategory(type.id)}
                                        className="text-red-500/40 hover:text-red-500 hover:bg-red-500/10 uppercase text-[9px] font-black tracking-widest px-3 h-8 border border-transparent hover:border-red-500/20"
                                    >
                                        <Trash2 className="h-3 w-3 mr-2" />
                                        Purge Category
                                    </Button>
                                </div>

                                <div
                                    className={cn(
                                        "relative rounded-3xl border-2 border-dashed border-white/5 transition-all p-8 flex flex-col min-h-[400px]",
                                        dragActive ? "border-blue-500/50 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.05)]" : "bg-black/20"
                                    )}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={(e) => handleDrop(e, type.id)}
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                        {/* Upload Placeholder - FIRST in grid */}
                                        <div className="aspect-square relative flex flex-col items-center justify-center glass border-2 border-dashed border-white/10 rounded-2xl hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer group shadow-xl">
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) handleUpload(e.target.files[0], type.id)
                                                }}
                                            />
                                            <div className="flex flex-col items-center gap-3 text-white/20 group-hover:text-white/60 transition-all group-hover:scale-110 duration-300">
                                                {uploading ? (
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                                ) : (
                                                    <>
                                                        <div className="p-4 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                                                            <Plus className="h-6 w-6" />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Add Asset</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {type.medias.map((media: any) => (
                                            <div key={media.id} className="aspect-square group relative rounded-2xl overflow-hidden glass border border-white/10 shadow-2xl hover:scale-[1.03] transition-all duration-300">
                                                <div className="w-full h-full relative flex items-center justify-center bg-black/40">
                                                    {media.url.startsWith('data:video') || media.url.includes('video') || media.url.endsWith('.mp4') ? (
                                                        <video
                                                            src={media.url}
                                                            className={cn("w-full h-full object-cover transition-all duration-500", isBlurred && "blur-2xl opacity-50")}
                                                            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                                                            onMouseLeave={(e) => {
                                                                const v = e.currentTarget as HTMLVideoElement;
                                                                v.pause();
                                                                v.currentTime = 0;
                                                            }}
                                                            muted
                                                            loop
                                                        />
                                                    ) : (
                                                        <img
                                                            src={media.url}
                                                            alt={type.id}
                                                            className={cn("w-full h-full object-cover transition-all duration-500", isBlurred && "blur-2xl opacity-50")}
                                                        />
                                                    )}

                                                    {/* Action Overlay */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-xl bg-red-500/20 hover:bg-red-500 border border-red-500/40 text-red-500 hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-300"
                                                            onClick={() => handleDeleteMedia(media.id)}
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>

                                                    {/* Media Type Indicator */}
                                                    <div className="absolute bottom-2 left-2 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                                                        {(media.url.includes('video') || media.url.endsWith('.mp4')) ? (
                                                            <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest text-white border border-white/10">Video</div>
                                                        ) : (
                                                            <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest text-white border border-white/10">Image</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {type.medias.length === 0 && !uploading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                                            <Upload className="h-12 w-12 mb-4 animate-bounce" />
                                            <p className="text-sm font-light italic tracking-widest">Synchronize assets via drag & drop</p>
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
