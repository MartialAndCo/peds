'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DragEvent } from 'react'

interface Contact {
    id: string
    name: string | null
    phone: string
    age: string | null
    job: string | null
    location: string | null
    trustScore: number  // DEPRECATED
    signals?: string[]  // 🔥 NOUVEAU
    daysActive: number
    phase: string
    lastMessage: string
    profile: any
    photoUrl?: string | null
}

type PipelineStage = 'Nouveau' | 'Discussion' | 'Closing' | 'Clients'

interface PipelineData {
    Nouveau: Contact[]
    Discussion: Contact[]
    Closing: Contact[]
    Clients: Contact[]
}

export default function PipelineBoard({ initialData, agentId }: { initialData: PipelineData, agentId: string }) {
    const [selected, setSelected] = useState<Contact | null>(null)
    const [data, setData] = useState(initialData)
    const [draggedItem, setDraggedItem] = useState<Contact | null>(null)
    const router = useRouter()

    const handleDragStart = (e: DragEvent<HTMLDivElement>, contact: Contact) => {
        setDraggedItem(contact)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = async (e: DragEvent<HTMLDivElement>, targetStage: keyof PipelineData) => {
        e.preventDefault()
        if (!draggedItem) return

        // Optimistic UI update
        const sourceStage = (draggedItem as any).currentStage as keyof PipelineData || 'Nouveau'
        if (sourceStage === targetStage) return

        setData(prev => ({
            ...prev,
            [sourceStage]: prev[sourceStage].filter(c => c.id !== draggedItem.id),
            [targetStage]: [...prev[targetStage], { ...draggedItem, phase: targetStage }]
        }))

        // API call to update phase
        try {
            await fetch(`/api/admin/contacts/${draggedItem.id}/phase`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase: targetStage })
            })
            router.refresh()
        } catch (err) {
            console.error('Failed to update phase:', err)
            // Rollback on error (simplified)
            setData(initialData)
        }

        setDraggedItem(null)
    }

    const stages: { key: keyof PipelineData; label: string; color: string }[] = [
        { key: 'Nouveau', label: 'Nouveau', color: 'border-blue-400 bg-blue-50' },
        { key: 'Discussion', label: 'Discussion', color: 'border-yellow-400 bg-yellow-50' },
        { key: 'Closing', label: 'Closing', color: 'border-orange-400 bg-orange-50' },
        { key: 'Clients', label: 'Clients', color: 'border-emerald-400 bg-emerald-50' },
    ]

    return (
        <div className="flex gap-4 h-[calc(100vh-200px)]">
            {stages.map(stage => (
                <div
                    key={stage.key}
                    className={`flex-1 border-2 rounded-xl ${stage.color} flex flex-col min-w-[280px]`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage.key)}
                >
                    <div className="p-4 border-b border-slate-200/50">
                        <h3 className="font-bold text-slate-700">{stage.label}</h3>
                        <p className="text-xs text-slate-500">{initialData[stage.key].length} contacts</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {initialData[stage.key].map(contact => (
                            <div
                                key={contact.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, contact)}
                                onClick={() => setSelected(contact)}
                                className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all active:scale-95"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg overflow-hidden">
                                        {contact.photoUrl ? (
                                            <img src={contact.photoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            '👤'
                                        )}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-medium text-slate-800 text-sm truncate">{contact.name || 'Inconnu'}</h4>
                                        <p className="text-xs text-slate-500 truncate">{contact.age && contact.age !== '?' ? `${contact.age} ans` : '-'} • {contact.job || '?'}</p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <span className="flex gap-1">
                                            {contact.signals?.slice(0, 3).map((s: string) => (
                                                <span key={s} className="text-[10px] bg-slate-100 px-1 rounded">{SIGNAL_EMOJIS[s] || '●'}</span>
                                            ))}
                                            {contact.signals && contact.signals.length > 3 && <span className="text-[10px]">+{contact.signals.length - 3}</span>}
                                            {(!contact.signals || contact.signals.length === 0) && <span className="text-[10px] italic">No signals</span>}
                                        </span>
                                        <span>{contact.daysActive}j</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-2 italic">
                                        "{contact.lastMessage.substring(0, 40)}..."
                                    </p>
                                </div>
                            </div>
                        ))}

                        {initialData[stage.key].length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm italic">
                                Vide
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Detail Panel */}
            <div className={`w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${selected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 w-0'}`}>
                {selected && (
                    <div className="h-full flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white">
                            <div className="flex justify-between items-start mb-4">
                                <button
                                    onClick={() => setSelected(null)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            <h2 className="text-2xl font-serif font-bold text-slate-800">{selected.name || 'Inconnu'}</h2>
                            <p className="text-slate-500">{selected.phone}</p>
                        </div>

                        <div className="space-y-6">
                            <Section title="À Propos">
                                <InfoRow label="Âge" value={selected.age} />
                                <InfoRow label="Job" value={selected.job} />
                                <InfoRow label="Ville" value={selected.location} />
                            </Section>

                            <Section title="Intelligence">
                                <div className="flex flex-wrap gap-1 mb-2">
                                    <span className="text-xs text-slate-500 mr-2">Signaux:</span>
                                    {selected.signals?.map((s: string) => (
                                        <span key={s} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                            {SIGNAL_EMOJIS[s] || '●'} {s}
                                        </span>
                                    )) || <span className="text-[10px] text-slate-400 italic">Aucun signal</span>}
                                </div>
                                <InfoRow label="Jours Actifs" value={`${selected.daysActive} jours`} />
                                <InfoRow label="Intention" value={selected.profile?.intent || 'Inconnue'} />
                            </Section>

                            <Section title="Notes IA">
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-sm text-amber-800 italic">
                                    {selected.profile?.notes || "Pas de notes particulières détectées pour l'instant."}
                                </div>
                            </Section>

                            <Section title="Dernier Message">
                                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                                    "{selected.lastMessage}"
                                </p>
                            </Section>

                            <div className="pt-6 border-t border-slate-100">
                                <button
                                    onClick={() => router.push(`/admin/profiles/${selected.id}`)}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    Voir le Profil Complet →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                {title}
                <div className="h-px bg-slate-200 flex-1"></div>
            </h3>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    )
}

function InfoRow({ label, value }: { label: string, value: any }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium text-slate-800">{value || '-'}</span>
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
