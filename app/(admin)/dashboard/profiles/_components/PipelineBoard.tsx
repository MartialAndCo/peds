'use client'

import { useState } from 'react'
import { PipelineContact, PipelineStage } from '../actions'

const STAGES: PipelineStage[] = ['Nouveau', 'Discussion', 'Closing', 'Clients']

export default function PipelineBoard({ initialData }: { initialData: Record<PipelineStage, PipelineContact[]> }) {
    const [selected, setSelected] = useState<PipelineContact | null>(null)

    return (
        <div className="flex h-full gap-6 min-w-[1000px]">
            {STAGES.map(stage => (
                <div key={stage} className="flex-1 flex flex-col min-w-[280px] bg-slate-100/50 rounded-xl border border-slate-200">
                    <div className="p-4 border-b border-slate-200/60 bg-white/50 rounded-t-xl backdrop-blur-sm sticky top-0 z-10">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-700">{stage}</h3>
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                                {initialData[stage].length}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {initialData[stage].map(contact => (
                            <div
                                key={contact.id}
                                onClick={() => setSelected(contact)}
                                className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-200"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-100">
                                        {contact.avatarUrl ? (
                                            <img src={contact.avatarUrl} alt={contact.name || '?'} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                                                {contact.name?.substring(0, 2).toUpperCase() || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="font-medium text-slate-800 text-sm truncate">{contact.name || 'Inconnu'}</h4>
                                        <p className="text-xs text-slate-500 truncate">{contact.age ? `${contact.age} ans` : '-'} • {contact.job || '?'}</p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <span>Trust: {contact.trustScore}%</span>
                                        <span>{contact.daysActive}j</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${Math.min(contact.trustScore, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-2 italic">
                                        "{contact.lastMessage.substring(0, 40)}..."
                                    </p>
                                </div>
                            </div>
                        ))}

                        {initialData[stage].length === 0 && (
                            <div className="text-center py-10 text-slate-400 text-sm italic">
                                Vide
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* DETAIL MODAL */}
            {selected && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
                    <div className="w-[400px] h-full bg-white shadow-2xl p-6 overflow-y-auto animate-slide-in-right">
                        <button
                            onClick={() => setSelected(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        >
                            ✕
                        </button>

                        <div className="flex flex-col items-center mb-8 mt-4">
                            <div className="w-24 h-24 rounded-full bg-slate-100 mb-4 overflow-hidden border-4 border-white shadow-lg">
                                {selected.avatarUrl ? (
                                    <img src={selected.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl text-slate-300">
                                        👤
                                    </div>
                                )}
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
                                <InfoRow label="Confiance" value={`${selected.trustScore}%`} />
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
                                <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-slate-500">Raw Profile Data</h3>
                                <pre className="text-xs bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto">
                                    {JSON.stringify(selected.profile, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
