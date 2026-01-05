'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'

export default function AgentIdentityPage({ params }: { params: { agentId: string } }) {
    const [agent, setAgent] = useState<any>(null)
    const [settings, setSettings] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const fetchAgent = async () => {
            try {
                const res = await axios.get('/api/agents')
                const found = res.data.find((a: any) => a.id.toString() === params.agentId)
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
    }, [params.agentId])

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

    if (loading) return <div className="p-10"><Loader2 className="animate-spin" /></div>
    if (!agent) return <div>Agent not found</div>

    return (
        <div className="max-w-4xl space-y-8 pb-20">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Identity & Mind</h1>
                    <p className="text-slate-500">Define who {agent.name} is and how they behave.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            {/* SECTION 1: CORE IDENTITY */}
            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                <CardHeader>
                    <CardTitle>Core Identity</CardTitle>
                    <CardDescription>The fundamental persona and system instructions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-bold text-indigo-900">1. Identity Template</Label>
                            <p className="text-xs text-muted-foreground">Who is the agent? (Role, Age, Style)</p>
                            <textarea
                                className="w-full h-48 p-3 rounded-md border text-sm font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={settings.prompt_identity_template || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })}
                                placeholder="**IDENTITY**\nRole: You are Lena..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-indigo-900">2. Context Template</Label>
                            <p className="text-xs text-muted-foreground">How does the agent perceive the user?</p>
                            <textarea
                                className="w-full h-48 p-3 rounded-md border text-sm font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                value={settings.prompt_context_template || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })}
                                placeholder="**CONTEXT**\nUser: {{USER_NAME}}..."
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* SECTION 2: MISSION PHASES */}
            <Card className="border-l-4 border-l-orange-500 shadow-sm">
                <CardHeader>
                    <CardTitle>Mission Phases</CardTitle>
                    <CardDescription>How the agent's goal evolves over time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-semibold text-green-700">Phase A: Connection</Label>
                            <textarea
                                className="w-full h-32 p-3 rounded border text-sm bg-white focus:border-green-500 outline-none"
                                value={settings.phase_prompt_connection || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_connection: e.target.value })}
                                placeholder="Goal: Build trust..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold text-yellow-700">Phase B: Vulnerability</Label>
                            <textarea
                                className="w-full h-32 p-3 rounded border text-sm bg-white focus:border-yellow-500 outline-none"
                                value={settings.phase_prompt_vulnerability || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_vulnerability: e.target.value })}
                                placeholder="Goal: Share secrets..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold text-red-700">Phase C: Crisis</Label>
                            <textarea
                                className="w-full h-32 p-3 rounded border text-sm bg-white focus:border-red-500 outline-none"
                                value={settings.phase_prompt_crisis || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_crisis: e.target.value })}
                                placeholder="Goal: Create urgency..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-semibold text-purple-700">Phase D: Money Pot</Label>
                            <textarea
                                className="w-full h-32 p-3 rounded border text-sm bg-white focus:border-purple-500 outline-none"
                                value={settings.phase_prompt_moneypot || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_moneypot: e.target.value })}
                                placeholder="Goal: Closing..."
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* SECTION 3: RULES */}
            <Card className="border-l-4 border-l-slate-500 shadow-sm">
                <CardHeader>
                    <CardTitle>Guardrails & Rules</CardTitle>
                    <CardDescription>Hard constraints for the AI.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <Label>Global Rules</Label>
                            <textarea
                                className="w-full h-32 p-3 rounded-md border text-sm"
                                value={settings.prompt_global_rules || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })}
                                placeholder="Never say you are an AI..."
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
