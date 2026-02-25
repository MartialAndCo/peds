'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, MessageSquare, DollarSign, Clock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getContactDisplayName } from '@/lib/contact-display'

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
                    subtitle="Building Trust"
                    color="yellow"
                    contacts={phases['VULNERABILITY']}
                />
                <PhaseColumn
                    title="Phase 3: Crisis"
                    subtitle="Story Activation"
                    color="orange"
                    contacts={phases['CRISIS']}
                />
                <PhaseColumn
                    title="Phase 4: Moneypot"
                    subtitle="Monetization"
                    color="emerald"
                    contacts={phases['MONEYPOT']}
                />
            </div>
        </div>
    )
}

function PhaseColumn({ title, subtitle, color, contacts }: { title: string, subtitle: string, color: string, contacts: any[] }) {
    const colors: Record<string, string> = {
        blue: 'border-blue-500/30 bg-blue-500/5',
        yellow: 'border-yellow-500/30 bg-yellow-500/5',
        orange: 'border-orange-500/30 bg-orange-500/5',
        emerald: 'border-emerald-500/30 bg-emerald-500/5',
    }

    return (
        <div className={cn("w-80 flex-shrink-0 border rounded-xl flex flex-col h-full", colors[color])}>
            <div className="p-4 border-b border-white/5">
                <h3 className="font-bold text-white">{title}</h3>
                <p className="text-xs text-white/40">{subtitle}</p>
                <div className="mt-2 text-xs text-white/60">
                    {contacts.length} contacts
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {contacts.map((contact: any) => (
                    <ContactCard key={contact.id} contact={contact} color={color} />
                ))}
            </div>
        </div>
    )
}

function ContactCard({ contact, color }: any) {
    const { agentId } = useParams()
    const router = useRouter()

    // Safety checks for logic verification
    const profile = contact.profile || {}
    const paid = contact.payments?.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) || 0

    // Calculate days active roughly
    const daysActive = Math.ceil((new Date().getTime() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    const displayName = getContactDisplayName(contact, contact.phone_whatsapp || "Unknown")

    return (
        <div
            onClick={() => router.push(`/workspace/${agentId}/conversations?contact=${contact.id}`)}
            className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-white/10 active:scale-[0.98]"
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                        {displayName}
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

            {/* 🔥 SIGNALS - Remplace Trust Score obsolète */}
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-white/30 uppercase tracking-wider">
                    <span>Signals</span>
                    <span className="text-white/60">{contact.signals?.length || 0} active</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                    {contact.signals && contact.signals.length > 0 ? (
                        contact.signals.slice(0, 4).map((signal: string) => {
                            const emoji = SIGNAL_EMOJIS[signal] || '●'
                            return (
                                <span key={signal} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-white/70">
                                    {emoji}
                                </span>
                            )
                        })
                    ) : (
                        <span className="text-[9px] text-white/20 italic">No signals yet</span>
                    )}
                    {contact.signals?.length > 4 && (
                        <span className="text-[9px] text-white/40">+{contact.signals.length - 4}</span>
                    )}
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

// 🔥 Emojis pour les signaux
const SIGNAL_EMOJIS: Record<string, string> = {
    RESPONSIVE: '🔵',
    EMOTIONALLY_OPEN: '💛',
    PROACTIVE: '🟣',
    COMPLIANT: '✅',
    DEFENSIVE: '🔴',
    INTERESTED: '🟢',
    ATTACHED: '🩷',
    FINANCIAL_TRUST: '💰'
}
