'use client'

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Brain, Server, Check } from 'lucide-react'
import { SessionManager } from '@/components/settings/session-manager'
import { clearAllQueues } from '@/app/actions/queue'
import { Bell, BellRing, AlertTriangle, CreditCard, Volume2, ShieldAlert } from 'lucide-react'

// Types de notifications disponibles
// Component to migrate Discord leads to the configured agent
function DiscordLeadsMigration() {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [migrating, setMigrating] = useState(false)
    const { toast } = useToast()

    const checkStatus = async () => {
        setLoading(true)
        try {
            const res = await axios.get('/api/admin/migrate-discord-leads')
            setStatus(res.data)
        } catch (e: any) {
            toast({ title: "Error", description: e.response?.data?.error || 'Failed to check status', variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const migrate = async () => {
        setMigrating(true)
        try {
            const res = await axios.post('/api/admin/migrate-discord-leads')
            toast({ 
                title: "Migration Complete ✅", 
                description: res.data.message,
                className: "bg-green-600 border-none text-white"
            })
            checkStatus()
        } catch (e: any) {
            toast({ title: "Migration Failed", description: e.response?.data?.error, variant: "destructive" })
        } finally {
            setMigrating(false)
        }
    }

    return (
        <div className="mt-6 pt-6 border-t border-[#5865F2]/20">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="text-white font-medium">Discord Leads Migration</h4>
                    <p className="text-white/40 text-xs">
                        Move existing Discord leads to the configured agent
                    </p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={checkStatus}
                    disabled={loading}
                    className="border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/10"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Status'}
                </Button>
            </div>

            {status && (
                <div className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-white/60">Total Discord leads: <span className="text-white font-medium">{status.totalDiscordLeads}</span></span>
                        <span className="text-green-400">✓ Correct: {status.alreadyCorrect}</span>
                        {status.needsMigration > 0 && (
                            <span className="text-orange-400">⚠ Needs migration: {status.needsMigration}</span>
                        )}
                    </div>

                    {status.needsMigration > 0 && (
                        <Button
                            onClick={migrate}
                            disabled={migrating}
                            className="w-full bg-[#5865F2] hover:bg-[#5865F2]/80 text-white"
                        >
                            {migrating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Migrating...</>
                            ) : (
                                `Migrate ${status.needsMigration} lead${status.needsMigration > 1 ? 's' : ''} to ${status.discordAgentConfigured ? 'configured agent' : 'Discord agent'}`
                            )}
                        </Button>
                    )}

                    {status.needsMigration === 0 && status.totalDiscordLeads > 0 && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                            ✓ All Discord leads are correctly assigned
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const NOTIFICATION_TYPES = [
    { key: 'notify_payment_claim', label: 'Payment Claims', description: 'New payment claims from contacts', icon: CreditCard, default: true },
    { key: 'notify_critical_errors', label: 'Critical System Errors', description: 'WhatsApp disconnections, cron failures...', icon: AlertTriangle, default: true },
    { key: 'notify_supervisor_alerts', label: 'Supervisor AI Alerts', description: 'AI coherence, context, phase alerts', icon: ShieldAlert, default: true },
    { key: 'notify_tts_failures', label: 'TTS Voice Failures', description: 'When voice generation fails', icon: Volume2, default: true },
]

function DiscordBotList({ agents }: { agents: any[] }) {
    const [bots, setBots] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()

    const fetchBots = useCallback(() => {
        axios.get('/api/integrations/discord').then(res => {
            setBots(res.data)
            setLoading(false)
        })
    }, [])

    useEffect(() => { fetchBots() }, [fetchBots])

    const handleAssign = async (botId: string, agentId: string) => {
        try {
            await axios.put('/api/integrations/discord', { botId, agentId })
            toast({ title: "Agent Assigned 🔗", className: "bg-green-600 border-none text-white" })
            fetchBots()
        } catch (e) {
            toast({ title: "Failed to assign", variant: "destructive" })
        }
    }

    if (loading) return <Loader2 className="animate-spin h-5 w-5 text-white/40" />
    if (bots.length === 0) return (
        <div className="p-4 rounded-xl bg-white/5 border border-dashed border-white/10 text-center">
            <p className="text-white/40 text-sm">No Discord Bots detected yet.</p>
            <p className="text-white/30 text-xs mt-1">Start your Discord Service to register.</p>
        </div>
    )

    return (
        <div className="space-y-4">
            {bots.map(bot => (
                <div key={bot.id} className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${new Date(bot.lastSeen).getTime() > Date.now() - 1000 * 60 * 5 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        <div>
                            <p className="text-white font-medium">{bot.username}</p>
                            <p className="text-white/40 text-xs font-mono">ID: {bot.id}</p>
                            <p className="text-white/30 text-[10px]">
                                Last Seen: {new Date(bot.lastSeen).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>

                    <select
                        value={bot.agentId || ''}
                        onChange={(e) => handleAssign(bot.id, e.target.value)}
                        className="bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-md p-2 w-[200px] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                    >
                        <option value="" className="bg-[#0f172a] text-white/50">-- Select Agent --</option>
                        {agents.map((agent: any) => (
                            <option key={agent.id} value={agent.id} className="bg-[#0f172a]">
                                {agent.name}
                            </option>
                        ))}
                    </select>
                </div>
            ))}
        </div>
    )
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        waha_endpoint: '',
        waha_session: 'default',
        waha_api_key: '',
        venice_api_key: '',
        venice_model: 'venice-uncensored',
        anthropic_api_key: '',
        anthropic_model: 'claude-3-haiku-20240307',
        openrouter_api_key: '',
        openrouter_model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        ai_provider: 'venice',
        ai_mode: 'CLASSIC',
        groq_api_key: '',
        mem0_api_key: '',
        // AI Parameters
        ai_temperature: '0.7',
        // Log Forwarding
        log_forwarding_enabled: 'false'
    })
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('infrastructure')
    const [agents, setAgents] = useState<any[]>([])

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))

        axios.get('/api/agents').then(res => {
            setAgents(res.data)
        }).catch(e => console.error('Failed to fetch agents'))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    // Note: AI Mode est sauvegardé avec les autres settings dans handleSave
    // Pas de sync auto ici pour éviter d'écraser la valeur au chargement

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            // Sauvegarder tous les settings
            await axios.put('/api/settings', settings)
            
            // Sync AI Mode avec le serveur runtime
            if (settings.ai_mode) {
                await axios.post('/api/ai-mode', { mode: settings.ai_mode })
                toast({ 
                    title: `Mode ${settings.ai_mode} activé`, 
                    description: settings.ai_mode === 'SWARM' 
                        ? '10 agents spécialisés sont maintenant actifs' 
                        : 'Mode classique avec 1 prompt unique',
                    className: settings.ai_mode === 'SWARM' ? "bg-purple-600 border-none text-white" : "bg-blue-600 border-none text-white" 
                })
            } else {
                toast({ title: "Settings Saved ✅", className: "bg-green-600 border-none text-white" })
            }
        } catch (error) {
            console.error('Error saving settings')
            toast({ title: "Save Failed", variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-6 w-6 text-white/40" />
        </div>
    )

    const tabs = [
        { id: 'infrastructure', label: 'Infrastructure', icon: Server },
        { id: 'integrations', label: 'Integrations', icon: Check },
        { id: 'intelligence', label: 'Intelligence', icon: Brain },
        { id: 'notifications', label: 'Notifications', icon: BellRing },
        { id: 'sessions', label: 'Sessions', icon: Loader2 },
    ]

    return (
        <div className="space-y-8 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-white">System Settings</h1>
                <p className="text-white/40 text-sm mt-1">
                    Configure global infrastructure and AI providers
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-white/[0.06] pb-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white/[0.08] text-white'
                                : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
                                }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Infrastructure Tab */}
                {activeTab === 'infrastructure' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">WAHA Server (Baileys)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Endpoint URL
                                    </label>
                                    <Input
                                        value={settings.waha_endpoint}
                                        onChange={(e) => setSettings({ ...settings, waha_endpoint: e.target.value })}
                                        placeholder="http://localhost:3005"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.waha_api_key}
                                        onChange={(e) => setSettings({ ...settings, waha_api_key: e.target.value })}
                                        placeholder="••••••••"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Default Session
                                    </label>
                                    <Input
                                        value={settings.waha_session}
                                        onChange={(e) => setSettings({ ...settings, waha_session: e.target.value })}
                                        placeholder="default"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Session Management */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Session Management</h3>
                            <SessionManager settings={settings} />
                        </div>

                        {/* TTS / RunPod Serverless */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Voice Synthesis (Qwen3-TTS / RunPod)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        TTS API URL
                                    </label>
                                    <Input
                                        value={settings.tts_api_url || ''}
                                        onChange={(e) => setSettings({ ...settings, tts_api_url: e.target.value })}
                                        placeholder="https://api.runpod.ai/v2/..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        RunPod API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.runpod_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, runpod_api_key: e.target.value })}
                                        placeholder="rpa_..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Log Forwarding */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Log Forwarding (Centralized Logs)</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                    <div>
                                        <p className="text-white font-medium">Enable Log Forwarding</p>
                                        <p className="text-white/40 text-xs mt-1">
                                            Forward all Amplify logs to Baileys server for centralized logging
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({
                                            ...settings,
                                            log_forwarding_enabled: settings.log_forwarding_enabled === 'true' ? 'false' : 'true'
                                        })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.log_forwarding_enabled === 'true' ? 'bg-green-500' : 'bg-white/20'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.log_forwarding_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                {settings.log_forwarding_enabled === 'true' && (
                                    <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                                        <p className="text-green-400 text-sm flex items-center gap-2">
                                            <Check className="h-4 w-4" />
                                            Log forwarding is active. All logs will be sent to: <span className="font-mono">{settings.waha_endpoint}/api/logs/ingest</span>
                                        </p>
                                        <p className="text-white/40 text-xs mt-2">
                                            Logs are forwarded with trace IDs for correlation. Check your Baileys server logs to see the complete message flow.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Maintenance */}
                        <div className="glass rounded-2xl p-6 border border-red-500/20">
                            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                                <span className="text-red-400">⚠️</span> System Maintenance
                            </h3>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <div>
                                    <p className="text-white font-medium">Clear Message Queues</p>
                                    <p className="text-white/40 text-xs mt-1">
                                        Delete all pending messages, incoming webhooks, and flushed logs.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to clear all message queues? This action cannot be undone.')) {
                                            const res = await clearAllQueues()
                                            if (res.success) {
                                                toast({
                                                    title: "Queues Cleared 🧹",
                                                    description: `Deleted ${res.counts?.incoming} incoming, ${res.counts?.outgoing} outgoing, ${res.counts?.webhooks} logs.`,
                                                    className: "bg-emerald-500 border-none text-white",
                                                })
                                            } else {
                                                toast({
                                                    title: "Error",
                                                    description: res.error,
                                                    variant: "destructive"
                                                })
                                            }
                                        }
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white"
                                >
                                    Clear Queues
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Integrations Tab */}
                {activeTab === 'integrations' && (
                    <div className="space-y-6">
                        {/* Discord Configuration */}
                        <div className="glass rounded-2xl p-6 border border-[#5865F2]/20 bg-[#5865F2]/5">
                            <h3 className="text-[#5865F2] font-medium mb-4 flex items-center gap-2">
                                <span className="text-xl">🤖</span> Discord Integration
                            </h3>
                            <p className="text-white/60 text-sm mb-6">
                                Configure which Agent should respond to Discord messages. This allows you to have a dedicated personality for your Discord interactions.
                            </p>

                            <div className="space-y-2">
                                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                    Active Discord Agent
                                </label>
                                <select
                                    value={settings.discord_agent_id || ''}
                                    onChange={(e) => setSettings({ ...settings, discord_agent_id: e.target.value })}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] text-white rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                                >
                                    <option value="" className="bg-[#0f172a] text-white/50">-- Select an Agent --</option>
                                    {agents.map((agent: any) => (
                                        <option key={agent.id} value={agent.id} className="bg-[#0f172a]">
                                            {agent.name} ({agent.phone || 'No phone'})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-white/30 text-xs">
                                    Messages received by the Discord service will be processed by this agent.
                                </p>
                            </div>

                            {/* Discord Leads Migration */}
                            <DiscordLeadsMigration />
                        </div>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-white font-medium flex items-center gap-2">
                                        <BellRing className="h-5 w-5 text-blue-400" />
                                        Push Notifications
                                    </h3>
                                    <p className="text-white/40 text-sm mt-1">
                                        Choose which events trigger push notifications on your devices
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-white/40 text-xs">All</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allEnabled = NOTIFICATION_TYPES.every(t => settings[t.key] !== 'false')
                                            const newSettings = { ...settings }
                                            NOTIFICATION_TYPES.forEach(t => {
                                                newSettings[t.key] = allEnabled ? 'false' : 'true'
                                            })
                                            setSettings(newSettings)
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            NOTIFICATION_TYPES.every(t => settings[t.key] !== 'false') ? 'bg-green-500' : 'bg-white/20'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            NOTIFICATION_TYPES.every(t => settings[t.key] !== 'false') ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {NOTIFICATION_TYPES.map((type) => {
                                    const Icon = type.icon
                                    const isEnabled = settings[type.key] !== 'false'
                                    return (
                                        <div
                                            key={type.key}
                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                isEnabled 
                                                    ? 'bg-white/[0.04] border-white/[0.08]' 
                                                    : 'bg-white/[0.02] border-white/[0.04] opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                                    isEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/40'
                                                }`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${isEnabled ? 'text-white' : 'text-white/60'}`}>
                                                        {type.label}
                                                    </p>
                                                    <p className="text-white/40 text-xs">
                                                        {type.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSettings({
                                                    ...settings,
                                                    [type.key]: isEnabled ? 'false' : 'true'
                                                })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    isEnabled ? 'bg-green-500' : 'bg-white/20'
                                                }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                                                }`} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="glass rounded-2xl p-6 border border-blue-500/20 bg-blue-500/5">
                            <div className="flex items-start gap-3">
                                <Bell className="h-5 w-5 text-blue-400 mt-0.5" />
                                <div>
                                    <h4 className="text-white font-medium text-sm">About Push Notifications</h4>
                                    <p className="text-white/40 text-xs mt-1 leading-relaxed">
                                        Push notifications are delivered to all subscribed devices even when the PWA is closed. 
                                        You need to enable notifications on each device in the mobile app. 
                                        In-app notifications will always be shown regardless of these settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sessions Tab */}
                {activeTab === 'sessions' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Sessions Control</h3>
                            <SessionManager settings={settings} />
                        </div>

                        {/* DANGER ZONE */}
                        <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
                            <h3 className="text-red-500 font-medium mb-4 flex items-center gap-2">
                                <span className="text-xl">☢️</span> Factory Reset
                            </h3>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-red-900/10 border border-red-500/10">
                                <div>
                                    <p className="text-white font-medium">Wipe All Sessions</p>
                                    <p className="text-white/40 text-xs mt-1">
                                        Dangerous! Deletes ALL session files (creds.json) and restarts the service.
                                        You will need to rescan the QR code for all agents.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={async () => {
                                        if (confirm('🚨 ARE YOU SURE? This will disconnect EVERYONE and delete all session data. This action is irreversible.')) {
                                            setSaving(true)
                                            try {
                                                const res = await axios.post('/api/admin/action', { action: 'wipe_all' })
                                                if (res.data.success) {
                                                    toast({
                                                        title: "System Wiped 💥",
                                                        description: "All sessions deleted. Service is restarting...",
                                                        className: "bg-red-600 border-none text-white",
                                                    })
                                                } else {
                                                    toast({ title: "Error", description: res.data.message, variant: "destructive" })
                                                }
                                            } catch (e: any) {
                                                toast({ title: "Failed", description: e.message, variant: "destructive" })
                                            } finally {
                                                setSaving(false)
                                            }
                                        }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold"
                                >
                                    💣 Wipe Everything
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Intelligence Tab */}
                {activeTab === 'intelligence' && (
                    <div className="space-y-6">
                        {/* AI Mode Selection */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-white font-medium">AI Mode</h3>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    settings.ai_mode === 'SWARM' 
                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                    {settings.ai_mode === 'SWARM' ? 'SWARM ACTIF' : 'CLASSIC ACTIF'}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {/* CLASSIC Option */}
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, ai_mode: 'CLASSIC' })}
                                    className={`p-4 rounded-xl border transition-all text-left ${
                                        settings.ai_mode === 'CLASSIC'
                                            ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50'
                                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            settings.ai_mode === 'CLASSIC' ? 'border-blue-500' : 'border-white/30'
                                        }`}>
                                            {settings.ai_mode === 'CLASSIC' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                        </div>
                                        <span className={`font-medium ${settings.ai_mode === 'CLASSIC' ? 'text-blue-400' : 'text-white'}`}>
                                            CLASSIC
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs">
                                        1 prompt unique par agent. Rapide et simple.
                                    </p>
                                </button>

                                {/* SWARM Option */}
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, ai_mode: 'SWARM' })}
                                    className={`p-4 rounded-xl border transition-all text-left ${
                                        settings.ai_mode === 'SWARM'
                                            ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50'
                                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            settings.ai_mode === 'SWARM' ? 'border-purple-500' : 'border-white/30'
                                        }`}>
                                            {settings.ai_mode === 'SWARM' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                                        </div>
                                        <span className={`font-medium ${settings.ai_mode === 'SWARM' ? 'text-purple-400' : 'text-white'}`}>
                                            SWARM
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-xs">
                                        10 agents spécialisés (intention, timing, persona, style...)
                                    </p>
                                </button>
                            </div>
                            
                            {settings.ai_mode === 'SWARM' && (
                                <p className="mt-4 text-xs text-purple-400/80 flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                    Le mode SWARM est expérimental et peut être plus lent
                                </p>
                            )}
                        </div>

                        {/* AI Provider Selection */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Provider</h3>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {['venice', 'groq'].map((provider) => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, ai_provider: provider })}
                                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${settings.ai_provider === provider
                                            ? 'bg-white text-black border-white'
                                            : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08]'
                                            }`}
                                    >
                                        {provider === 'venice' ? 'Venice AI' : 'Groq'}
                                    </button>
                                ))}
                            </div>

                            {/* Provider-specific settings */}
                            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                {settings.ai_provider === 'venice' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Venice API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.venice_api_key}
                                                onChange={(e) => setSettings({ ...settings, venice_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.venice_model}
                                                onChange={(e) => setSettings({ ...settings, venice_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* AI Parameters */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Parameters</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Temperature ({settings.ai_temperature || '0.7'})
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={settings.ai_temperature || '0.7'}
                                        onChange={(e) => setSettings({ ...settings, ai_temperature: e.target.value })}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                                    />
                                    <div className="flex justify-between text-white/30 text-xs">
                                        <span>0.0 (Precise)</span>
                                        <span>1.0 (Creative)</span>
                                    </div>
                                    <p className="text-white/30 text-xs">Higher values produce more creative but less consistent responses</p>
                                </div>
                            </div>
                        </div>

                        {/* Transcription Settings */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Transcription (STT)</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Groq API Key (Whisper)
                                    </label>
                                    <Input
                                        type="password"
                                        value={settings.groq_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
                                        placeholder="gsk_..."
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                    <p className="text-white/30 text-xs">Required for Voice Note transcription (uses Whisper-large-v3)</p>
                                </div>
                            </div>
                        </div>

                        {/* Long-term Memory */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Long-Term Memory (Mem0)</h3>
                            <div className="space-y-2">
                                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                    Mem0 API Key
                                </label>
                                <Input
                                    type="password"
                                    value={settings.mem0_api_key || ''}
                                    onChange={(e) => setSettings({ ...settings, mem0_api_key: e.target.value })}
                                    placeholder="m0-..."
                                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                />
                                <p className="text-white/30 text-xs">Required for persistent memory across conversations</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.06] z-50">
                    <div className="max-w-4xl mx-auto md:pl-64">
                        <Button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-white text-black hover:bg-white/90"
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </form >
        </div >
    )
}
