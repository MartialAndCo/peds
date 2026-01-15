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
                <BlacklistManager agentId={parseInt(agentId)} />
            </div>
        </div>
    )
}

function BlacklistManager({ agentId }: { agentId: number }) {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')
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

    const addRule = async (type: 'image' | 'video') => {
        if (!newItem.trim()) return
        setLoading(true)
        try {
            await axios.post('/api/blacklist', {
                term: newItem,
                mediaType: type,
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

    const photoRules = rules.filter(r => r.mediaType === 'image' || r.mediaType === 'all')
    const videoRules = rules.filter(r => r.mediaType === 'video' || r.mediaType === 'all')

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="Forbidden term (e.g. nudity, face)"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                />
                <Button
                    type="button"
                    disabled={loading}
                    onClick={() => addRule('image')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 whitespace-nowrap"
                >
                    + Photo Rule
                </Button>
                <Button
                    type="button"
                    disabled={loading}
                    onClick={() => addRule('video')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 whitespace-nowrap"
                >
                    + Video Rule
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm flex items-center justify-between">
                        Blocked for Photos
                        <span className="bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded-full">{photoRules.length}</span>
                    </h4>
                    <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {photoRules.length === 0 && (
                            <p className="text-white/30 text-xs italic">No rules defined</p>
                        )}
                        {photoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg group">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-white/20 hover:text-red-400 transition-colors"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm flex items-center justify-between">
                        Blocked for Videos
                        <span className="bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded-full">{videoRules.length}</span>
                    </h4>
                    <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {videoRules.length === 0 && (
                            <p className="text-white/30 text-xs italic">No rules defined</p>
                        )}
                        {videoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg group">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-white/20 hover:text-red-400 transition-colors"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}
