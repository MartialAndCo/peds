'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from 'lucide-react'

interface AgentConfigEditorProps {
    agent: any
    onClose: () => void
}

export function AgentConfigEditor({ agent, onClose }: AgentConfigEditorProps) {
    const [settings, setSettings] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Load agent specific settings (merged with defaults or just raw)
    useEffect(() => {
        // We use the agent object passed in props if it already has settings, 
        // OR we fetch fresh. Given the API includes settings, we can use props or re-fetch.
        // Let's re-fetch to be safe/clean or just map.
        if (agent.settings) {
            const map: any = {}
            agent.settings.forEach((s: any) => map[s.key] = s.value)
            setSettings(map)
            setLoading(false)
        } else {
            // Fallback fetch
            setLoading(false)
        }
    }, [agent])

    const handleSave = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/agents/${agent.id}`, {
                ...agent, // keep basic fields
                settings // send new settings map
            })
            alert('Saved successfully!')
            onClose()
            window.location.reload()
        } catch (e) {
            alert('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h2 className="text-2xl font-bold">Configure {agent.name}</h2>
                    <p className="text-muted-foreground">Override global defaults for this specific agent.</p>
                </div>
                <div className="space-x-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</Button>
                </div>
            </div>

            <Tabs defaultValue="identity" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="identity">Identity & Context</TabsTrigger>
                    <TabsTrigger value="phases">Mission Phases</TabsTrigger>
                    <TabsTrigger value="voice">Voice & Payment</TabsTrigger>
                    <TabsTrigger value="rules">Rules & Guardrails</TabsTrigger>
                </TabsList>

                {/* --- IDENTITY --- */}
                <TabsContent value="identity" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-bold text-indigo-900">Identity Template (System Prompt Start)</Label>
                            <textarea
                                className="w-full h-40 p-3 rounded-md border text-sm font-mono bg-slate-50"
                                value={settings.prompt_identity_template || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_identity_template: e.target.value })}
                                placeholder="**1. IDENTITY**\nRole: {{ROLE}}..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold text-indigo-900">Context Template</Label>
                            <textarea
                                className="w-full h-40 p-3 rounded-md border text-sm font-mono bg-slate-50"
                                value={settings.prompt_context_template || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_context_template: e.target.value })}
                                placeholder="**2. CONTEXT**\nUser: {{USER_NAME}}..."
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* --- PHASES --- */}
                <TabsContent value="phases" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 p-3 border rounded bg-green-50/30">
                            <Label className="text-green-800 font-semibold">Phase A: Connection</Label>
                            <textarea
                                className="w-full h-32 p-2 rounded border text-sm"
                                value={settings.phase_prompt_connection || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_connection: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 p-3 border rounded bg-yellow-50/30">
                            <Label className="text-yellow-800 font-semibold">Phase B: Vulnerability</Label>
                            <textarea
                                className="w-full h-32 p-2 rounded border text-sm"
                                value={settings.phase_prompt_vulnerability || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_vulnerability: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 p-3 border rounded bg-red-50/30">
                            <Label className="text-red-800 font-semibold">Phase C: Crisis</Label>
                            <textarea
                                className="w-full h-32 p-2 rounded border text-sm"
                                value={settings.phase_prompt_crisis || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_crisis: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 p-3 border rounded bg-purple-50/30">
                            <Label className="text-purple-800 font-semibold">Phase D: Money Pot</Label>
                            <textarea
                                className="w-full h-32 p-2 rounded border text-sm"
                                value={settings.phase_prompt_moneypot || ''}
                                onChange={(e) => setSettings({ ...settings, phase_prompt_moneypot: e.target.value })}
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* --- VOICE & PAYMENT --- */}
                <TabsContent value="voice" className="space-y-4 pt-4">
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Cartesia Voice ID</Label>
                                    <Input
                                        value={settings.voice_id || ''}
                                        onChange={(e) => setSettings({ ...settings, voice_id: e.target.value })}
                                        placeholder="Global Default"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>PayPal Username</Label>
                                    <Input
                                        value={settings.paypal_username || ''}
                                        onChange={(e) => setSettings({ ...settings, paypal_username: e.target.value })}
                                        placeholder="@username"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Welcome Message (First interaction)</Label>
                                <Input
                                    value={settings.welcome_message || ''}
                                    onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                                    placeholder="Leave empty to use AI generation"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- RULES --- */}
                <TabsContent value="rules" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Guardrails</Label>
                            <textarea
                                className="w-full h-40 p-3 rounded-md border text-sm"
                                value={settings.prompt_guardrails || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_guardrails: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Global Rules</Label>
                            <textarea
                                className="w-full h-40 p-3 rounded-md border text-sm"
                                value={settings.prompt_global_rules || ''}
                                onChange={(e) => setSettings({ ...settings, prompt_global_rules: e.target.value })}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
