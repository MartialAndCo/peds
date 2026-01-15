'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, MessageSquare, DollarSign, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PipelinePage() {
    const { agentId } = useParams()
    const router = useRouter()
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                // Fetch contacts linked to this agent
                const res = await axios.get(`/api/contacts?agentId=${agentId}`)
                setContacts(res.data)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchContacts()
    }, [])

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-white/20" /></div>

    // Group by Phase
    const phases = {
        'CONNECTION': contacts.filter(c => c.agentPhase === 'CONNECTION' || !c.agentPhase),
        'VULNERABILITY': contacts.filter(c => c.agentPhase === 'VULNERABILITY'),
        'CRISIS': contacts.filter(c => c.agentPhase === 'CRISIS'),
        'MONEYPOT': contacts.filter(c => c.agentPhase === 'MONEYPOT'),
    }

    return (
        <div className="h-[calc(100vh-100px)] overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-max px-4 h-full">
                <PhaseColumn
                    title="Phase 1: Connection"
                    subtitle="Establishing Contact"
                    color="blue"
                    contacts={phases['CONNECTION']}
                />
                <PhaseColumn
                    title="Phase 2: Vulnerability"
                    subtitle="Emotional Hook"
                    color="purple"
                    contacts={phases['VULNERABILITY']}
                />
                <PhaseColumn
                    title="Phase 3: Crisis"
                    subtitle="The Trap (Ask)"
                    color="orange"
                    contacts={phases['CRISIS']}
                />
                <PhaseColumn
                    title="Phase 4: Moneypot"
                    subtitle="Extraction Mode"
                    color="green"
                    contacts={phases['MONEYPOT']}
                />
            </div>
        </div>
    )
}

function PhaseColumn({ title, subtitle, color, contacts }: any) {
    const colorStyles: any = {
        blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
        green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    }

    const totalPotential = contacts.reduce((acc: number, c: any) => acc + (c.payments?.reduce((p: any, x: any) => p + (x.amount || 0), 0) || 0), 0)

    return (
        <div className="w-[320px] flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 backdrop-blur-sm">
            {/* Header */}
            <div className={cn("p-4 border-b border-white/5 rounded-t-2xl", colorStyles[color].replace("text-", "border-"))}>
                <div className="flex justify-between items-start mb-1">
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", colorStyles[color].split(" ")[2])}>{title}</h3>
                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-white/50">{contacts.length}</span>
                </div>
                <p className="text-[11px] text-white/40">{subtitle}</p>
                {totalPotential > 0 && (
                    <div className="mt-2 text-xs font-mono text-emerald-400 flex items-center">
                        <DollarSign className="w-3 h-3 mr-1" />
                        {totalPotential.toLocaleString()} generated
                    </div>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {contacts.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} color={color} />
                ))}
            </div>
        </div>
    )
}

function ContactCard({ contact, color }: any) {
    const router = useRouter()

    // Safety checks for logic verification
    const trustScore = contact.trustScore || 0
    const profile = contact.profile || {}
    const paid = contact.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0

    // Calculate days active roughly
    const daysActive = Math.ceil((new Date().getTime() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))

    return (
        <div
            onClick={() => router.push(`/workspace/chat?contactId=${contact.id}`)}
            className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-white/10 active:scale-[0.98]"
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                        {contact.name || contact.phone_whatsapp || "Unknown"}
                    </h4>
                    <div className="flex items-center text-[10px] text-white/40 mt-1 space-x-2">
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {daysActive}d</span>
                        {profile.age && <span>• {profile.age}yo</span>}
                        {profile.location && <span>• {profile.location}</span>}
                    </div>
                </div>
                {paid > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded">
                        ${paid}
                    </span>
                )}
            </div>

            {/* Progress / Trust */}
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-wider">
                    <span>Trust Score</span>
                    <span className={cn(
                        trustScore > 70 ? "text-green-400" : trustScore < 30 ? "text-red-400" : "text-yellow-400"
                    )}>{trustScore}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full rounded-full transition-all duration-500",
                            trustScore > 70 ? "bg-gradient-to-r from-emerald-500 to-green-400" :
                                trustScore < 30 ? "bg-gradient-to-r from-red-500 to-orange-400" :
                                    "bg-gradient-to-r from-yellow-500 to-amber-400"
                        )}
                        style={{ width: `${trustScore}%` }}
                    />
                </div>
            </div>

            {/* AI Insight / Last Log */}
            {/* If we had the latest log, we would show it. For now, profile intent */}
            {profile.intent && (
                <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-white/50 italic line-clamp-2">
                        "{profile.intent}"
                    </p>
                </div>
            )}
        </div>
    )
}
