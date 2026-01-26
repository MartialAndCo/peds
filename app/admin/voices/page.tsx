'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Trash, Settings2, Check, X, Volume2, Upload } from 'lucide-react'
import { AudioPlayer } from '@/components/ui/audio-player'

const LANGUAGES = [
    { value: 'Auto', label: 'Auto (Detect)' },
    { value: 'English', label: 'English' },
    { value: 'French', label: 'Français' },
    { value: 'Chinese', label: '中文' },
    { value: 'Japanese', label: '日本語' },
    { value: 'Korean', label: '한국어' },
    { value: 'Spanish', label: 'Español' },
    { value: 'German', label: 'Deutsch' },
]

export default function VoicesPage() {
    return (
        <div className="space-y-8 pb-24">
            <div>
                <h1 className="text-2xl font-semibold text-white">Voice Library</h1>
                <p className="text-white/40 text-sm mt-1">
                    Manage voice clones for your agents. Upload a voice sample (3-30 sec) to create a new voice.
                </p>
            </div>

            <div className="glass rounded-2xl p-6">
                <VoiceManager />
            </div>
        </div>
    )
}

function VoiceManager() {
    const [voices, setVoices] = useState<any[]>([])
    const [newName, setNewName] = useState('')
    const [newVoiceSampleUrl, setNewVoiceSampleUrl] = useState('')
    const [newGender, setNewGender] = useState('FEMALE')
    const [newLanguage, setNewLanguage] = useState('Auto')
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<any>(null)

    const fetchVoices = useCallback(() => {
        axios.get('/api/voices')
            .then(res => setVoices(Array.isArray(res.data) ? res.data : []))
            .catch(() => setVoices([]))
    }, [])

    useEffect(() => { fetchVoices() }, [fetchVoices])

    const handleFileUpload = async (file: File) => {
        setUploading(true)
        try {
            // Upload to Supabase via our proxy
            const formData = new FormData()
            formData.append('file', file)

            const res = await axios.post('/api/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            if (res.data.url) {
                setNewVoiceSampleUrl(res.data.url)
            }
        } catch (e) {
            alert('Failed to upload voice sample')
        } finally {
            setUploading(false)
        }
    }

    const handleAdd = async () => {
        if (!newName || !newVoiceSampleUrl) return
        setLoading(true)
        try {
            await axios.post('/api/voices', {
                name: newName,
                voiceSampleUrl: newVoiceSampleUrl,
                gender: newGender,
                language: newLanguage
            })
            setNewName('')
            setNewVoiceSampleUrl('')
            setNewLanguage('Auto')
            fetchVoices()
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = async () => {
        if (!editForm) return
        setLoading(true)
        try {
            await axios.patch(`/api/voices/${editForm.id}`, {
                name: editForm.name,
                voiceSampleUrl: editForm.voiceSampleUrl,
                gender: editForm.gender,
                language: editForm.language
            })
            setEditingId(null)
            setEditForm(null)
            fetchVoices()
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this voice?')) return
        await axios.delete(`/api/voices/${id}`)
        fetchVoices()
    }

    return (
        <div className="space-y-4">
            {/* Add New Voice */}
            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Voice Name</label>
                        <Input
                            placeholder="e.g. Lena Voice"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Gender</label>
                        <Select value={newGender} onValueChange={setNewGender}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Gender" />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-white/10 text-white">
                                <SelectItem value="MALE">Male (Homme)</SelectItem>
                                <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Language</label>
                        <Select value={newLanguage} onValueChange={setNewLanguage}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Language" />
                            </SelectTrigger>
                            <SelectContent className="glass-strong border-white/10 text-white">
                                {LANGUAGES.map(lang => (
                                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-medium">Voice Sample (3-30 sec audio)</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste URL or upload file..."
                            value={newVoiceSampleUrl}
                            onChange={e => setNewVoiceSampleUrl(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white flex-1"
                        />
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                            />
                            <Button type="button" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0" disabled={uploading}>
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                        </label>
                    </div>
                    {newVoiceSampleUrl && (
                        <div className="mt-2">
                            <AudioPlayer src={newVoiceSampleUrl} compact />
                        </div>
                    )}
                </div>

                <Button type="button" onClick={handleAdd} disabled={loading || !newName || !newVoiceSampleUrl} className="w-full bg-white text-black hover:bg-white/90">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Voice'}
                </Button>
            </div>

            {/* Voice List */}
            <div className="space-y-2">
                {voices.map(voice => (
                    <div key={voice.id} className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] transition-all">
                        {editingId === voice.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <Input
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        placeholder="Name"
                                    />
                                    <Select value={editForm.gender} onValueChange={(val) => setEditForm({ ...editForm, gender: val })}>
                                        <SelectTrigger className="h-8 bg-white/[0.04] border-white/[0.08] text-white text-[10px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="glass-strong border-white/10 text-white">
                                            <SelectItem value="MALE">Male</SelectItem>
                                            <SelectItem value="FEMALE">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={editForm.language || 'Auto'} onValueChange={(val) => setEditForm({ ...editForm, language: val })}>
                                        <SelectTrigger className="h-8 bg-white/[0.04] border-white/[0.08] text-white text-[10px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="glass-strong border-white/10 text-white">
                                            {LANGUAGES.map(lang => (
                                                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input
                                    value={editForm.voiceSampleUrl}
                                    onChange={e => setEditForm({ ...editForm, voiceSampleUrl: e.target.value })}
                                    className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                    placeholder="Voice Sample URL"
                                />
                                <div className="flex gap-2 justify-end pt-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => { setEditingId(null); setEditForm(null); }}
                                        className="h-8 text-[10px] text-white/40 hover:text-white"
                                    >
                                        <X className="h-3 w-3 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleUpdate}
                                        className="h-8 text-[10px] bg-white text-black hover:bg-white/90"
                                    >
                                        <Check className="h-3 w-3 mr-1" /> Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">{voice.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${voice.gender === 'MALE' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-400'}`}>
                                            {voice.gender || 'FEMALE'}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                                            {voice.language || 'Auto'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/40 truncate max-w-md">{voice.voiceSampleUrl}</div>
                                </div>

                                <div className="flex gap-1 items-center">
                                    {voice.voiceSampleUrl && (
                                        <AudioPlayer src={voice.voiceSampleUrl} compact />
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-white/40 hover:text-white"
                                        onClick={() => {
                                            setEditingId(voice.id);
                                            setEditForm({ ...voice });
                                        }}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400/60 hover:text-red-400"
                                        onClick={() => handleDelete(voice.id)}
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {voices.length === 0 && <div className="text-white/30 text-center py-4 text-sm">No voices found</div>}
            </div>

            {/* Voice Tester */}
            <div className="mt-8 pt-8 border-t border-white/[0.06]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium">TTS Playground</h3>
                    <div className="text-xs text-white/40">Generate speech with cloned voices</div>
                </div>
                <VoiceTester voices={voices} />
            </div>
        </div>
    )
}

function VoiceTester({ voices }: { voices: any[] }) {
    const [selectedVoice, setSelectedVoice] = useState('')
    const [text, setText] = useState('')
    const [language, setLanguage] = useState('Auto')
    const [skipTranscription, setSkipTranscription] = useState(false)
    const [resultAudio, setResultAudio] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')

    const [history, setHistory] = useState<any[]>([])

    const fetchHistory = useCallback(() => {
        axios.get('/api/voices/generations')
            .then(res => setHistory(Array.isArray(res.data) ? res.data : []))
            .catch(() => setHistory([]))
    }, [])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    const deleteGeneration = async (id: number) => {
        await axios.delete(`/api/voices/generations/${id}`)
        fetchHistory()
    }

    const checkStatus = async (generationId: number) => {
        try {
            const res = await axios.get(`/api/voices/generations/${generationId}`)
            if (res.data.status === 'COMPLETED') {
                setResultAudio(`/api/voices/generations/${generationId}/audio`)
                setProcessing(false)
                setStatusMessage('')
                fetchHistory()
            } else if (res.data.status === 'FAILED') {
                setProcessing(false)
                setStatusMessage('Generation Failed')
                alert('Generation Failed')
            } else {
                setStatusMessage(`Processing... (${res.data.status})`)
                setTimeout(() => checkStatus(generationId), 3000)
            }
        } catch (e) {
            setProcessing(false)
            alert('Error checking status')
        }
    }

    const generateVoice = async () => {
        if (!text || !selectedVoice) return
        setProcessing(true)
        setResultAudio(null)
        setStatusMessage('Starting TTS Job...')

        try {
            const res = await axios.post('/api/voices/upload', {
                text,
                voiceId: selectedVoice,
                language,
                skipTranscription
            })

            if (res.data.generationId) {
                setStatusMessage('Job Started. Waiting for GPU...')
                setTimeout(() => checkStatus(res.data.generationId), 2000)
            } else {
                throw new Error("Job started but no Generation ID returned.")
            }
        } catch (e: any) {
            console.error(e)
            const msg = e.response?.data?.error || 'Generation failed'
            alert(msg)
            setProcessing(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                {/* Text Input */}
                <div className="space-y-1">
                    <label className="text-xs text-white/40 uppercase">Text to Generate</label>
                    <Textarea
                        placeholder="Enter the text you want to generate as speech..."
                        value={text}
                        onChange={e => setText(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] text-white min-h-[100px]"
                    />
                </div>

                {/* Voice & Language Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-white/40">Voice</label>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger className="w-full h-10 bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Select a Voice..." />
                            </SelectTrigger>
                            <SelectContent>
                                {voices.map(v => (
                                    <SelectItem key={v.id} value={v.id.toString()}>
                                        {v.name} ({v.gender || 'FEMALE'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-white/40">Language</label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="w-full h-10 bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Language..." />
                            </SelectTrigger>
                            <SelectContent>
                                {LANGUAGES.map(lang => (
                                    <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Options */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={skipTranscription}
                            onChange={e => setSkipTranscription(e.target.checked)}
                            className="rounded border-white/20"
                        />
                        <span className="text-xs text-blue-200">
                            <strong>Fast Mode</strong> - Skip transcription (slightly lower quality, 30% faster)
                        </span>
                    </label>
                </div>

                {/* Generate Button & Result */}
                <div className="flex gap-4">
                    <Button
                        onClick={generateVoice}
                        disabled={!text || !selectedVoice || processing}
                        className="flex-1 h-12 text-sm font-medium bg-white text-black hover:bg-white/90 disabled:opacity-50"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {statusMessage || 'Processing...'}
                            </>
                        ) : (
                            <>
                                <Volume2 className="mr-2 h-4 w-4" />
                                Generate Voice
                            </>
                        )}
                    </Button>
                </div>

                {resultAudio && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="text-xs text-green-300 mb-2">Generation Complete!</div>
                        <AudioPlayer src={resultAudio} showDownload downloadName="generated_voice.wav" />
                    </div>
                )}
            </div>

            {/* History Section */}
            <div className="space-y-3">
                <h4 className="text-white font-medium text-sm">Recent Generations</h4>
                <div className="space-y-2">
                    {history.map(gen => (
                        <div key={gen.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="text-xs text-white/40">
                                    {new Date(gen.createdAt).toLocaleTimeString()}
                                </div>
                                <div className="text-sm font-medium text-white truncate">
                                    {gen.voiceModel?.name || 'Unknown Voice'}
                                </div>
                                {gen.status && gen.status !== 'COMPLETED' && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${gen.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                        gen.status === 'FAILED' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                        {gen.status}
                                    </span>
                                )}
                                {gen.inputText && (
                                    <div className="text-xs text-white/30 truncate max-w-[200px]">
                                        "{gen.inputText}"
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {gen.status === 'COMPLETED' ? (
                                    <AudioPlayer src={`/api/voices/generations/${gen.id}/audio`} compact />
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
