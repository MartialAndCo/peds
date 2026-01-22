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
import { getAgentEvents, createAgentEvent, deleteAgentEvent } from '@/app/actions/events'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import { format } from 'date-fns'

export default function WorkspaceMediaPage() {
    const params = useParams()
    const { toast } = useToast()
    const { isPWAStandalone } = usePWAMode()
    const [mediaTypes, setMediaTypes] = useState<any[]>([])

    const [loading, setLoading] = useState(true)
    const [generatingContext, setGeneratingContext] = useState(false) // New state for overlay

    // Navigation State
    const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'timeline'>('photos')
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null) // If null, we are in "Root" view

    // Creation / Edition State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newCategory, setNewCategory] = useState({ id: '', description: '', keywords: '', type: 'photos' }) // Added type
    const [creating, setCreating] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Timeline State
    const [events, setEvents] = useState<any[]>([])
    const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
    const [newEvent, setNewEvent] = useState({ title: '', location: '', startDate: '', endDate: '', description: '' })
    const [creatingEvent, setCreatingEvent] = useState(false)

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

    // Initial Fetch (Media + Events)
    useEffect(() => {
        fetchMedia()
        fetchEvents()
    }, [params.agentId])

    const fetchEvents = async () => {
        if (!params.agentId) return
        try {
            const data = await getAgentEvents(Number(params.agentId))
            setEvents(data)
        } catch (e) {
            console.error("Failed to fetch events", e)
        }
    }

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

    // Timeline Handlers
    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.location || !newEvent.startDate) return alert("Title, Location and Start Date are required")
        setCreatingEvent(true)
        try {
            await createAgentEvent(Number(params.agentId), {
                title: newEvent.title,
                location: newEvent.location,
                startDate: new Date(newEvent.startDate),
                endDate: newEvent.endDate ? new Date(newEvent.endDate) : undefined,
                description: newEvent.description
            })
            setNewEvent({ title: '', location: '', startDate: '', endDate: '', description: '' })
            setIsEventDialogOpen(false)
            fetchEvents()
            toast({ title: "Event Added", description: "Added to timeline." })
        } catch (e) {
            alert('Failed to create event')
        } finally {
            setCreatingEvent(false)
        }
    }

    const handleDeleteEvent = async (id: number) => {
        if (!confirm('Delete this event?')) return
        await deleteAgentEvent(id)
        fetchEvents()
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
                    <button
                        onClick={() => { setActiveTab('timeline'); setSelectedCategory(null); }}
                        className={cn(
                            "px-8 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
                            activeTab === 'timeline' ? "bg-white text-black shadow-lg" : "text-white/50 hover:text-white"
                        )}
                    >
                        Timeline
                    </button>
                </div>

                <div className="flex gap-3">
                    {!selectedCategory && activeTab !== 'timeline' && (
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
                {activeTab === 'timeline' ? (
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-white font-bold text-lg">Known History</h2>
                            <Button onClick={() => setIsEventDialogOpen(true)} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
                                <Plus className="w-4 h-4" /> Add Event
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {events.length === 0 ? (
                                <div className="text-center py-10 text-white/30 border border-dashed border-white/10 rounded-xl">
                                    No events recorded. <br /> Add trips, holidays, or milestones to guide the AI.
                                </div>
                            ) : (
                                events.map((event) => (
                                    <div key={event.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4">
                                        <div className="flex-col items-center justify-center pt-1 hidden sm:flex">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <CalendarIcon className="w-5 h-5" />
                                            </div>
                                            <div className="w-0.5 h-full bg-white/5 mt-2 flex-grow"></div>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-white font-semibold text-base">{event.title}</h3>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-red-400" onClick={() => handleDeleteEvent(event.id)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-white/60">
                                                <MapPinIcon className="w-3 h-3" />
                                                {event.location}
                                                <span className="w-1 h-1 bg-white/20 rounded-full mx-1"></span>
                                                {format(new Date(event.startDate), 'MMM yyyy')}
                                                {event.endDate && ` - ${format(new Date(event.endDate), 'MMM yyyy')}`}
                                            </div>
                                            {event.description && <p className="text-xs text-white/40 pt-1">{event.description}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
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
                )}
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
            {/* Context Edit Dialog (Premium Dark) */}
            <Dialog open={!!contextMedia} onOpenChange={(open) => !open && setContextMedia(null)}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl">
                    <DialogTitle className="sr-only">Edit Image Context</DialogTitle>
                    <div className="relative h-48 w-full bg-zinc-900">
                        {contextMedia && (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent z-10" />
                                {contextMedia.url.includes('video') || contextMedia.url.endsWith('.mp4') ? (
                                    <video src={getProxiedUrl(contextMedia.url)} className="w-full h-full object-cover opacity-80" />
                                ) : (
                                    <img src={getProxiedUrl(contextMedia.url)} className="w-full h-full object-cover opacity-80" alt="Context Preview" />
                                )}
                            </>
                        )}
                        <div className="absolute top-4 left-4 z-20 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <span className="text-xs font-medium text-emerald-400">✨ AI Suggestion</span>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold tracking-tight text-white">Memory Context</h3>
                            <p className="text-xs text-zinc-400 leading-snug">
                                This hidden story helps the AI remember <b>when</b> and <b>where</b> this was.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">The Backstory</Label>
                            <Textarea
                                value={contextText}
                                onChange={(e) => setContextText(e.target.value)}
                                className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500/50 text-zinc-200 min-h-[100px] resize-none rounded-xl p-4 text-sm leading-relaxed"
                                placeholder="E.g. My trip to Cabo in 2023..."
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                                onClick={() => setContextMedia(null)}
                            >
                                Discard
                            </Button>
                            <Button
                                className="flex-1 bg-white text-black hover:bg-zinc-200 font-medium tracking-wide transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                onClick={handleSaveContext}
                                disabled={savingContext}
                            >
                                {savingContext ? 'Saving...' : 'Save Memory'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Event Creation Dialog */}
            <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogTitle>Add Timeline Event</DialogTitle>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Event Title</Label>
                            <Input
                                placeholder="e.g. Trip to Bali"
                                className="bg-white/5 border-white/10"
                                value={newEvent.title}
                                onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Location</Label>
                            <Input
                                placeholder="e.g. Ubud, Indonesia"
                                className="bg-white/5 border-white/10"
                                value={newEvent.location}
                                onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    className="bg-white/5 border-white/10"
                                    value={newEvent.startDate}
                                    onChange={e => setNewEvent({ ...newEvent, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date (Optional)</Label>
                                <Input
                                    type="date"
                                    className="bg-white/5 border-white/10"
                                    value={newEvent.endDate}
                                    onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateEvent} disabled={creatingEvent} className="bg-white text-black hover:bg-zinc-200">
                            {creatingEvent ? 'Adding...' : 'Add Event'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Loading Overlay (Click outside to dismiss if stuck) */}
            {generatingContext && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setGeneratingContext(false)} // Safety escape
                >
                    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-5 text-center shadow-2xl max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                            <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20"></div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-lg text-white">Generating Story...</h3>
                            <p className="text-sm text-zinc-400">AI is analyzing the location & vibe.</p>
                        </div>
                        <p className="text-xs text-zinc-600 font-mono">Tap background to cancel</p>
                    </div>
                </div>
            )}
        </div>
    )
}
