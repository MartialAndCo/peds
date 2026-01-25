'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Trash, Settings2, Check, X, Mic2 } from 'lucide-react'

export default function VoicesPage() {
    return (
        <div className="space-y-8 pb-24">
            <div>
                <h1 className="text-2xl font-semibold text-white">Voice Library</h1>
                <p className="text-white/40 text-sm mt-1">
                    Manage global RVC voice models available to all agents
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
    const [newUrl, setNewUrl] = useState('')
    const [newGender, setNewGender] = useState('FEMALE')
    const [newIndexRate, setNewIndexRate] = useState('0.75')
    const [newProtect, setNewProtect] = useState('0.33')
    const [newRmsMixRate, setNewRmsMixRate] = useState('0.25')
    const [newFilterRadius, setNewFilterRadius] = useState('3')
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState<any>(null)

    const fetchVoices = useCallback(() => {
        axios.get('/api/voices')
            .then(res => setVoices(Array.isArray(res.data) ? res.data : []))
            .catch(() => setVoices([]))
    }, [])

    useEffect(() => { fetchVoices() }, [fetchVoices])

    const handleAdd = async () => {
        if (!newName || !newUrl) return
        setLoading(true)
        try {
            await axios.post('/api/voices', {
                name: newName,
                url: newUrl,
                gender: newGender,
                indexRate: parseFloat(newIndexRate),
                protect: parseFloat(newProtect),
                rmsMixRate: parseFloat(newRmsMixRate)
            })
            setNewName('')
            setNewUrl('')
            setNewIndexRate('0.75')
            setNewProtect('0.33')
            setNewRmsMixRate('0.25')
            setNewFilterRadius('3')
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
                url: editForm.url,
                gender: editForm.gender,
                indexRate: parseFloat(editForm.indexRate),
                protect: parseFloat(editForm.protect),
                rmsMixRate: parseFloat(editForm.rmsMixRate),
                filterRadius: parseInt(editForm.filterRadius)
            })
            setEditingId(null)
            setEditForm(null)
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
            <div className="space-y-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Model Name</label>
                        <Input
                            placeholder="e.g. Homer"
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
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-medium">HuggingFace Zip URL</label>
                    <Input
                        placeholder="https://huggingface.co/..."
                        value={newUrl}
                        onChange={e => setNewUrl(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                </div>

                <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Index Rate</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newIndexRate}
                            onChange={e => setNewIndexRate(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Protect</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newProtect}
                            onChange={e => setNewProtect(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">RMS Mix</label>
                        <Input
                            type="number"
                            step="0.05"
                            value={newRmsMixRate}
                            onChange={e => setNewRmsMixRate(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-white/40 uppercase font-medium">Filter Radius</label>
                        <Input
                            type="number"
                            step="1"
                            value={newFilterRadius}
                            onChange={e => setNewFilterRadius(e.target.value)}
                            className="bg-white/[0.04] border-white/[0.08] text-white"
                        />
                    </div>
                </div>

                <Button type="button" onClick={handleAdd} disabled={loading} className="w-full bg-white text-black hover:bg-white/90">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Voice to Library'}
                </Button>
            </div>

            <div className="space-y-2">
                {voices.map(voice => (
                    <div key={voice.id} className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.06] transition-all">
                        {editingId === voice.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
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
                                </div>
                                <Input
                                    value={editForm.url}
                                    onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                    className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                    placeholder="URL"
                                />
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">Index</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.indexRate}
                                            onChange={e => setEditForm({ ...editForm, indexRate: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">Protect</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.protect}
                                            onChange={e => setEditForm({ ...editForm, protect: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">RMS Mix</label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={editForm.rmsMixRate}
                                            onChange={e => setEditForm({ ...editForm, rmsMixRate: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-white/40 uppercase">Radius</label>
                                        <Input
                                            type="number"
                                            step="1"
                                            value={editForm.filterRadius || 3}
                                            onChange={e => setEditForm({ ...editForm, filterRadius: e.target.value })}
                                            className="bg-white/[0.04] border-white/[0.08] text-white h-8 text-xs"
                                        />
                                    </div>
                                </div>
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
                                        <div className="flex gap-2 ml-2">
                                            <span className="text-[10px] text-white/30">Index: {Number(voice.indexRate).toFixed(2)}</span>
                                            <span className="text-[10px] text-white/30">Prot: {Number(voice.protect).toFixed(2)}</span>
                                            <span className="text-[10px] text-white/30">RMS: {Number(voice.rmsMixRate).toFixed(2)}</span>
                                            <span className="text-[10px] text-white/30">Rad: {Number(voice.filterRadius || 3).toFixed(0)}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-white/40 truncate max-w-md">{voice.url}</div>
                                </div>

                                <div className="flex gap-1">
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
        axios.get('/api/voices/generations')
            .then(res => setHistory(Array.isArray(res.data) ? res.data : []))
            .catch(() => setHistory([]))
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
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                            <SelectTrigger className="w-full h-10 bg-white/[0.04] border-white/[0.08] text-white">
                                <SelectValue placeholder="Select a Voice Model..." />
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
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-blue-200">
                            <strong>Custom RVC Settings:</strong> Pitch is auto-calculated, but Index/Protect/RMS are now pulled from the voice model settings.
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">I am:</span>
                            <Select value={sourceGender} onValueChange={setSourceGender}>
                                <SelectTrigger className="h-8 bg-black/20 text-white text-xs border-white/10 w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass-strong border-white/10 text-white">
                                    <SelectItem value="MALE">Male (Homme)</SelectItem>
                                    <SelectItem value="FEMALE">Female (Femme)</SelectItem>
                                </SelectContent>
                            </Select>
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
        </div >
    )
}
