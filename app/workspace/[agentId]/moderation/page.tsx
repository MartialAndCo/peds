'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function ModerationPage() {
    const params = useParams()
    const agentId = typeof params?.agentId === 'string' ? params.agentId : ''

    return (
        <div className="space-y-8 pb-24">
            <div>
                <h1 className="text-2xl font-semibold text-white">Safety & Moderation</h1>
                <p className="text-white/40 text-sm mt-1">
                    Define content boundaries and refusal rules for this agent.
                </p>
            </div>

            <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">Blacklist Rules</h3>
                        <p className="text-white/40 text-xs">Blocked terms will trigger automatic refusal</p>
                    </div>
                </div>
                <BlacklistManager agentId={agentId} />
            </div>
        </div>
    )
}

function BlacklistManager({ agentId }: { agentId: string }) {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')
    const [selectedPhase, setSelectedPhase] = useState('all')
    const [loading, setLoading] = useState(false)

    const fetchRules = useCallback(() => {
        if (!agentId) return
        axios.get(`/api/blacklist?agentId=${agentId}`).then(res => {
            setRules(res.data)
        }).catch(() => { })
    }, [agentId])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    const addRule = async () => {
        if (!newItem.trim()) return
        setLoading(true)
        try {
            await axios.post('/api/blacklist', {
                term: newItem,
                mediaType: 'all',
                phase: selectedPhase,
                agentId
            })
            setNewItem('')
            fetchRules()
        } finally {
            setLoading(false)
        }
    }

    const deleteRule = async (id: number) => {
        await axios.delete(`/api/blacklist/${id}`)
        fetchRules()
    }

    const phases = ['all', 'CONNECTION', 'VULNERABILITY', 'CRISIS', 'MONEYPOT']

    // Filter rules for current view
    const currentRules = rules.filter(r => r.phase === selectedPhase)

    return (
        <div className="space-y-6">
            {/* Phase Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                {phases.map(p => (
                    <button
                        key={p}
                        onClick={() => setSelectedPhase(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPhase === p
                            ? 'bg-red-500 text-white'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        {p === 'all' ? 'GLOBAL' : p}
                        <span className="ml-2 opacity-50 text-[10px]">
                            {rules.filter(r => r.phase === p).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Add Rule Input */}
            <div className="flex gap-2">
                <Input
                    placeholder={`Block term for ${selectedPhase === 'all' ? 'GLOBAL' : selectedPhase} phase...`}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRule()}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                />
                <Button
                    type="button"
                    disabled={loading}
                    onClick={addRule}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 whitespace-nowrap"
                >
                    + Block Term
                </Button>
            </div>

            {/* Rules List */}
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 min-h-[300px]">
                <h4 className="font-medium text-red-400 mb-4 text-sm flex items-center justify-between">
                    Blacklist for {selectedPhase === 'all' ? 'GLOBAL (All Phases)' : selectedPhase}
                    <span className="bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded-full">{currentRules.length}</span>
                </h4>

                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentRules.length === 0 && (
                        <p className="col-span-full text-center text-white/30 text-sm italic py-10">
                            No forbidden terms defined for this phase.
                        </p>
                    )}
                    {currentRules.map(rule => (
                        <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-3 rounded-lg group border border-transparent hover:border-red-500/20 transition-colors">
                            <span className="text-white/90 font-medium">{rule.term}</span>
                            <button
                                type="button"
                                onClick={() => deleteRule(rule.id)}
                                className="h-6 w-6 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="text-xs text-white/30 italic">
                * Global rules apply to ALL phases. Specific phase rules apply IN ADDITION to global rules.
            </div>
        </div>
    )
}
