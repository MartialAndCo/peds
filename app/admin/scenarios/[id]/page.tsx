"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2, Upload, Trash, Image as ImageIcon, Video, FileText } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { updateScenario, addScenarioMedia, deleteScenarioMedia } from "@/app/actions/scenarios"

export default function ScenarioDetailPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const scenarioId = params.id as string

    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [scenario, setScenario] = useState<any>(null)
    const [mediaList, setMediaList] = useState<any[]>([])

    // Media Upload State
    const [uploading, setUploading] = useState(false)
    const [newMediaDesc, setNewMediaDesc] = useState("")

    useEffect(() => {
        const fetchScenario = async () => {
            try {
                // Fetch basic DB data wrapper
                const res = await fetch(`/api/scenarios/${scenarioId}`)
                if (res.ok) {
                    const data = await res.json()
                    setScenario(data.scenario)
                    setMediaList(data.media)
                }
            } catch (e) {
                console.error("Failed to load scenario", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchScenario()
    }, [scenarioId])

    const handleSave = async () => {
        setIsSaving(true)
        const result = await updateScenario(scenarioId, {
            title: scenario.title,
            description: scenario.description,
            targetContext: scenario.targetContext
        })
        setIsSaving(false)

        if (result.success) {
            toast({ title: "Scenario updated successfully" })
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    const handleMediaUpload = async (file: File) => {
        if (!newMediaDesc) {
            toast({ title: "Description Required", description: "You must tell the AI what this media is.", variant: "destructive" })
            return
        }

        setUploading(true)
        try {
            const { createClient } = await import('@supabase/supabase-js')
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            if (!supabaseUrl || !supabaseKey) throw new Error('Supabase not configured')
            const supabase = createClient(supabaseUrl, supabaseKey)

            const ext = file.name.split('.').pop() || 'jpg'
            const fileName = `${scenarioId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
            const determinedType = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image'

            const { error: uploadError } = await supabase.storage
                .from('scenarios')
                .upload(fileName, file, { contentType: file.type, upsert: false })

            if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

            // Save to DB
            const result = await addScenarioMedia(scenarioId, fileName, determinedType, newMediaDesc)

            if (result.success) {
                toast({ title: "Media uploaded and linked" })
                setNewMediaDesc("")
                // Soft refresh internal media state OR rely on a re-fetch
                window.location.reload();
            } else {
                throw new Error(result.error)
            }
        } catch (e: any) {
            toast({ title: "Upload Error", description: e.message || "Unknown error", variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    const handleDeleteMedia = async (mediaId: string) => {
        if (!confirm('Are you sure you want to delete this media?')) return
        const result = await deleteScenarioMedia(mediaId, scenarioId)
        if (result.success) {
            setMediaList(prev => prev.filter(m => m.id !== mediaId))
            toast({ title: "Media removed" })
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    if (isLoading) return <div className="p-6 text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>
    if (!scenario) return <div className="p-6 text-red-400">Scenario not found.</div>

    return (
        <div className="space-y-8 p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/scenarios">
                        <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Edit Scenario</h1>
                        <p className="text-white/40">ID: {scenarioId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/admin/scenarios/${scenarioId}/launch`}>
                        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            Launch Scenario
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: Context & Prompts */}
                <Card className="bg-[#1e293b] border-white/10 text-white">
                    <CardHeader>
                        <CardTitle>Core Instructions</CardTitle>
                        <CardDescription className="text-white/40">
                            What the AI needs to know about this event.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Title</label>
                            <Input
                                value={scenario.title}
                                onChange={(e) => setScenario(prev => ({ ...prev, title: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Main Description</label>
                            <Textarea
                                value={scenario.description}
                                onChange={(e) => setScenario(prev => ({ ...prev, description: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white min-h-[120px]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Target Context / Directives</label>
                            <Textarea
                                value={scenario.targetContext || ""}
                                onChange={(e) => setScenario(prev => ({ ...prev, targetContext: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white min-h-[120px]"
                            />
                        </div>
                        <Button onClick={handleSave} disabled={isSaving} className="w-full bg-white text-slate-900 hover:bg-slate-200">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Rules
                        </Button>
                    </CardContent>
                </Card>

                {/* RIGHT: Media Assets */}
                <Card className="bg-[#1e293b] border-white/10 text-white">
                    <CardHeader>
                        <CardTitle>Scenario Media Assets</CardTitle>
                        <CardDescription className="text-white/40">
                            Upload photos/videos specifically scoped to this scenario. The AI will know *exactly* when to use them based on your description.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Upload Form */}
                        <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/5 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-white/40">AI Instruction (When to send this?)</label>
                                <Input
                                    placeholder="e.g. 'Photo de la douche qui déborde pour prouver le dégât'"
                                    value={newMediaDesc}
                                    onChange={(e) => setNewMediaDesc(e.target.value)}
                                    className="bg-black/20 border-white/10 text-white h-9"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    id="media-upload"
                                    className="hidden"
                                    accept="image/*,video/*"
                                    onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0])}
                                />
                                <Button
                                    variant="secondary"
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0"
                                    disabled={uploading || !newMediaDesc}
                                    onClick={() => document.getElementById('media-upload')?.click()}
                                >
                                    {uploading ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload className="w-4 h-4 mr-2" /> Select File to Upload</>
                                    )}
                                </Button>
                            </div>
                            {!newMediaDesc && <p className="text-[10px] text-amber-400/80 text-center">Fill the description first to enable upload.</p>}
                        </div>

                        {/* Media List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Available Assets ({mediaList?.length || 0})</h3>
                            {mediaList?.map(media => (
                                <div key={media.id} className="flex gap-4 p-3 rounded-lg bg-black/20 border border-white/5 items-center">
                                    <div className="h-12 w-12 rounded bg-white/5 flex items-center justify-center shrink-0">
                                        {media.mediaType === 'video' ? <Video className="w-5 h-5 text-white/40" /> : <ImageIcon className="w-5 h-5 text-white/40" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white line-clamp-2" title={media.aiDescription}>"{media.aiDescription}"</p>
                                        <p className="text-xs text-white/30 font-mono mt-1 w-full truncate">{media.bucketPath}</p>
                                    </div>
                                    <Button
                                        variant="ghost" size="icon"
                                        onClick={() => handleDeleteMedia(media.id)}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {mediaList?.length === 0 && (
                                <p className="text-sm text-white/30 text-center py-4">No exclusive media added yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
