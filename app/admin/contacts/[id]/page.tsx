'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    PlayCircle,
    AlertTriangle,
    Trash2,
    EyeOff,
    Zap,
    ArrowLeft,
    Save,
    Loader2,
    Shield,
    Smartphone
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function EditContactPage() {
    const params = useParams()
    const router = useRouter()
    const [contact, setContact] = useState<any>(null)
    const [conversation, setConversation] = useState<any>(null)
    const [context, setContext] = useState('')
    const [activating, setActivating] = useState(false)
    const [loading, setLoading] = useState(true)

    // Form State (since we are replacing ContactForm to fix layout)
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        if (params.id) {
            axios.get(`/api/contacts/${params.id}`)
                .then(res => {
                    setContact(res.data)
                    setFormData(res.data)
                    setContext(res.data.notes || '')
                    // Ideally API should return conversation status too
                    const activeConv = res.data.conversations?.[0]
                    setConversation(activeConv)
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false))
        }
    }, [params.id])

    const handleActivate = async () => {
        if (!conversation) return
        setActivating(true)
        try {
            await axios.post(`/api/conversations/${conversation.id}/activate`, {
                context: context
            })
            alert('Activated! AI should reply shortly.')
            window.location.reload()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setActivating(false)
        }
    }

    const handleSaveProfile = async () => {
        try {
            await axios.put(`/api/contacts/${contact.id}`, {
                ...formData,
                notes: context // Also save notes from main area
            })
            alert('Contact updated successfully')
            router.refresh()
        } catch (e: any) {
            alert('Failed to update: ' + e.message)
        }
    }

    const handleUpdateSettings = async (updates: any) => {
        try {
            setContact({ ...contact, ...updates }) // Optimistic UI
            await axios.put(`/api/contacts/${contact.id}`, updates)
        } catch (e: any) {
            alert('Failed to update settings: ' + e.message)
        }
    }

    const handleDelete = async () => {
        if (!confirm("⚠️ DANGER: This will PERMANENTLY DELETE this contact and ALL history. This cannot be undone. Are you sure?")) return;

        try {
            await axios.delete(`/api/contacts/${contact.id}`)
            router.push('/contacts') // Redirect to main list (or /admin/contacts if that exists)
        } catch (e: any) {
            alert('Delete failed: ' + e.message)
        }
    }

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
    if (!contact) return <div className="p-20 text-white text-center">Contact not found</div>

    const isPaused = conversation?.status === 'paused'

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="text-white/50 hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{contact.name || 'Unknown'}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm font-mono text-white/40">{contact.phone_whatsapp}</p>
                            <Badge variant="outline" className={cn(
                                "text-[10px] uppercase font-bold tracking-wider",
                                isPaused ? "border-orange-500/50 text-orange-400" : "border-emerald-500/50 text-emerald-400"
                            )}>
                                {conversation?.status?.toUpperCase() || 'IDLE'}
                            </Badge>
                        </div>
                    </div>
                </div>

                <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                </Button>
            </div>

            {/* ACTIVATION PANEL (Only if Paused) */}
            {isPaused && (
                <div className="glass border-l-4 border-orange-500 p-6 rounded-r-xl bg-orange-500/5">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <AlertTriangle className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <h3 className="text-white font-bold text-lg">AI is Paused</h3>
                                <p className="text-white/60 text-sm">
                                    This conversation requires context before the AI can reply.
                                    Provide a backstory or instructions below.
                                </p>
                            </div>

                            <Textarea
                                placeholder="e.g. He is a 45yo accountant, we met on Tinder. He thinks I'm a student..."
                                className="bg-black/40 border-white/10 text-white min-h-[80px]"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                            />

                            <Button
                                onClick={handleActivate}
                                disabled={activating || !context.trim()}
                                className="bg-orange-500 hover:bg-orange-600 text-white w-full md:w-auto"
                            >
                                {activating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                                Activate & Reply
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT: Profile Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-6 rounded-2xl space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                            <Smartphone className="h-4 w-4 text-blue-400" />
                            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Contact Profile</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-white/60 text-xs uppercase">Name</Label>
                                <Input
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white/60 text-xs uppercase">Phone Number</Label>
                                <Input
                                    value={formData.phone_whatsapp || ''}
                                    onChange={e => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white/60 text-xs uppercase">Source</Label>
                                <Input
                                    value={formData.source || ''}
                                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white/60 text-xs uppercase">Status</Label>
                                <Input
                                    value={formData.status || ''}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-white/60 text-xs uppercase">Internal Notes & Content</Label>
                            <Textarea
                                value={context}
                                onChange={e => setContext(e.target.value)}
                                className="bg-white/5 border-white/10 text-white min-h-[150px]"
                                placeholder="Add persistent notes here..."
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT: Settings & Actions */}
                <div className="space-y-6">
                    {/* Advanced Settings */}
                    <div className="glass p-6 rounded-2xl space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                            <Shield className="h-4 w-4 text-purple-400" />
                            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Advanced Config</h3>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm text-white font-medium flex items-center gap-2">
                                    <Zap className="h-3 w-3 text-amber-500" />
                                    Test Mode
                                </Label>
                                <p className="text-[10px] text-white/40">Ignore all delays</p>
                            </div>
                            <Switch
                                checked={contact?.testMode || false}
                                onCheckedChange={(checked) => handleUpdateSettings({ testMode: checked })}
                                className="data-[state=checked]:bg-amber-500"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm text-white font-medium flex items-center gap-2">
                                    <EyeOff className="h-3 w-3 text-blue-500" />
                                    Hide Contact
                                </Label>
                                <p className="text-[10px] text-white/40">Hide from dashboard</p>
                            </div>
                            <Switch
                                checked={contact?.isHidden || false}
                                onCheckedChange={(checked) => handleUpdateSettings({ isHidden: checked })}
                                className="data-[state=checked]:bg-blue-500"
                            />
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="glass p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Force Delete
                        </Button>
                        <p className="text-center text-[10px] text-red-400/60 mt-2">
                            Removes messages, memories, everything.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
