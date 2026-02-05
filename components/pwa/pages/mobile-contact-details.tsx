'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare, MapPin, Briefcase, Heart, Calendar, User, Shield, Info, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface MobileContactDetailsProps {
    contact: any
    media: any[]
    agentId: string
}

export function MobileContactDetails({ contact, media, agentId }: MobileContactDetailsProps) {
    const router = useRouter()
    const profile = contact.profile || {}
    const phases = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT']
    const currentPhaseIdx = phases.indexOf(contact.agentPhase || 'CONNECTION')

    // Helper to fix base64 URLs that were stored without proper data URI prefix
    const fixMediaUrl = (url: string | null | undefined): string => {
        if (!url) return 'https://placehold.co/100x100/000000/FFFFFF?text=No+Image'
        
        // Fix raw base64 data that was stored without proper data URI prefix
        if (url.startsWith('/9j/')) {
            return `data:image/jpeg;base64,${url}`
        }
        if (url.startsWith('iVBOR')) {
            return `data:image/png;base64,${url}`
        }
        if (url.startsWith('R0lGOD')) {
            return `data:image/gif;base64,${url}`
        }
        if (url.startsWith('UklGR')) {
            return `data:image/webp;base64,${url}`
        }
        return url
    }

    return (
        <div className="min-h-screen bg-[#0f172a] pb-24">
            {/* Native Header with Back Button */}
            <div className="sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] px-2 h-14 flex items-center pwa-safe-area-top-margin">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 -ml-1"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-lg font-bold text-white ml-2">Profile</h1>
            </div>

            {/* Profile Header Card */}
            <div className="px-5 pt-8 pb-6 flex flex-col items-center relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />

                <div className="relative mb-4">
                    <div className="h-28 w-28 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-white/10 flex items-center justify-center shadow-2xl">
                        <span className="text-white font-bold text-4xl">
                            {contact.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className={cn(
                        "absolute bottom-1 right-1 h-6 w-6 rounded-full border-2 border-[#0f172a] flex items-center justify-center",
                        contact.status === 'active' ? "bg-emerald-500" : "bg-white/20"
                    )} />
                </div>

                <h2 className="text-2xl font-bold text-white text-center mb-1">{contact.name}</h2>
                <p className="text-white/40 font-mono text-sm mb-6">{contact.phone_whatsapp}</p>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                    <div className="glass rounded-2xl p-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Trust Score</span>
                        <span className={cn(
                            "text-2xl font-black",
                            contact.trustScore > 75 ? "text-emerald-400" : contact.trustScore < 30 ? "text-red-400" : "text-amber-400"
                        )}>
                            {contact.trustScore}%
                        </span>
                    </div>
                    <div className="glass rounded-2xl p-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Phase</span>
                        <span className="text-sm font-bold text-blue-400 mt-1">{contact.agentPhase}</span>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="info" className="w-full px-0">
                <TabsList className="w-full bg-transparent border-b border-white/5 rounded-none h-12 p-0 px-5 gap-6 justify-start overflow-x-auto pwa-hide-scrollbar">
                    <TabsTrigger value="info" className="rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white font-bold uppercase text-xs tracking-widest px-0 pb-3">
                        Info
                    </TabsTrigger>
                    <TabsTrigger value="media" className="rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white font-bold uppercase text-xs tracking-widest px-0 pb-3">
                        Media ({media.length})
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-transparent data-[state=active]:shadow-none text-white/40 data-[state=active]:text-white font-bold uppercase text-xs tracking-widest px-0 pb-3">
                        Journey
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="px-5 py-6 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                            <Info className="h-3 w-3" /> Identity
                        </h3>
                        <div className="glass rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-white/30" />
                                <div>
                                    <span className="block text-xs text-white/30 uppercase font-bold">Age</span>
                                    <span className="text-white font-medium">{profile.age || 'Unknown'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Briefcase className="h-4 w-4 text-white/30" />
                                <div>
                                    <span className="block text-xs text-white/30 uppercase font-bold">Occupation</span>
                                    <span className="text-white font-medium">{profile.job || 'Unknown'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-white/30" />
                                <div>
                                    <span className="block text-xs text-white/30 uppercase font-bold">Location</span>
                                    <span className="text-white font-medium">{profile.location || 'Unknown'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Heart className="h-4 w-4 text-pink-400/50" />
                                <div>
                                    <span className="block text-xs text-white/30 uppercase font-bold">Intent</span>
                                    <span className="text-pink-300 italic font-medium">{profile.intent || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 flex items-center gap-2">
                                <Shield className="h-3 w-3" /> Context Notes
                            </h3>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2">
                                        Edit
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-[#1e293b] border-white/10 top-[20%] translate-y-0">
                                    <DialogHeader>
                                        <DialogTitle className="text-white">Edit Notes</DialogTitle>
                                        <DialogDescription className="text-white/40">
                                            Update context notes for this contact.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Textarea
                                            defaultValue={contact.notes || ''}
                                            placeholder="Add context notes here..."
                                            className="min-h-[150px] bg-black/20 border-white/10 text-white placeholder:text-white/20 resize-none focus-visible:ring-blue-500"
                                            id="context-notes-edit"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            onClick={async (e) => {
                                                const btn = e.currentTarget;
                                                const originalText = btn.innerText;
                                                btn.innerText = 'Saving...';
                                                btn.disabled = true;

                                                try {
                                                    const val = (document.getElementById('context-notes-edit') as HTMLTextAreaElement).value;
                                                    const res = await fetch(`/api/contacts/${contact.id}`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ notes: val })
                                                    });
                                                    if (!res.ok) throw new Error();
                                                    window.location.reload();
                                                } catch {
                                                    alert('Failed to save');
                                                    btn.innerText = originalText;
                                                    btn.disabled = false;
                                                }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto"
                                        >
                                            Save Notes
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="glass rounded-2xl p-5">
                            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                                {contact.notes || "No particular context notes added to this profile."}
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="media" className="px-1 py-4 animate-in slide-in-from-bottom-2 duration-300">
                    {media.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-white/20">
                            <p className="text-sm">No shared media</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-0.5">
                            {media.map((item, i) => (
                                <div key={i} className="aspect-square relative bg-white/5">
                                    <img
                                        src={fixMediaUrl(item.mediaUrl)}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => (e.target as HTMLImageElement).src = 'https://placehold.co/100x100/000000/FFFFFF?text=Error'}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="logs" className="px-5 py-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-6">
                        <div className="relative border-l border-white/10 pl-6 ml-2 space-y-8">
                            {contact.trustLogs?.length > 0 ? contact.trustLogs.map((log: any, i: number) => (
                                <div key={i} className="relative">
                                    <div className={cn(
                                        "absolute -left-[30px] h-3 w-3 rounded-full border-2 border-[#0f172a]",
                                        log.change > 0 ? "bg-emerald-500" : "bg-red-500"
                                    )} />
                                    <span className="text-[10px] text-white/30 font-mono block mb-1">
                                        {new Date(log.createdAt).toLocaleDateString()}
                                    </span>
                                    <p className="text-white/80 text-sm">{log.reason}</p>
                                    <span className={cn(
                                        "text-xs font-bold mt-1 block",
                                        log.change > 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {log.change > 0 ? '+' : ''}{log.change} points
                                    </span>
                                </div>
                            )) : (
                                <div className="text-white/30 text-sm italic">No interactions logged yet.</div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Sticky Bottom Action */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent z-20 pb-8 pwa-safe-area-bottom">
                <Button
                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] font-semibold text-lg"
                    onClick={() => router.push(`/workspace/${agentId}/conversations?contact=${contact.id}`)}
                >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Open Chat
                </Button>
            </div>
        </div>
    )
}
