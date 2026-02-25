'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Send, Bot, User, Pause, Play, Loader2, Plus, ImageIcon, Upload, X, Film, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioPlayer } from '@/components/chat/audio-player'
import { getExportData } from '@/app/actions/conversation'
import { generateDossier } from '@/lib/pdf-generator'
import { FileDown, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getContactDisplayName } from '@/lib/contact-display'

interface ConversationViewProps {
    conversationId: number
    initialData: any
}

interface Message {
    id: number
    sender: string
    message_text: string
    mediaUrl?: string | null
    timestamp: string
}

interface GalleryMedia {
    id: number
    url: string
    typeId: string
    type?: { id: string; description?: string }
    context?: string
    sentTo?: string[]
}

interface MediaType {
    id: string
    description?: string
}

export function ConversationView({ conversationId, initialData }: ConversationViewProps) {
    const [conversation, setConversation] = useState(initialData)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState('')
    const [sending, setSending] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [oldestId, setOldestId] = useState<number | null>(null)
    const [initialLoad, setInitialLoad] = useState(true)
    const [exporting, setExporting] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const prevScrollHeight = useRef<number>(0)
    const oldestIdRef = useRef<number | null>(null)
    const hasMoreRef = useRef<boolean>(true)
    const loadingMoreRef = useRef<boolean>(false)

    // Media attachment state
    const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null)
    const [selectedMediaType, setSelectedMediaType] = useState<string | null>(null)
    const [isGalleryOpen, setIsGalleryOpen] = useState(false)
    const [galleryMedias, setGalleryMedias] = useState<GalleryMedia[]>([])
    const [galleryTypes, setGalleryTypes] = useState<MediaType[]>([])
    const [galleryFilter, setGalleryFilter] = useState<string>('all')
    const [galleryLoading, setGalleryLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Voice message state
    const [isVoiceOpen, setIsVoiceOpen] = useState(false)
    const [voiceText, setVoiceText] = useState('')
    const [voiceAudio, setVoiceAudio] = useState<string | null>(null)
    const [voiceGenerating, setVoiceGenerating] = useState(false)
    const [voiceSending, setVoiceSending] = useState(false)

    const displayName = getContactDisplayName(conversation?.contact)

    // Keep refs in sync with state
    useEffect(() => { oldestIdRef.current = oldestId }, [oldestId])
    useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
    useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])

    // Helper to fix base64 URLs that were stored without proper data URI prefix
    const fixMediaUrl = (url: string | null | undefined): string | null => {
        if (!url) return null

        // Fix raw base64 data that was stored without proper data URI prefix
        if (url.startsWith('/9j/')) {
            return `data:image/jpeg;base64,${url}`
        }
        if (url.startsWith('iVBOR')) {
            return `data:image/png;base64,${url}`
        }
        if (url.startsWith('R0lGOD')) {
            return `data:image/gif;base64,${url}`
        }
        if (url.startsWith('UklGR')) {
            return `data:image/webp;base64,${url}`
        }
        return url
    }

    // Normalize recipient identifiers to compare sentTo entries reliably
    // across legacy formats (+33..., 33...@c.us, @s.whatsapp.net, DISCORD_...).
    const normalizeRecipient = (value?: string | null): string => {
        if (!value) return ''
        const raw = String(value).trim()
        if (!raw) return ''

        if (/^DISCORD_/i.test(raw) || /@discord/i.test(raw)) {
            return `discord:${raw.replace(/^DISCORD_/i, '').replace(/@discord/i, '').toLowerCase()}`
        }

        const local = raw.split('@')[0] || raw
        let digits = local.replace(/\D/g, '')
        if (!digits) return raw.toLowerCase()
        if (local.startsWith('00') && digits.length > 2) {
            digits = digits.slice(2)
        }
        return `wa:${digits}`
    }

    // Initial load - get latest messages
    useEffect(() => {
        loadInitialMessages()
    }, [conversationId])

    // Poll for new messages (only newest ones)
    useEffect(() => {
        const interval = setInterval(pollNewMessages, 3000)
        return () => clearInterval(interval)
    }, [conversationId, messages])

    // Scroll to bottom on initial load
    useEffect(() => {
        if (initialLoad && messages.length > 0 && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            setInitialLoad(false)
        }
    }, [messages, initialLoad])

    const loadInitialMessages = async () => {
        try {
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=50`)
            setMessages(res.data.messages || [])
            setHasMore(res.data.hasMore)
            setOldestId(res.data.oldestId)

            // Also refresh conversation status
            const convRes = await axios.get(`/api/conversations/${conversationId}`)
            setConversation(convRes.data)
        } catch (error) {
            console.error('Initial load error', error)
        }
    }

    const pollNewMessages = async () => {
        if (messages.length === 0) return

        try {
            // Get latest messages and merge any new ones
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=20`)
            const newMessages = res.data.messages || []

            // Find messages that are newer than our newest
            const newestId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) : 0
            const trulyNew = newMessages.filter((m: Message) => m.id > newestId)

            if (trulyNew.length > 0) {
                setMessages(prev => [...prev, ...trulyNew])
                // Auto-scroll to bottom for new messages if already near bottom
                if (scrollRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
                    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
                    if (isNearBottom) {
                        setTimeout(() => {
                            scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight
                        }, 50)
                    }
                }
            }

            // Also refresh conversation status
            const convRes = await axios.get(`/api/conversations/${conversationId}`)
            setConversation(convRes.data)
        } catch (error) {
            console.error('Polling error', error)
        }
    }

    const loadOlderMessages = useCallback(async () => {
        const currentHasMore = hasMoreRef.current
        const currentLoadingMore = loadingMoreRef.current
        const currentOldestId = oldestIdRef.current

        console.log('[LoadOlder] Called with hasMore:', currentHasMore, 'loadingMore:', currentLoadingMore, 'oldestId:', currentOldestId)
        if (!currentHasMore || currentLoadingMore || !currentOldestId) {
            console.log('[LoadOlder] Blocked - conditions not met')
            return
        }

        setLoadingMore(true)
        prevScrollHeight.current = scrollRef.current?.scrollHeight || 0
        console.log('[LoadOlder] Fetching messages before id:', currentOldestId)

        try {
            const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=30&before=${currentOldestId}`)
            const olderMessages = res.data.messages || []
            console.log('[LoadOlder] Received', olderMessages.length, 'messages, hasMore:', res.data.hasMore)

            if (olderMessages.length > 0) {
                setMessages(prev => [...olderMessages, ...prev])
                setHasMore(res.data.hasMore)
                setOldestId(res.data.oldestId)

                // Maintain scroll position after prepending
                setTimeout(() => {
                    if (scrollRef.current) {
                        const newScrollHeight = scrollRef.current.scrollHeight
                        scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight.current
                        console.log('[LoadOlder] Scroll position maintained')
                    }
                }, 10)
            } else {
                console.log('[LoadOlder] No more messages')
                setHasMore(false)
            }
        } catch (error) {
            console.error('[LoadOlder] Error:', error)
        } finally {
            setLoadingMore(false)
        }
    }, [conversationId])

    // Handle scroll to detect when user scrolls near top
    const handleScroll = useCallback(() => {
        if (!scrollRef.current || loadingMoreRef.current || !hasMoreRef.current) return

        const scrollTop = scrollRef.current.scrollTop
        console.log('[Scroll Debug] scrollTop:', scrollTop, 'hasMore:', hasMoreRef.current, 'loadingMore:', loadingMoreRef.current, 'oldestId:', oldestIdRef.current)

        if (scrollTop < 50) {
            console.log('[Scroll Debug] Triggering loadOlderMessages')
            loadOlderMessages()
        }
    }, [loadOlderMessages])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputText.trim() && !selectedMediaUrl) return

        setSending(true)
        try {
            await axios.post(`/api/conversations/${conversationId}/send`, {
                message_text: inputText || '',
                sender: 'admin',
                mediaUrl: selectedMediaUrl || undefined,
                mediaType: selectedMediaType || undefined
            })
            setInputText('')
            setSelectedMediaUrl(null)
            setSelectedMediaType(null)
            pollNewMessages()
        } catch (error) {
            console.error(error)
            alert('Failed to send')
        } finally {
            setSending(false)
        }
    }

    // Gallery
    const openGallery = async () => {
        setIsGalleryOpen(true)
        setGalleryLoading(true)
        try {
            const res = await axios.get('/api/media')
            setGalleryMedias(res.data.medias || [])
            setGalleryTypes(res.data.types || [])
        } catch (e) {
            console.error('Failed to load gallery', e)
        } finally {
            setGalleryLoading(false)
        }
    }

    const selectGalleryMedia = (media: GalleryMedia) => {
        setSelectedMediaUrl(media.url)
        // Detect type from URL
        const lower = media.url.toLowerCase()
        if (/\.(mp4|mov|webm|avi)/i.test(lower)) setSelectedMediaType('video')
        else setSelectedMediaType('image')
        setIsGalleryOpen(false)
    }

    // File upload from device
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await axios.post('/api/media/upload', formData)
            setSelectedMediaUrl(res.data.url)
            // Detect type
            if (file.type.startsWith('image/')) setSelectedMediaType('image')
            else if (file.type.startsWith('video/')) setSelectedMediaType('video')
            else setSelectedMediaType('file')
        } catch (err) {
            console.error('Upload failed', err)
            alert('Upload failed')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    // Voice message handlers
    const handleGenerateVoice = async () => {
        if (!voiceText.trim()) return
        setVoiceGenerating(true)
        setVoiceAudio(null)
        try {
            const res = await axios.post(`/api/conversations/${conversationId}/voice-preview`, {
                text: voiceText
            })
            setVoiceAudio(res.data.audioBase64)
        } catch (error: any) {
            console.error('Voice generation failed', error)
            alert(`Voice generation failed: ${error.response?.data?.error || error.message}`)
        } finally {
            setVoiceGenerating(false)
        }
    }

    const handleSendVoice = async () => {
        if (!voiceAudio) return
        setVoiceSending(true)
        try {
            await axios.post(`/api/conversations/${conversationId}/send`, {
                message_text: voiceText,
                voiceBase64: voiceAudio
            })
            setIsVoiceOpen(false)
            setVoiceText('')
            setVoiceAudio(null)
            pollNewMessages()
        } catch (error) {
            console.error('Voice send failed', error)
            alert('Failed to send voice message')
        } finally {
            setVoiceSending(false)
        }
    }

    const filteredGalleryMedias = galleryFilter === 'all'
        ? galleryMedias
        : galleryMedias.filter(m => m.typeId === galleryFilter)
    const galleryTargetPhone = conversation?.contact?.phone_whatsapp || ''
    const normalizedGalleryTarget = normalizeRecipient(galleryTargetPhone)

    const toggleAI = async () => {
        try {
            const newState = !conversation.ai_enabled
            await axios.put(`/api/conversations/${conversationId}`, { ai_enabled: newState })
            setConversation({ ...conversation, ai_enabled: newState })
        } catch (e) {
            alert('Error toggling AI')
        }
    }

    const toggleStatus = async () => {
        try {
            const newStatus = conversation.status === 'active' ? 'paused' : 'active'
            await axios.put(`/api/conversations/${conversationId}`, { status: newStatus })
            setConversation({ ...conversation, status: newStatus })
        } catch (e) {
            alert('Error changing status')
        }
    }

    const toggleFastMode = async () => {
        try {
            const newTestMode = !conversation.contact.testMode
            await axios.put(`/api/contacts/${conversation.contact.id}`, { testMode: newTestMode })
            setConversation({
                ...conversation,
                contact: { ...conversation.contact, testMode: newTestMode }
            })
        } catch (e) {
            alert('Error toggling Fast Mode')
        }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await getExportData(conversationId)
            await generateDossier(data)
        } catch (e) {
            console.error("Export Failed", e)
            alert("Export Failed: " + String(e))
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full max-h-full">
            {/* Chat Area (Left/Middle) */}
            <Card className="md:flex-[2] flex flex-col h-full min-h-0">
                <CardHeader className="flex flex-row items-center justify-between py-3 border-b">
                    <CardTitle className="text-lg flex items-center">
                        <User className="mr-2 h-5 w-5" />
                        {displayName} ({conversation.contact.phone_whatsapp || 'N/A'})
                    </CardTitle>
                    <div className="flex gap-2">
                        <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                            {conversation.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0 overflow-hidden relative">
                    <div
                        className="h-full overflow-y-auto p-4 space-y-4"
                        ref={scrollRef}
                        onScroll={handleScroll}
                    >
                        {/* Loading indicator at top */}
                        {loadingMore && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                        )}

                        {/* "Load more" button */}
                        {hasMore && !loadingMore && messages.length > 0 && (
                            <button
                                onClick={loadOlderMessages}
                                className="w-full text-center text-xs text-blue-500 hover:text-blue-600 py-2 cursor-pointer hover:bg-blue-50 rounded transition-colors"
                            >
                                ↑ Click to load older messages
                            </button>
                        )}

                        {!hasMore && messages.length > 0 && (
                            <div className="text-center text-xs text-gray-400 py-2">
                                — Beginning of conversation —
                            </div>
                        )}

                        {messages.length === 0 && !loadingMore && (
                            <p className="text-center text-gray-400">No messages yet</p>
                        )}

                        {messages.map((m) => {
                            const isMe = m.sender === 'admin'
                            const isAi = m.sender === 'ai'
                            const isContact = m.sender === 'contact'

                            // Media Detection
                            const fixedMediaUrl = fixMediaUrl(m.mediaUrl)
                            const isVideo = fixedMediaUrl && (fixedMediaUrl.startsWith('data:video') || /\.(mp4|mov|avi|webm|mkv)(\?|#|$)/i.test(fixedMediaUrl))
                            const isAudio = fixedMediaUrl && (fixedMediaUrl.startsWith('data:audio') || /\.(mp3|wav|ogg|m4a|opus)(\?|#|$)/i.test(fixedMediaUrl))
                            const isSticker = fixedMediaUrl && /\.(webp)(\?|#|$)/i.test(fixedMediaUrl)
                            const isImage = fixedMediaUrl && !isVideo && !isAudio && !isSticker && (
                                fixedMediaUrl.startsWith('data:image') ||
                                /\.(jpeg|jpg|gif|png)(\?|#|$)/i.test(fixedMediaUrl) ||
                                fixedMediaUrl.startsWith('/9j/') ||
                                fixedMediaUrl.startsWith('iVBOR') ||
                                fixedMediaUrl.startsWith('http')
                            )

                            return (
                                <div key={m.id} className={cn("flex w-full",
                                    isContact ? "justify-start" : "justify-end"
                                )}>
                                    <div className={cn(
                                        "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                                        isContact ? "bg-gray-200 text-black" :
                                            isAi ? "bg-blue-100 text-blue-900 border border-blue-200" :
                                                "bg-green-600 text-white"
                                    )}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold opacity-70 capitalize">{m.sender}</span>
                                            <span className="text-[10px] opacity-50">{new Date(m.timestamp).toLocaleTimeString()}</span>
                                        </div>

                                        {/* Media Rendering */}
                                        {isSticker && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <img src={fixedMediaUrl} alt="Sticker" className="w-32 h-32 object-contain" />
                                            </div>
                                        )}
                                        {isImage && fixedMediaUrl && (
                                            <div className="mb-2 mt-1 cursor-pointer" onClick={() => setPreviewImage(fixedMediaUrl)}>
                                                <img src={fixedMediaUrl} alt="Shared Media" className="max-w-full rounded-md max-h-64 object-cover hover:opacity-95 transition-opacity" />
                                            </div>
                                        )}
                                        {isVideo && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <video src={fixedMediaUrl} controls className="max-w-full rounded-md max-h-64" />
                                            </div>
                                        )}
                                        {isAudio && fixedMediaUrl && (
                                            <div className="mb-2 mt-1">
                                                <AudioPlayer src={fixedMediaUrl} isMe={isMe} />
                                            </div>
                                        )}

                                        <p className="whitespace-pre-wrap">{m.message_text}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter className="p-3 border-t">
                    {/* Media Preview */}
                    {selectedMediaUrl && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 rounded-lg w-full">
                            {selectedMediaType === 'video' ? (
                                <Film className="h-10 w-10 text-blue-500 flex-shrink-0" />
                            ) : (
                                <img src={selectedMediaUrl} alt="Preview" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                            )}
                            <span className="text-xs text-gray-500 truncate flex-1">
                                {selectedMediaUrl.split('/').pop()?.substring(0, 30) || 'Media'}
                            </span>
                            <button
                                onClick={() => { setSelectedMediaUrl(null); setSelectedMediaType(null) }}
                                className="p-1 hover:bg-gray-200 rounded-full"
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </button>
                        </div>
                    )}
                    {uploading && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-lg w-full">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-xs text-blue-600">Uploading...</span>
                        </div>
                    )}
                    <form onSubmit={handleSend} className="flex gap-2 w-full">
                        {/* + Button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="flex-shrink-0" disabled={uploading}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="top">
                                <DropdownMenuItem onClick={openGallery}>
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Gallery
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsVoiceOpen(true)}>
                                    <Mic className="h-4 w-4 mr-2" />
                                    Voice
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={selectedMediaUrl ? 'Add a caption...' : 'Type a message...'}
                            disabled={sending}
                        />
                        <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => setIsVoiceOpen(true)} title="Voice message">
                            <Mic className="h-4 w-4" />
                        </Button>
                        <Button type="submit" disabled={sending || (!inputText.trim() && !selectedMediaUrl)}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Controls Area (Right) */}
            <div className="md:flex-[1] space-y-4 h-full overflow-y-auto min-h-0">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleExport}
                            disabled={exporting}
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                            {exporting ? "Generating PDF..." : "Export Dossier PDF"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="ai-toggle">AI Response</Label>
                            <Switch id="ai-toggle" checked={conversation.ai_enabled} onCheckedChange={toggleAI} />
                        </div>
                        <p className="text-xs text-gray-500">
                            {conversation.ai_enabled ? "AI is responding automatically." : "AI is disabled. Reply manually."}
                        </p>

                        <div className="border-t pt-4 flex items-center justify-between">
                            <Label>Status</Label>
                            <Button size="sm" variant="outline" onClick={toggleStatus}>
                                {conversation.status === 'active' ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                                {conversation.status === 'active' ? 'Pause' : 'Resume'}
                            </Button>
                        </div>

                        <div className="border-t pt-4 flex items-center justify-between">
                            <div>
                                <Label htmlFor="fast-mode-toggle">⚡ Fast Mode</Label>
                                <p className="text-xs text-gray-500 mt-1">
                                    {conversation.contact.testMode ? "Réponses en 3-8s" : "Timing naturel"}
                                </p>
                            </div>
                            <Switch
                                id="fast-mode-toggle"
                                checked={conversation.contact.testMode || false}
                                onCheckedChange={toggleFastMode}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Agent State</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <span className="font-semibold block mb-1">Trust Score:</span>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-lg font-bold",
                                    (conversation.contact.trustScore || 0) < 50 ? "text-red-500" : "text-green-500"
                                )}>
                                    {conversation.contact.trustScore || 0}
                                </span>
                                <span className="text-xs text-muted-foreground">/ 100</span>
                            </div>
                        </div>
                        <div>
                            <span className="font-semibold block mb-1">Phase:</span>
                            <Badge variant="outline" className={cn(
                                conversation.contact.agentPhase === 'CRISIS' ? "border-red-500 text-red-500" :
                                    conversation.contact.agentPhase === 'VULNERABILITY' ? "border-yellow-500 text-yellow-600" :
                                        "border-blue-500 text-blue-500"
                            )}>
                                {conversation.contact.agentPhase || 'CONNECTION'}
                            </Badge>
                        </div>
                        <div>
                            <span className="font-semibold block">Days Active:</span>
                            {Math.ceil(Math.abs(new Date().getTime() - new Date(conversation.contact.createdAt).getTime()) / (1000 * 60 * 60 * 24))} Days
                        </div>
                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">Temperature:</span>
                                <span className="font-mono">{conversation.prompt.temperature}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <span className="font-semibold block">Prompt:</span>
                            {conversation.prompt.name}
                        </div>
                        <div>
                            <span className="font-semibold block">Model:</span>
                            {conversation.prompt.model}
                        </div>
                        <div>
                            <span className="font-semibold block">Source:</span>
                            {conversation.contact.source || '-'}
                        </div>
                        <div>
                            <span className="font-semibold block">Notes:</span>
                            <p className="text-gray-500 italic">{conversation.contact.notes || 'No notes'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Gallery Dialog */}
            <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Media Gallery</DialogTitle>
                    </DialogHeader>
                    {/* Type Filter */}
                    <div className="flex gap-2 flex-wrap py-2">
                        <button
                            onClick={() => setGalleryFilter('all')}
                            className={cn(
                                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                galleryFilter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            )}
                        >
                            All
                        </button>
                        {galleryTypes.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setGalleryFilter(t.id)}
                                className={cn(
                                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                                    galleryFilter === t.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                            >
                                {t.description || t.id}
                            </button>
                        ))}
                    </div>
                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto">
                        {galleryLoading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                        ) : filteredGalleryMedias.length === 0 ? (
                            <p className="text-center text-gray-400 py-12">No media found</p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                                {filteredGalleryMedias.map(media => {
                                    const isVideo = /\.(mp4|mov|webm|avi)/i.test(media.url)
                                    const isAlreadySent = Boolean(
                                        normalizedGalleryTarget &&
                                        Array.isArray(media.sentTo) &&
                                        media.sentTo.some((recipient) => normalizeRecipient(recipient) === normalizedGalleryTarget)
                                    )
                                    return (
                                        <button
                                            key={media.id}
                                            onClick={() => selectGalleryMedia(media)}
                                            className={cn(
                                                "relative aspect-square rounded-lg overflow-hidden border-2 transition-colors group",
                                                isAlreadySent
                                                    ? "border-gray-200 opacity-45 grayscale hover:border-blue-500 cursor-pointer"
                                                    : "border-transparent hover:border-blue-500"
                                            )}
                                        >
                                            {isVideo ? (
                                                <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
                                                    <Film className="h-8 w-8 text-white/70" />
                                                    <span className="text-[10px] text-white/50 mt-1">Video</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={media.url}
                                                    alt={media.typeId}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            )}
                                            <div className={cn(
                                                "absolute inset-0 transition-colors",
                                                isAlreadySent ? "bg-black/15" : "bg-black/0 group-hover:bg-black/20"
                                            )} />
                                            <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                                                {media.typeId}
                                            </span>
                                            {isAlreadySent && (
                                                <span className="absolute top-1 right-1 text-[9px] bg-gray-900/80 text-gray-200 px-1.5 py-0.5 rounded">
                                                    Already sent
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Voice Message Dialog */}
            <Dialog open={isVoiceOpen} onOpenChange={(open) => {
                setIsVoiceOpen(open)
                if (!open) { setVoiceAudio(null); setVoiceGenerating(false) }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mic className="h-5 w-5" />
                            Voice Message
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <textarea
                            value={voiceText}
                            onChange={(e) => setVoiceText(e.target.value)}
                            placeholder="Type what she should say..."
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            disabled={voiceGenerating || voiceSending}
                        />

                        <Button
                            onClick={handleGenerateVoice}
                            disabled={!voiceText.trim() || voiceGenerating}
                            className="w-full"
                            variant="outline"
                        >
                            {voiceGenerating ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                            ) : (
                                <><Mic className="h-4 w-4 mr-2" /> Generate Voice</>
                            )}
                        </Button>

                        {voiceAudio && (
                            <div className="space-y-3">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <audio controls src={voiceAudio} className="w-full" />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleGenerateVoice}
                                        variant="outline"
                                        className="flex-1"
                                        disabled={voiceSending}
                                    >
                                        🔄 Retry
                                    </Button>
                                    <Button
                                        onClick={handleSendVoice}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                        disabled={voiceSending}
                                    >
                                        {voiceSending ? (
                                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                                        ) : (
                                            <>✅ Send Voice</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-full max-h-full animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
