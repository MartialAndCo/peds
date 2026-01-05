'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'

export default function AgentIdentityPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [settings, setSettings] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const res = await axios.get('/api/agents')
                const found = res.data.find((a: any) => a.id.toString() === agentId)
                if (found) {
                    setAgent(found)
                    const map: any = {}
                    if (found.settings) {
                        found.settings.forEach((s: any) => map[s.key] = s.value)
                    }
                    setSettings(map)
                }
            } catch (e) { console.error(e) } finally { setLoading(false) }
        }
        fetchAgent()
    }, [agentId])

    const handleSave = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/agents/${agent.id}`, {
                ...agent,
                settings
            })
            alert('Identity Updated')
        } catch (e) {
            alert('Error saving')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-6 w-6 text-white/40" /></div>
    if (!agent) return <div className="text-white">Agent not found</div>

    const textareaClass = "w-full p-3 rounded-xl border border-white/[0.08] text-sm font-mono bg-white/[0.04] text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none transition-all resize-none"

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Identity & Mind</h1>
                    <p className="text-white/40 text-sm mt-1">Define who {agent.name} is and how they behave.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            {/* SECTION 1: CORE IDENTITY */}
            <div className="glass rounded-2xl p-6 border-l-4 border-l-indigo-500">
                <h2 className="text-white font-medium mb-1">Core Identity</h2>
                <p className="text-white/40 text-sm mb-6">The fundamental persona and system instructions.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-indigo-400 text-sm font-medium">1. Identity Template</label>
                        <p className="text-white/30 text-xs">Who is the agent? (Role, Age, Style)</p>
                        <textarea
                            className={`${textareaClass} h-48`}
                            value={settings.prompt_identity_template || ''}
                            onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })}
                            placeholder="**IDENTITY**\nRole: You are Lena..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-indigo-400 text-sm font-medium">2. Context Template</label>
                        <p className="text-white/30 text-xs">How does the agent perceive the user?</p>
                        <textarea
                            className={`${textareaClass} h-48`}
                            value={settings.prompt_context_template || ''}
                            onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })}
                            placeholder="**CONTEXT**\nUser: {{USER_NAME}}..."
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 2: MISSION PHASES */}
            <div className="glass rounded-2xl p-6 border-l-4 border-l-amber-500">
                <h2 className="text-white font-medium mb-1">Mission Phases</h2>
                <p className="text-white/40 text-sm mb-6">How the agent's goal evolves over time.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-emerald-400 text-sm font-medium">Phase A: Connection</label>
                        <textarea
                            className={`${textareaClass} h-32`}
                            value={settings.phase_prompt_connection || ''}
                            onChange={(e) => setSettings({ ...settings, phase_prompt_connection: e.target.value })}
                            placeholder="Goal: Build trust..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-amber-400 text-sm font-medium">Phase B: Vulnerability</label>
                        <textarea
                            className={`${textareaClass} h-32`}
                            value={settings.phase_prompt_vulnerability || ''}
                            onChange={(e) => setSettings({ ...settings, phase_prompt_vulnerability: e.target.value })}
                            placeholder="Goal: Share secrets..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-red-400 text-sm font-medium">Phase C: Crisis</label>
                        <textarea
                            className={`${textareaClass} h-32`}
                            value={settings.phase_prompt_crisis || ''}
                            onChange={(e) => setSettings({ ...settings, phase_prompt_crisis: e.target.value })}
                            placeholder="Goal: Create urgency..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-purple-400 text-sm font-medium">Phase D: Money Pot</label>
                        <textarea
                            className={`${textareaClass} h-32`}
                            value={settings.phase_prompt_moneypot || ''}
                            onChange={(e) => setSettings({ ...settings, phase_prompt_moneypot: e.target.value })}
                            placeholder="Goal: Closing..."
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 3: RULES */}
            <div className="glass rounded-2xl p-6 border-l-4 border-l-slate-500">
                <h2 className="text-white font-medium mb-1">Guardrails & Rules</h2>
                <p className="text-white/40 text-sm mb-6">Hard constraints for the AI.</p>

                <div className="space-y-2">
                    <label className="text-white/60 text-sm font-medium">Global Rules</label>
                    <textarea
                        className={`${textareaClass} h-32`}
                        value={settings.prompt_global_rules || ''}
                        onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })}
                        placeholder="Never say you are an AI..."
                    />
                </div>
            </div>
        </div>
    )
}

