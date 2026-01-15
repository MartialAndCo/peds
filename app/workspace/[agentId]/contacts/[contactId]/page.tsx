'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, MessageSquare, Save, Trash, User, MapPin, Briefcase, Heart, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export default function ContactDetailsPage() {
    const { contactId, agentId } = useParams()
    const router = useRouter()
    const [contact, setContact] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [mediaLoading, setMediaLoading] = useState(true)
    const [media, setMedia] = useState<any[]>([])

    // Data init
    useEffect(() => {
        const fetchContact = async () => {
            try {
                // Fetch basic contact details
                // Ideally this endpoints supports fetching by ID directly
                const res = await axios.get(`/api/contacts/${contactId}`)
                setContact(res.data)

                // Fetch Media (Messages with mediaUrl)
                // We'll need a way to filter messages for this contact. 
                // Currently usually done via filtering messages from Conversations.
                // Assuming we can fetch /api/contacts/[id]/media or filter messages
                const resMedia = await axios.get(`/api/contacts/${contactId}/media`)
                setMedia(resMedia.data)
            } catch (e) {
                console.error("Fetch error", e)
            } finally {
                setLoading(false)
                setMediaLoading(false)
            }
        }
        fetchContact()
    }, [contactId])

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>
    if (!contact) return <div className="p-20 text-white text-center">Contact not found</div>

    const profile = contact.profile || {}
    const phases = ['CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT']
    const currentPhaseIdx = phases.indexOf(contact.agentPhase || 'CONNECTION')

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header / Nav */}
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
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
                        {contact.name || contact.phone_whatsapp}
                    </h2>
                    <p className="text-sm text-white/40 font-mono">{contact.phone_whatsapp}</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT: Profile & Status */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="glass p-6 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <User className="h-32 w-32" />
                        </div>

                        <div className="relative z-10 space-y-6">
                            {/* Trust Score */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs uppercase tracking-widest text-white/50 font-bold">Trust Score</span>
                                    <span className="text-2xl font-bold text-white">{contact.trustScore}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-1000",
                                            contact.trustScore > 75 ? "bg-emerald-500" :
                                                contact.trustScore < 30 ? "bg-red-500" : "bg-amber-500"
                                        )}
                                        style={{ width: `${contact.trustScore}%` }}
                                    />
                                </div>
                            </div>

                            {/* Phase */}
                            <div>
                                <span className="text-xs uppercase tracking-widest text-white/50 font-bold block mb-2">Current Phase</span>
                                <div className="flex flex-col gap-2">
                                    {phases.map((phase, i) => (
                                        <div key={phase} className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-2 w-2 rounded-full",
                                                i === currentPhaseIdx ? "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" :
                                                    i < currentPhaseIdx ? "bg-white/20" : "bg-white/5"
                                            )} />
                                            <span className={cn(
                                                "text-xs font-medium uppercase tracking-wider",
                                                i === currentPhaseIdx ? "text-blue-400" :
                                                    i < currentPhaseIdx ? "text-white/30 line-through" : "text-white/10"
                                            )}>
                                                {phase}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Extracted Profile */}
                    <div className="glass p-6 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
                            <User className="h-4 w-4 text-purple-400" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Identified Profile</h3>
                        </div>

                        <div className="space-y-3">
                            <InfoRow icon={Calendar} label="Age" value={profile.age ? `${profile.age} years old` : 'Unknown'} />
                            <InfoRow icon={Briefcase} label="Job" value={profile.job || 'Unknown'} />
                            <InfoRow icon={MapPin} label="Location" value={profile.location || 'Unknown'} />
                            <InfoRow icon={Heart} label="Intent" value={profile.intent || 'Unknown'} className="text-pink-300 italic" />
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] uppercase text-white/30 tracking-wider block mb-2">AI Notes</span>
                            <p className="text-xs text-white/60 leading-relaxed">
                                {profile.notes || "No additional notes extracted yet."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* CENTER/RIGHT: Media & History */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Actions Bar */}
                    <div className="flex gap-3">
                        <Button
                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                            onClick={() => router.push(`/workspace/${agentId}/conversations?contact=${contactId}`)}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Open Chat
                        </Button>
                    </div>

                    {/* Media Gallery */}
                    <div className="glass p-6 rounded-2xl min-h-[400px]">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Shared Media</h3>

                        {media.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/5 rounded-xl">
                                <p className="text-white/20 text-sm">No media exchanged yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {media.map((item, i) => (
                                    <div key={i} className="aspect-square rounded-xl bg-black/20 overflow-hidden relative group border border-white/5 hover:border-white/20 transition-all cursor-pointer">
                                        {/* Determine if image or video based on URL or metadata - keeping simple for now */}
                                        <img
                                            src={item.mediaUrl}
                                            alt="Shared"
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[10px] text-white/70 text-right">
                                                {new Date(item.timestamp).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Transcript (Trust Log)? */}
                    <div className="glass p-6 rounded-2xl">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Progression Log (Last 5 Updates)</h3>
                        <div className="space-y-4">
                            {contact.trustLogs?.length > 0 ? contact.trustLogs.slice(0, 5).map((log: any) => (
                                <div key={log.id} className="text-xs border-l-2 border-white/10 pl-4 py-1">
                                    <div className="flex justify-between text-white/50 mb-1">
                                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                                        <span className={cn(
                                            "font-bold",
                                            log.change > 0 ? "text-emerald-400" : "text-red-400"
                                        )}>
                                            {log.change > 0 ? '+' : ''}{log.change}
                                        </span>
                                    </div>
                                    <p className="text-white/80">{log.reason}</p>
                                </div>
                            )) : (
                                <p className="text-white/30 text-xs italic">No progression logs yet.</p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value, className }: any) {
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-white/40">
                <Icon className="h-3 w-3" />
                <span>{label}</span>
            </div>
            <span className={cn("font-medium text-white", className)}>{value}</span>
        </div>
    )
}
