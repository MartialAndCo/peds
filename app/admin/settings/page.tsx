'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Brain, Shield, Server, Trash } from 'lucide-react'

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
        mem0_api_key: ''
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('infrastructure')

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put('/api/settings', settings)
        } catch (error) {
            console.error('Error saving settings')
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
        { id: 'intelligence', label: 'Intelligence', icon: Brain },
        { id: 'moderation', label: 'Moderation', icon: Shield },
        { id: 'voices', label: 'Voices', icon: Brain }, // Using Brain icon as placeholder or Speech if available
    ]

    return (
        <div className="space-y-8 pb-24">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-white">Settings</h1>
                <p className="text-white/40 text-sm mt-1">
                    Configure system-wide settings
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

                        {/* RVC / RunPod Serverless */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Voice Synthesis (RVC / RunPod)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        RVC / RunPod URL
                                    </label>
                                    <Input
                                        value={settings.rvc_api_url || ''}
                                        onChange={(e) => setSettings({ ...settings, rvc_api_url: e.target.value })}
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
                                <div className="space-y-2">
                                    <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                        Native Pitch (f0)
                                    </label>
                                    <Input
                                        value={settings.rvc_f0_up_key || '0'}
                                        onChange={(e) => setSettings({ ...settings, rvc_f0_up_key: e.target.value })}
                                        placeholder="0"
                                        type="number"
                                        className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                    />
                                    <p className="text-white/30 text-xs">Default pitch shift logic</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Intelligence Tab */}
                {activeTab === 'intelligence' && (
                    <div className="space-y-6">
                        {/* AI Provider Selection */}
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">AI Provider</h3>
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                {['venice', 'anthropic', 'openrouter'].map((provider) => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => setSettings({ ...settings, ai_provider: provider })}
                                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${settings.ai_provider === provider
                                            ? 'bg-white text-black border-white'
                                            : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:bg-white/[0.08]'
                                            }`}
                                    >
                                        {provider === 'venice' ? 'Venice AI' :
                                            provider === 'anthropic' ? 'Anthropic' : 'OpenRouter'}
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
                                {settings.ai_provider === 'anthropic' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Anthropic API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.anthropic_api_key}
                                                onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.anthropic_model}
                                                onChange={(e) => setSettings({ ...settings, anthropic_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
                                {settings.ai_provider === 'openrouter' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                OpenRouter API Key
                                            </label>
                                            <Input
                                                type="password"
                                                value={settings.openrouter_api_key}
                                                onChange={(e) => setSettings({ ...settings, openrouter_api_key: e.target.value })}
                                                placeholder="••••••••"
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-white/60 text-xs font-medium uppercase tracking-wider">
                                                Model
                                            </label>
                                            <Input
                                                value={settings.openrouter_model}
                                                onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })}
                                                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                                            />
                                        </div>
                                    </>
                                )}
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

                {/* Moderation Tab */}
                {activeTab === 'moderation' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-white font-medium mb-4">Content Blacklist</h3>
                            <BlacklistManager />
                        </div>
                    </div>
                )}

                {/* Voices Tab */}
                {activeTab === 'voices' && (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-medium">Voice Library (RVC)</h3>
                                <div className="text-xs text-white/40">Manage global voice models available to agents</div>
                            </div>
                            <VoiceManager />
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f172a]/90 backdrop-blur-xl border-t border-white/[0.06] z-50">
                    <div className="max-w-4xl mx-auto md:pl-64">
                        {/* Save only applies to global settings, Voices/Blacklist are auto-saved via API calls in components */}
                        <Button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-white text-black hover:bg-white/90"
                        >
                            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}

function BlacklistManager() {
    const [rules, setRules] = useState<any[]>([])
    const [newItem, setNewItem] = useState('')

    const fetchRules = useCallback(() => {
        axios.get('/api/blacklist').then(res => {
            setRules(res.data)
        }).catch(() => { })
    }, [])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    const addRule = async (type: 'image' | 'video') => {
        if (!newItem.trim()) return
        await axios.post('/api/blacklist', { term: newItem, mediaType: type })
        setNewItem('')
        fetchRules()
    }

    const deleteRule = async (id: number) => {
        await axios.delete(`/api/blacklist/${id}`)
        fetchRules()
    }

    const photoRules = rules.filter(r => r.mediaType === 'image' || r.mediaType === 'all')
    const videoRules = rules.filter(r => r.mediaType === 'video' || r.mediaType === 'all')

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Forbidden term (e.g. nudity, face)"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
                />
                <Button
                    type="button"
                    onClick={() => addRule('image')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                >
                    + Photo
                </Button>
                <Button
                    type="button"
                    onClick={() => addRule('video')}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                >
                    + Video
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm">Blocked for Photos</h4>
                    <ul className="space-y-2">
                        {photoRules.length === 0 && (
                            <p className="text-white/30 text-sm">No rules</p>
                        )}
                        {photoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-red-400 hover:text-red-300 text-lg"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                    <h4 className="font-medium text-red-400 mb-3 text-sm">Blocked for Videos</h4>
                    <ul className="space-y-2">
                        {videoRules.length === 0 && (
                            <p className="text-white/30 text-sm">No rules</p>
                        )}
                        {videoRules.map(rule => (
                            <li key={rule.id} className="flex justify-between items-center text-sm bg-white/[0.04] p-2 rounded-lg">
                                <span className="text-white/80">{rule.term}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteRule(rule.id)}
                                    className="text-red-400 hover:text-red-300 text-lg"
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

function VoiceManager() {
    const [voices, setVoices] = useState<any[]>([])
    const [newName, setNewName] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [newGender, setNewGender] = useState('FEMALE')
    const [loading, setLoading] = useState(false)

    const fetchVoices = useCallback(() => {
        axios.get('/api/voices').then(res => setVoices(res.data)).catch(() => { })
    }, [])

    useEffect(() => { fetchVoices() }, [fetchVoices])

    const handleAdd = async () => {
        if (!newName || !newUrl) return
        setLoading(true)
        try {
            await axios.post('/api/voices', { name: newName, url: newUrl, gender: newGender })
            setNewName('')
            setNewUrl('')
            fetchVoices()
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Start deletion?')) return
        await axios.delete(`/api/voices/${id}`)
        fetchVoices()
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                    placeholder="Model Name (e.g. Homer)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="bg-white/[0.04] border-white/[0.08] text-white"
                />
                <div className="flex gap-2">
                    <select
                        value={newGender}
                        onChange={e => setNewGender(e.target.value)}
                        className="h-10 px-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-xs focus:outline-none"
                    >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                    </select>
                    <Input
                        placeholder="HuggingFace Zip URL"
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] text-white flex-1"
                    />
                    <Button type="button" onClick={handleAdd} disabled={loading} className="bg-white text-black">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {voices.map(voice => (
                    <div key={voice.id} className="flex justify-between items-center p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{voice.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${voice.gender === 'MALE' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-400'}`}>
                                    {voice.gender || 'FEMALE'}
                                </span>
                            </div>
                            <div className="text-xs text-white/40 truncate max-w-md">{voice.url}</div>
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleDelete(voice.id)}
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                {voices.length === 0 && <div className="text-white/30 text-center py-4 text-sm">No voices found</div>}
            </div>

            <div className="mt-8 pt-8 border-t border-white/[0.06]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium">Voice Playground</h3>
                    <div className="text-xs text-white/40">Test and preview voice models</div>
                </div>
                <VoiceTester voices={voices} />
            </div>
        </div >
    )
}

function VoiceTester({ voices }: { voices: any[] }) {
    const [selectedVoice, setSelectedVoice] = useState('')
    const [sourceGender, setSourceGender] = useState('MALE')
    const [recording, setRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
    const [resultAudio, setResultAudio] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream)
            const chunks: BlobPart[] = []

            recorder.ondataavailable = (e) => chunks.push(e.data)
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' })
                setAudioBlob(blob)
                setResultAudio(null)
            }

            recorder.start()
            setMediaRecorder(recorder)
            setRecording(true)
        } catch (e) {
            alert('Microphone access denied')
        }
    }

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop()
            setRecording(false)
            mediaRecorder.stream.getTracks().forEach(t => t.stop()) // Stop stream
        }
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAudioBlob(e.target.files[0])
            setResultAudio(null)
        }
    }

    const [history, setHistory] = useState<any[]>([])

    const fetchHistory = useCallback(() => {
        axios.get('/api/voices/generations').then(res => setHistory(res.data)).catch(() => { })
    }, [])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    const deleteGeneration = async (id: number) => {
        await axios.delete(`/api/voices/generations/${id}`)
        fetchHistory()
    }

    const [statusMessage, setStatusMessage] = useState('')

    const checkStatus = async (generationId: number) => {
        try {
            const res = await axios.get(`/api/voices/generations/${generationId}`)
            if (res.data.status === 'COMPLETED') {
                setResultAudio(res.data.audioUrl)
                setProcessing(false)
                setStatusMessage('')
                fetchHistory()
            } else if (res.data.status === 'FAILED') {
                setProcessing(false)
                setStatusMessage('Conversion Failed')
                alert('Conversion Failed')
            } else {
                // Still pending
                setStatusMessage(`Processing... (${res.data.status})`)
                setTimeout(() => checkStatus(generationId), 3000)
            }
        } catch (e) {
            setProcessing(false)
            alert('Error checking status')
        }
    }

    const processAudio = async () => {
        if (!audioBlob || !selectedVoice) return
        setProcessing(true)
        setResultAudio(null)
        setStatusMessage('Reading Audio...')

        try {
            const reader = new FileReader()
            reader.readAsDataURL(audioBlob)
            reader.onloadend = async () => {
                const base64 = reader.result as string
                // Split base64 content only (remove data:audio... prefix for calculation, but keeping it for reassembly might be safer server side? 
                // Our API expects partial chunks. Let's send raw base64 string including header, server reassembles string.

                const CHUNK_SIZE = 1024 * 1024 // 1MB chunks
                const totalLength = base64.length
                const totalChunks = Math.ceil(totalLength / CHUNK_SIZE)
                // Generate a random Upload ID
                const uploadId = Math.random().toString(36).substring(7) + Date.now().toString()

                setStatusMessage(`Uploading Chunk 1/${totalChunks}...`)

                let finalResponse = null;

                for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE
                    const end = Math.min(start + CHUNK_SIZE, totalLength)
                    const chunk = base64.substring(start, end)

                    setStatusMessage(`Uploading Chunk ${i + 1}/${totalChunks}...`)

                    const res = await axios.post('/api/voices/upload', {
                        uploadId,
                        index: i,
                        total: totalChunks,
                        chunk,
                        voiceId: selectedVoice,
                        sourceGender
                    })

                    if (res.data.generationId) {
                        finalResponse = res.data
                    }
                }

                if (finalResponse?.generationId) {
                    setStatusMessage('Job Started. Waiting for GPU...')
                    setTimeout(() => checkStatus(finalResponse.generationId), 2000)
                } else {
                    throw new Error("Upload completed but no Job ID returned.")
                }
            }
        } catch (e: any) {
            console.error(e)
            const msg = e.response?.data?.error || 'Conversion or Upload failed'
            alert(msg)
            setProcessing(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-white/40 mb-1 block">Voice Model (Target)</label>
                        <select
                            className="w-full h-10 px-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none"
                            value={selectedVoice}
                            onChange={e => setSelectedVoice(e.target.value)}
                        >
                            <option value="">Select a Voice Model...</option>
                            {voices.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.gender || 'FEMALE'})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-blue-200">
                            <strong>Smart RVC Rule:</strong> Pitch/Index will be auto-calculated based on your gender and target voice.
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">I am:</span>
                            <select
                                className="h-8 px-2 rounded bg-black/20 text-white text-xs border border-white/10 focus:outline-none"
                                value={sourceGender}
                                onChange={e => setSourceGender(e.target.value)}
                            >
                                <option value="MALE">Male (Homme)</option>
                                <option value="FEMALE">Female (Femme)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-black/20 border border-white/[0.04] flex flex-col items-center justify-center gap-2 h-32">
                        <div className="text-xs font-medium text-white/40 uppercase">Input Source</div>
                        {recording ? (
                            <Button type="button" variant="destructive" onClick={stopRecording} className="animate-pulse">
                                Stop Recording
                            </Button>
                        ) : (
                            <div className="flex flex-col items-center gap-2 w-full">
                                <Button type="button" variant="secondary" onClick={startRecording} className="w-full bg-white/10 hover:bg-white/20 text-white border-0">
                                    🎤 Record
                                </Button>
                                <span className="text-xs text-white/20">- OR -</span>
                                <Input type="file" accept="audio/*" onChange={handleFile} className="bg-transparent border-0 text-white/60 text-xs file:bg-white/10 file:text-white file:border-0 file:rounded-md" />
                            </div>
                        )}
                        {audioBlob && !recording && <span className="text-xs text-green-400">Audio Ready ({Math.round(audioBlob.size / 1024)} KB)</span>}
                    </div>

                    <div className="p-4 rounded-lg bg-black/20 border border-white/[0.04] flex flex-col items-center justify-center gap-2 h-32 relative">
                        <div className="text-xs font-medium text-white/40 uppercase">Output</div>
                        {processing ? (
                            <div className="flex flex-col items-center gap-2 text-white/50">
                                <Loader2 className="animate-spin h-6 w-6" />
                                <span className="text-xs">Processing... (this may take 10-20s)</span>
                            </div>
                        ) : resultAudio ? (
                            <div className="w-full flex flex-col items-center gap-2">
                                <audio controls src={resultAudio} className="w-full h-8" />
                                <a href={resultAudio} download="test_voice.mp3" className="text-xs text-blue-400 hover:underline">Download</a>
                            </div>
                        ) : (
                            <span className="text-xs text-white/20">Ready to convert</span>
                        )}

                        <Button
                            onClick={processAudio}
                            disabled={!audioBlob || !selectedVoice || processing}
                            className="w-full h-12 text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {statusMessage || 'Processing (may take ~60s for cold start)...'}
                                </>
                            ) : (
                                'Generate Voice (RVC)'
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="space-y-3">
                <h4 className="text-white font-medium text-sm">Past Generations (Polling Enabled)</h4>
                <div className="space-y-2">
                    {history.map(gen => (
                        <div key={gen.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="text-xs text-white/40">
                                    {new Date(gen.createdAt).toLocaleTimeString()}
                                </div>
                                <div className="text-sm font-medium text-white">
                                    {gen.voiceModel?.name || 'Unknown Voice'}
                                    {gen.status && gen.status !== 'COMPLETED' && (
                                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${gen.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                            gen.status === 'FAILED' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                            {gen.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {gen.status === 'COMPLETED' ? (
                                    <audio controls src={`/api/voices/generations/${gen.id}/audio`} className="h-6 w-32" />
                                ) : (
                                    <span className="text-xs text-white/20">Processing...</span>
                                )}

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6 w-6 p-0"
                                    onClick={() => deleteGeneration(gen.id)}
                                >
                                    <Trash className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-white/20 text-xs text-center py-4">No history yet</div>
                    )}
                </div>
            </div>
        </div>
    )
}
