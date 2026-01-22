'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from '@/lib/utils'
import { Plus, Image as ImageIcon, Trash2, ArrowLeft, Video, Film, Grid, MoreVertical, Edit2 } from 'lucide-react'
import { getMediaTypes, createMediaType, deleteMediaType, deleteMedia, saveMedia, updateMediaContext, generateAutoContext } from '@/app/actions/media'
import { useParams } from 'next/navigation'
import { useToast } from "@/components/ui/use-toast"
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { usePWAMode } from '@/hooks/use-pwa-mode'
import { MobileMediaGrid } from '@/components/pwa/pages/mobile-media-grid'

export default function WorkspaceMediaPage() {
    const params = useParams()
    const { toast } = useToast()
    const { isPWAStandalone } = usePWAMode()
    const [mediaTypes, setMediaTypes] = useState<any[]>([])

    const [loading, setLoading] = useState(true)
    const [generatingContext, setGeneratingContext] = useState(false) // New state for overlay

    // Navigation State
    const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos')
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null) // If null, we are in "Root" view

    // Creation / Edition State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newCategory, setNewCategory] = useState({ id: '', description: '', keywords: '', type: 'photos' }) // Added type
    const [creating, setCreating] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Context Edition State
    const [contextMedia, setContextMedia] = useState<any | null>(null)
    const [contextText, setContextText] = useState('')
    const [savingContext, setSavingContext] = useState(false)

    // Fetch Data
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

    // Logic to filter categories based on the Active Tab
    const filteredCategories = useMemo(() => {
        return mediaTypes.filter(cat => {
            // Heuristic to decide if a category belongs to "Photos" or "Videos"
            // 1. Check strict naming convention if any
            // 2. Check content types
            // 3. Fallback to ID string check

            const hasVideos = cat.medias.some((m: any) => m.url.includes('video') || m.url.endsWith('.mp4'))
            const hasPhotos = cat.medias.some((m: any) => !m.url.includes('video') && !m.url.endsWith('.mp4'))

            const nameImpliesVideo = cat.id.toLowerCase().includes('video') || cat.id.toLowerCase().includes('reel')

            if (activeTab === 'videos') {
                return hasVideos || nameImpliesVideo || (cat.medias.length === 0 && nameImpliesVideo)
            } else {
                // Photos tab catches everything else OR explicit photo categories
                return !nameImpliesVideo && (hasPhotos || cat.medias.length === 0 || !hasVideos)
            }
        })
    }, [mediaTypes, activeTab])

    const handleCreate = async () => {
        if (!newCategory.id) return
        setCreating(true)

        // Auto-fix ID based on tab if user didn't specify
        let finalId = newCategory.id.toLowerCase().replace(/\s/g, '_')
        if (activeTab === 'videos' && !finalId.includes('video')) {
            // Optional: prefix? No, let user decide, just logic above handles it.
        }

        try {
            await createMediaType({
                id: finalId,
                description: newCategory.description,
                keywords: newCategory.keywords.split(',').map(k => k.trim())
            })
            setIsCreateOpen(false)
            setNewCategory({ id: '', description: '', keywords: '', type: 'photos' })
            fetchMedia()
        } catch (error) {
            alert('Failed to create category')
        } finally {
            setCreating(false)
        }
    }

    const handleUpload = async (file: File, categoryId: string) => {
        console.log('Starting upload for:', file.name, 'Size:', file.size)
        setUploading(true)

        // Initialize Supabase Client for Client-Side Upload
        let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        // [FIX] Mixed Content: If we are on HTTPS and target is HTTP, use the proxy
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && supabaseUrl?.startsWith('http:')) {
            console.log('Switching to Proxy for Mixed Content compatibility')
            supabaseUrl = window.location.origin + '/supabase-proxy'
        }

        console.log('Supabase Config:', {
            url: supabaseUrl,
            keyLength: supabaseKey?.length || 0
        })

        if (!supabaseUrl || !supabaseKey) {
            alert(`Missing Configuration: SUPABASE_URL or SUPABASE_ANON_KEY is missing. \nURL: ${supabaseUrl}\nKey Set: ${!!supabaseKey}`)
            setUploading(false)
            return
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        try {
            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}_${uuidv4()}.${fileExt}`
            const filePath = `${categoryId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(filePath)

            // 3. Save Metadata to DB
            const result = await saveMedia(publicUrl, categoryId)

            console.log('[AutoContext] Save Result:', result)
            console.log('[AutoContext] Params AgentID:', params.agentId)
            console.log('[AutoContext] File Type:', file.type)

            // 4. Trigger Auto-Context (Async)

            if (result.success && result.media && params.agentId && file.type.startsWith('image/')) {
                console.log('[AutoContext] Triggering generation...')
                setGeneratingContext(true) // Show overlay
                toast({ title: "✨ Generating Context...", description: "Analyzing image with AI..." })

                // Don't await strictly to keep UI responsive, but we want to open the dialog when done.
                // Actually, let's wait so we can pop the dialog immediately.
                try {
                    const ctx = await generateAutoContext(result.media.id, Number(params.agentId))
                    if (ctx.success && ctx.context) {
                        setContextMedia({ ...result.media, context: ctx.context })
                        setContextText(ctx.context)
                        toast({ title: "Context Generated", description: "Review and save." })
                    } else {
                        toast({ title: "Auto-Context Failed", description: ctx.error || "Unknown error", variant: "destructive" })
                    }
                } catch (e) {
                    console.error("AutoContext Failed (Client)", e)
                    toast({ title: "Auto-Context Error", description: "Could not generate context.", variant: "destructive" })
                } finally {
                    setGeneratingContext(false)
                }
            }

            fetchMedia()

            // Update local state immediately for better UX
            if (selectedCategory?.id === categoryId) {
                const data = await getMediaTypes()
                const dataArray = Array.isArray(data) ? data : []
                const updated = dataArray.find((c: any) => c.id === categoryId)
                if (updated) setSelectedCategory(updated)
            }
        } catch (error) {
            console.error('Upload Error:', error)
            alert('Upload failed: ' + (error as any).message)
        } finally {
            setUploading(false)
        }
    }

    // Update selected category when mediaTypes changes (e.g. after upload/delete)
    useEffect(() => {
        if (selectedCategory && Array.isArray(mediaTypes)) {
            const updated = mediaTypes.find(c => c.id === selectedCategory.id)
            if (updated) setSelectedCategory(updated)
        }
    }, [mediaTypes])

    const handleDeleteMedia = async (mediaId: number) => {
        if (!confirm('Delete this media?')) return
        await deleteMedia(mediaId)
        fetchMedia()
    }

    const handleDeleteCategory = async (categoryId: string) => {
        if (!confirm(`Delete folder "${categoryId}" and all contents?`)) return
        await deleteMediaType(categoryId)
        setSelectedCategory(null) // Go back to root
        fetchMedia()
    }

    const handleSaveContext = async () => {
        if (!contextMedia) return
        setSavingContext(true)
        try {
            await updateMediaContext(contextMedia.id, contextText)
            setContextMedia(null)
            setContextText('')
            fetchMedia()
            // Update local state
            if (selectedCategory) {
                const updatedMedias = selectedCategory.medias.map((m: any) =>
                    m.id === contextMedia.id ? { ...m, context: contextText } : m
                )
                setSelectedCategory({ ...selectedCategory, medias: updatedMedias })
            }
        } catch (error) {
            alert('Failed to save context')
        } finally {
            setSavingContext(false)
        }
    }

    // Helper to proxy media URLs to avoid Mixed Content (HTTPS -> HTTP)
    const getProxiedUrl = (url: string) => {
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://16.171.66.98:8000')) {
            return url.replace('http://16.171.66.98:8000', window.location.origin + '/supabase-proxy')
        }
        return url
    }

    // --- RENDERERS ---

    // 1. Folder Icon Component
    const FolderIcon = ({ category, onClick }: { category: any, onClick: () => void }) => {
        const previews = category.medias.slice(0, 4) // First 4 items

        return (
            <div className="flex flex-col gap-3 group px-2">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClick}
                    className="aspect-square bg-white/10 backdrop-blur-md rounded-[2rem] p-4 cursor-pointer border border-white/5 group-hover:bg-white/15 group-hover:border-white/20 transition-all shadow-lg overflow-hidden relative"
                >
                    {/* Mini Grid */}
                    <div className="grid grid-cols-2 gap-2 w-full h-full">
                        {[0, 1, 2, 3].map((i) => {
                            const item = previews[i]
                            return (
                                <div key={i} className="rounded-lg bg-black/20 overflow-hidden relative aspect-square">
                                    {item && (
                                        item.url.includes('video') || item.url.endsWith('.mp4') ? (
                                            <video src={getProxiedUrl(item.url)} className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <img src={getProxiedUrl(item.url)} className="w-full h-full object-cover opacity-80" alt="" />
                                        )
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </motion.div>
                <div className="text-center">
                    <h3 className="text-sm font-medium text-white/90 truncate max-w-full px-1">{category.id}</h3>
                    <p className="text-[10px] text-white/40 font-mono">{category.medias.length} items</p>
                </div>
            </div>
        )
    }

    if (loading && mediaTypes.length === 0) return <div className="p-10 text-white/50">Loading interface...</div>

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">

            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 shrink-0">
                <div className="flex bg-black/40 p-1 rounded-full border border-white/5 backdrop-blur-xl">
                    <button
                        onClick={() => { setActiveTab('photos'); setSelectedCategory(null); }}
                        className={cn(
                            "px-8 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            activeTab === 'photos' ? "bg-white text-black shadow-lg" : "text-white/50 hover:text-white"
                        )}
                    >
                        Photos
                    </button>
                    <button
                        onClick={() => { setActiveTab('videos'); setSelectedCategory(null); }}
                        className={cn(
                            "px-8 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            activeTab === 'videos' ? "bg-white text-black shadow-lg" : "text-white/50 hover:text-white"
                        )}
                    >
                        Videos
                    </button>
                </div>

                <div className="flex gap-3">
                    {!selectedCategory && (
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full px-6"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Folder
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pb-20">
                <AnimatePresence mode="wait">

                    {/* VIEW: ROOT (Folder Grid) */}
                    {!selectedCategory ? (
                        <motion.div
                            key="root"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-10 p-4"
                        >
                            {/* Create Button as a Folder (Optional, maybe at start) */}
                            <div
                                onClick={() => setIsCreateOpen(true)}
                                className="flex flex-col gap-3 group px-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                            >
                                <div className="aspect-square bg-transparent border-2 border-dashed border-white/20 rounded-[2rem] flex items-center justify-center group-hover:border-white/40">
                                    <Plus className="w-10 h-10 text-white/30" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-sm font-medium text-white/50">New Folder</h3>
                                </div>
                            </div>

                            {filteredCategories.map(cat => (
                                <FolderIcon
                                    key={cat.id}
                                    category={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                />
                            ))}
                        </motion.div>
                    ) : (

                        /* VIEW: FOLDER DETAIL */
                        <motion.div
                            key="folder"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="space-y-6 h-full flex flex-col"
                        >
                            {/* Folder Header */}
                            <div className="flex items-center justify-between px-4 shrink-0">
                                <Button
                                    variant="ghost"
                                    onClick={() => setSelectedCategory(null)}
                                    className="text-white/60 hover:text-white hover:bg-white/5 -ml-4 gap-2 pl-3 rounded-full"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                    <span className="text-lg font-medium">Library</span>
                                </Button>

                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-bold text-white">{selectedCategory.id} <span className="text-xs opacity-50">v2 (Supabase)</span></h2>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCategory(selectedCategory.id)}
                                        className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Folder Content Grid */}
                            <div className="flex-1 overflow-y-auto p-4 bg-black/20 rounded-3xl border border-white/5 shadow-inner">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">

                                    {/* Upload Button */}
                                    <div className="aspect-square relative flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer overflow-hidden group">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleUpload(e.target.files[0], selectedCategory.id)
                                            }}
                                        />
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 rounded-full bg-white/10 group-hover:bg-blue-500 transition-colors">
                                                    <Plus className="w-6 h-6 text-white" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Add Media</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Media Items */}
                                    {selectedCategory.medias.map((media: any) => (
                                        <div key={media.id} className="aspect-square relative group rounded-xl overflow-hidden bg-black/40 border border-white/5">
                                            {media.url.includes('video') || media.url.endsWith('.mp4') ? (
                                                <video
                                                    src={getProxiedUrl(media.url)}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                />
                                            ) : (
                                                <img
                                                    src={getProxiedUrl(media.url)}
                                                    alt="media"
                                                    className="w-full h-full object-cover"
                                                />
                                            )}

                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8 rounded-full shadow-lg bg-black/50 hover:bg-black/80 text-white"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setContextMedia(media)
                                                        setContextText(media.context || '')
                                                    }}
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="h-8 w-8 rounded-full shadow-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteMedia(media.id)
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {media.context && (
                                                <div className="absolute bottom-2 left-2 right-2">
                                                    <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/90 truncate">
                                                        {media.context}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="glass-strong text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle>New Folder</DialogTitle>
                        <DialogDescription>Create a collection for {activeTab}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Folder Name</Label>
                            <Input
                                placeholder={activeTab === 'videos' ? "e.g. video_greeting" : "e.g. photo_beach"}
                                value={newCategory.id}
                                onChange={e => setNewCategory({ ...newCategory, id: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                placeholder="Context for the AI..."
                                value={newCategory.description}
                                onChange={e => setNewCategory({ ...newCategory, description: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Keywords</Label>
                            <Textarea
                                placeholder="comma, separated, tags"
                                value={newCategory.keywords}
                                onChange={e => setNewCategory({ ...newCategory, keywords: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate} disabled={!newCategory.id || creating} className="w-full bg-white text-black hover:bg-white/90">
                            {creating ? 'Creating...' : 'Create Folder'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Context Edit Dialog */}
            <Dialog open={!!contextMedia} onOpenChange={(open) => !open && setContextMedia(null)}>
                <DialogContent className="glass-strong text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle>Edit Image Context</DialogTitle>
                        <DialogDescription>
                            Add hidden context for the AI. This helps it answer questions like "Where is this?" or "Who is this?".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/40 relative">
                            {contextMedia && (
                                contextMedia.url.includes('video') || contextMedia.url.endsWith('.mp4') ? (
                                    <video src={getProxiedUrl(contextMedia.url)} className="w-full h-full object-contain" />
                                ) : (
                                    <img src={getProxiedUrl(contextMedia.url)} className="w-full h-full object-contain" alt="" />
                                )
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Context / Story</Label>
                            <Textarea
                                placeholder="e.g. This was at the beach in Miami, summer 2023. I was with high school friends."
                                value={contextText}
                                onChange={e => setContextText(e.target.value)}
                                className="bg-white/5 border-white/10 text-white min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setContextMedia(null)} variant="ghost" className="text-white/50 hover:text-white">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveContext} disabled={savingContext} className="bg-white text-black hover:bg-white/90">
                            {savingContext ? 'Saving...' : 'Save Context'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Loading Overlay */}
            {generatingContext && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                        <h3 className="font-bold text-lg">Generating Context with AI...</h3>
                        <p className="text-sm text-gray-500">Analyzing your image against agent identity.</p>
                        <p className="text-xs text-gray-400">Please wait (can take 10-20s)</p>
                    </div>
                </div>
            )}
        </div>
    )
}

