'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  Send,
  X,
  Bot,
  Pause,
  Play,
  Loader2,
  ChevronLeft,
  FileDown,
  TrendingUp,
  AlertTriangle,
  Heart,
  MessageCircle,
  Settings,
  UserCircle,
  Clock,
  Sparkles,
  Check,
  Plus,
  ImageIcon,
  Upload,
  Film,
  Mic
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ConversationCardData } from './conversation-card'
import { AudioPlayer } from '@/components/chat/audio-player'
import { getExportData } from '@/app/actions/conversation'
import { generateDossier } from '@/lib/pdf-generator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AIModeIndicator } from '@/components/ai-mode-indicator'
import { getContactDisplayName, getContactInitial } from '@/lib/contact-display'

interface ConversationUnifiedViewProps {
  conversation: ConversationCardData
  isOpen: boolean
  onClose: () => void
  agentId: string
  embedded?: boolean
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
}

interface GalleryMediaType {
  id: string
  description?: string
}

const phaseConfig: Record<string, { label: string; color: string; icon: any; description: string }> = {
  CONNECTION: {
    label: 'Connection',
    color: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    icon: MessageCircle,
    description: 'Building initial rapport'
  },
  VULNERABILITY: {
    label: 'Vulnerability',
    color: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    icon: Heart,
    description: 'Emotional depth and trust'
  },
  CRISIS: {
    label: 'Crisis',
    color: 'text-red-400 border-red-500/20 bg-red-500/10',
    icon: AlertTriangle,
    description: 'Urgency/problem presentation'
  },
  MONEYPOT: {
    label: 'Moneypot',
    color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    icon: TrendingUp,
    description: 'Payment ready phase'
  },
}

export function ConversationUnifiedView({
  conversation: initialConversation,
  isOpen,
  onClose,
  agentId,
  embedded = false
}: ConversationUnifiedViewProps) {
  const [conversation, setConversation] = useState(initialConversation)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [regeneratedResponse, setRegeneratedResponse] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showRegeneratePreview, setShowRegeneratePreview] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationId = conversation.id
  const displayName = getContactDisplayName(conversation.contact)
  const displayInitial = getContactInitial(conversation.contact)

  // Media attachment state
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null)
  const [selectedMediaType, setSelectedMediaType] = useState<string | null>(null)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [galleryMedias, setGalleryMedias] = useState<GalleryMedia[]>([])
  const [galleryTypes, setGalleryTypes] = useState<GalleryMediaType[]>([])
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

  // Update conversation when prop changes (fixes desktop switching issue)
  useEffect(() => {
    setConversation(initialConversation)
  }, [initialConversation])

  // Load messages
  useEffect(() => {
    if (isOpen) {
      loadMessages()
      axios.post(`/api/conversations/${conversationId}/read`).catch(console.error)
    }
  }, [isOpen, conversationId])

  // Scroll to bottom on initial load (no animation), smooth scroll on new messages
  const isFirstLoad = useRef(true)
  useEffect(() => {
    if (messagesEndRef.current && !loading) {
      // Instant scroll on first load, smooth on subsequent updates
      messagesEndRef.current.scrollIntoView({ behavior: isFirstLoad.current ? 'auto' : 'smooth' })
      isFirstLoad.current = false
    }
  }, [messages, loading])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=50`)
      setMessages(res.data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }

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
      await loadMessages()
    } catch (error) {
      console.error('Failed to send:', error)
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
    const lower = media.url.toLowerCase()
    if (/\.(mp4|mov|webm|avi)/i.test(lower)) setSelectedMediaType('video')
    else setSelectedMediaType('image')
    setIsGalleryOpen(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await axios.post('/api/media/upload', formData)
      setSelectedMediaUrl(res.data.url)
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
        voiceBase64: voiceAudio,
        sender: 'admin'
      })
      setIsVoiceOpen(false)
      setVoiceText('')
      setVoiceAudio(null)
      await loadMessages()
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

  const toggleAI = async () => {
    try {
      const newState = !conversation.aiEnabled
      await axios.put(`/api/conversations/${conversationId}`, { ai_enabled: newState })
      setConversation({ ...conversation, aiEnabled: newState })
    } catch (e) {
      console.error('Error toggling AI:', e)
    }
  }

  const toggleStatus = async () => {
    try {
      const newStatus = conversation.status === 'active' ? 'paused' : 'active'
      await axios.put(`/api/conversations/${conversationId}`, { status: newStatus })
      setConversation({ ...conversation, status: newStatus })
    } catch (e) {
      console.error('Error changing status:', e)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await getExportData(conversationId)
      await generateDossier(data)
    } catch (e) {
      console.error("Export Failed", e)
    } finally {
      setExporting(false)
    }
  }

  // Regenerate AI Response
  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setShowRegeneratePreview(true)
    try {
      const res = await axios.post(`/api/conversations/${conversationId}/regenerate`, {
        messageText: "Continue the conversation naturally."
      })
      setRegeneratedResponse(res.data.response)
    } catch (e: any) {
      console.error('Regeneration failed:', e)
      alert('Failed to regenerate: ' + (e.response?.data?.error || e.message))
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleSendRegenerated = async () => {
    if (!regeneratedResponse) return
    setSending(true)
    try {
      await axios.post(`/api/conversations/${conversationId}/send`, {
        message_text: regeneratedResponse,
        sender: 'admin'
      })
      setRegeneratedResponse(null)
      setShowRegeneratePreview(false)
      await loadMessages()
    } catch (error) {
      console.error('Failed to send:', error)
    } finally {
      setSending(false)
    }
  }

  const handleDiscardRegenerated = () => {
    setRegeneratedResponse(null)
    setShowRegeneratePreview(false)
  }

  const phase = conversation.contact.agentPhase || 'CONNECTION'
  const phaseInfo = phaseConfig[phase] || phaseConfig.CONNECTION
  const PhaseIcon = phaseInfo.icon
  const trustScore = conversation.contact.trustScore || 0

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

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0f172a]/95 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 -ml-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="relative">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold border-2",
              conversation.unreadCount > 0
                ? "bg-red-500/10 border-red-500/50"
                : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10"
            )}>
              {displayInitial}
            </div>
            {conversation.status === 'paused' && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-[#0f172a]">
                <Pause className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">
              {displayName}
            </h3>
            <p className="text-xs text-white/40 font-mono truncate">
              {conversation.contact.phone_whatsapp || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AIModeIndicator />
          <Badge
            variant="outline"
            className={cn("text-xs px-2 py-0.5 hidden sm:inline-flex", phaseInfo.color)}
          >
            <PhaseIcon className="h-3 w-3 mr-1" />
            {phaseInfo.label}
          </Badge>
          {embedded && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/40 hover:text-white h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* FIXED TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-shrink-0 w-full justify-start rounded-none border-b border-white/[0.06] bg-white/[0.02] px-4 h-11">
          <TabsTrigger value="chat" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs sm:text-sm">
            <MessageCircle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Chat</span>
            {conversation.unreadCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1 py-0 rounded-full">
                {conversation.unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs sm:text-sm">
            <UserCircle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* CHAT TAB - SCROLLABLE CONTENT */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 mt-0 min-h-0 data-[state=active]:flex overflow-hidden">
          {/* Scrollable Messages Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 text-white/30">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const isMe = m.sender === 'admin'
                  const isAi = m.sender === 'ai'
                  const isContact = m.sender === 'contact'

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
                        "max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        isContact ? "bg-white/10 text-white border border-white/10" :
                          isAi ? "bg-purple-500/20 text-purple-100 border border-purple-500/30" :
                            "bg-blue-500/20 text-blue-100 border border-blue-500/30"
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-xs font-bold opacity-70 capitalize",
                            isAi ? "text-purple-300" : isMe ? "text-blue-300" : "text-white/60"
                          )}>
                            {m.sender}
                          </span>
                          <span className="text-[10px] opacity-40">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isSticker && fixedMediaUrl && (
                          <div className="mb-2 mt-1">
                            <img src={fixedMediaUrl} alt="Sticker" className="w-32 h-32 object-contain" />
                          </div>
                        )}
                        {isImage && fixedMediaUrl && (
                          <div className="mb-2 mt-1 cursor-pointer" onClick={() => setPreviewImage(fixedMediaUrl)}>
                            <img src={fixedMediaUrl} alt="Shared" className="max-w-full rounded-lg max-h-48 object-cover hover:opacity-95 transition-opacity" />
                          </div>
                        )}
                        {isVideo && fixedMediaUrl && (
                          <div className="mb-2 mt-1">
                            <video src={fixedMediaUrl} controls className="max-w-full rounded-lg max-h-48" />
                          </div>
                        )}
                        {isAudio && fixedMediaUrl && (
                          <div className="mb-2 mt-1">
                            <AudioPlayer src={fixedMediaUrl} isMe={isMe} />
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* FIXED BOTTOM - Regenerate Preview + Input */}
          <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0f172a]">
            {/* Regenerate Preview */}
            {showRegeneratePreview && (
              <div className="p-3 border-b border-white/[0.06] bg-purple-500/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Response
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscardRegenerated}
                    className="h-6 text-white/40 hover:text-white px-2"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Discard
                  </Button>
                </div>

                {isRegenerating ? (
                  <div className="flex items-center gap-2 text-white/40 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating...</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-white/5 rounded-lg p-2.5 mb-2 text-sm text-white/90 border border-white/10 max-h-28 overflow-y-auto">
                      {regeneratedResponse || 'No response generated yet.'}
                    </div>

                    {regeneratedResponse && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSendRegenerated}
                          disabled={sending}
                          size="sm"
                          className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 h-8"
                        >
                          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                          Send
                        </Button>
                        <Button
                          onClick={handleRegenerate}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white/60 hover:bg-white/5 h-8"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 pb-6 md:pb-3 space-y-2 pwa-safe-area-bottom">
              {/* Generate Button */}
              {!showRegeneratePreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/10 h-8 text-xs"
                >
                  {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                  Generate AI Response
                </Button>
              )}

              {/* Media Preview */}
              {selectedMediaUrl && (
                <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg">
                  {selectedMediaType === 'video' ? (
                    <Film className="h-10 w-10 text-blue-400 flex-shrink-0" />
                  ) : (
                    <img src={selectedMediaUrl} alt="Preview" className="h-12 w-12 rounded object-cover flex-shrink-0" />
                  )}
                  <span className="text-xs text-white/50 truncate flex-1">
                    {selectedMediaUrl.split('/').pop()?.substring(0, 30) || 'Media'}
                  </span>
                  <button
                    onClick={() => { setSelectedMediaUrl(null); setSelectedMediaType(null) }}
                    className="p-1 hover:bg-white/10 rounded-full"
                  >
                    <X className="h-4 w-4 text-white/40" />
                  </button>
                </div>
              )}
              {uploading && (
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-xs text-blue-400">Uploading...</span>
                </div>
              )}

              {/* Message Input */}
              <form onSubmit={handleSend} className="flex gap-2">
                {/* + Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="flex-shrink-0 bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white h-10 w-10 p-0"
                      disabled={uploading}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="bg-[#1e293b] border-white/10">
                    <DropdownMenuItem onClick={openGallery} className="text-white/80 focus:text-white focus:bg-white/10">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Gallery
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="text-white/80 focus:text-white focus:bg-white/10">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsVoiceOpen(true)} className="text-white/80 focus:text-white focus:bg-white/10">
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
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20 h-10 text-sm"
                />
                {!inputText.trim() && !selectedMediaUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsVoiceOpen(true)}
                    className="bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white h-10 w-10 p-0 flex-shrink-0"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !selectedMediaUrl)}
                  className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 h-10 w-10 p-0 flex-shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="flex-1 m-0 mt-0 overflow-hidden data-[state=active]:flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {/* Contact Info Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Contact Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Name</span>
                    <span className="text-white truncate ml-2">{displayName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Phone</span>
                    <span className="text-white font-mono text-xs">{conversation.contact.phone_whatsapp || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Source</span>
                    <span className="text-white capitalize">{conversation.contact.source || 'Manual'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Status</span>
                    <Badge variant="outline" className={cn(
                      conversation.contact.status === 'new'
                        ? "border-sky-500/20 text-sky-400 bg-sky-500/10"
                        : "border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
                    )}>
                      {conversation.contact.status}
                    </Badge>
                  </div>
                  {conversation.contact.lead && (
                    <div className="flex justify-between">
                      <span className="text-white/60">Lead Status</span>
                      <Badge variant="outline" className={cn(
                        conversation.contact.lead.status === 'PENDING' && "border-amber-500/20 text-amber-400 bg-amber-500/10",
                        conversation.contact.lead.status === 'IMPORTED' && "border-blue-500/20 text-blue-400 bg-blue-500/10",
                        conversation.contact.lead.status === 'CONVERTED' && "border-emerald-500/20 text-emerald-400 bg-emerald-500/10",
                        conversation.contact.lead.status === 'REJECTED' && "border-red-500/20 text-red-400 bg-red-500/10"
                      )}>
                        {conversation.contact.lead.status}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase & Trust */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Relationship Progress</h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-sm">Current Phase</span>
                      <Badge className={cn("text-xs", phaseInfo.color)}>
                        <PhaseIcon className="h-3 w-3 mr-1" />
                        {phaseInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/40">{phaseInfo.description}</p>
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-sm">Trust Score</span>
                      <span className={cn(
                        "text-lg font-bold",
                        trustScore > 70 ? "text-emerald-400" :
                          trustScore > 30 ? "text-amber-400" : "text-red-400"
                      )}>
                        {trustScore}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          trustScore > 70 ? "bg-emerald-500" :
                            trustScore > 30 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${trustScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Export */}
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={exporting}
                className="w-full border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                {exporting ? "Generating..." : "Export PDF"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="flex-1 m-0 mt-0 overflow-hidden data-[state=active]:flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {/* AI Toggle */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">AI Control</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-toggle" className="text-white font-medium text-sm">AI Response</Label>
                    <p className="text-xs text-white/40 mt-0.5">
                      {conversation.aiEnabled ? "AI responds automatically" : "Manual responses only"}
                    </p>
                  </div>
                  <Switch
                    id="ai-toggle"
                    checked={conversation.aiEnabled}
                    onCheckedChange={toggleAI}
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Conversation Status</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm block">
                      {conversation.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                    <p className="text-xs text-white/40 mt-0.5">
                      {conversation.status === 'active'
                        ? "Conversation is flowing normally"
                        : "Paused - needs your attention"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleStatus}
                    className={cn(
                      "border-white/10",
                      conversation.status === 'active'
                        ? "text-amber-400 hover:bg-amber-500/10"
                        : "text-emerald-400 hover:bg-emerald-500/10"
                    )}
                  >
                    {conversation.status === 'active' ? (
                      <><Pause className="h-4 w-4 mr-2" /> Pause</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" /> Resume</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <MessageCircle className="h-5 w-5 mx-auto mb-1 text-white/40" />
                    <span className="text-2xl font-bold text-white">{messages.length}</span>
                    <p className="text-xs text-white/40">Messages</p>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-white/40" />
                    <span className="text-2xl font-bold text-white">
                      {Math.max(1, Math.ceil((Date.now() - new Date(conversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)))}
                    </span>
                    <p className="text-xs text-white/40">Days Active</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Gallery Dialog */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-[#1e293b] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Media Gallery</DialogTitle>
          </DialogHeader>
          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap py-2">
            <button
              onClick={() => setGalleryFilter('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                galleryFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
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
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
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
                <Loader2 className="h-8 w-8 animate-spin text-white/30" />
              </div>
            ) : filteredGalleryMedias.length === 0 ? (
              <p className="text-center text-white/30 py-12">No media found</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                {filteredGalleryMedias.map(media => {
                  const isVideo = /\.(mp4|mov|webm|avi)/i.test(media.url)
                  return (
                    <button
                      key={media.id}
                      onClick={() => selectGalleryMedia(media)}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group"
                    >
                      {isVideo ? (
                        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
                          <Film className="h-8 w-8 text-white/50" />
                          <span className="text-[10px] text-white/40 mt-1">Video</span>
                        </div>
                      ) : (
                        <img
                          src={media.url}
                          alt={media.typeId}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                        {media.typeId}
                      </span>
                    </button>
                  )
                })}
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

      {/* Voice Message Dialog */}
      <Dialog open={isVoiceOpen} onOpenChange={(open) => {
        setIsVoiceOpen(open)
        if (!open) { setVoiceAudio(null); setVoiceGenerating(false) }
      }}>
        <DialogContent className="max-w-md bg-[#1e293b] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mic className="h-5 w-5" />
              Voice Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Que doit-elle dire..."
              rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm focus:outline-none focus:border-blue-500/50 resize-none text-white placeholder:text-white/30"
              disabled={voiceGenerating || voiceSending}
            />

            <Button
              onClick={handleGenerateVoice}
              disabled={!voiceText.trim() || voiceGenerating}
              className="w-full bg-white/10 hover:bg-white/20 text-white border-0"
              variant="outline"
            >
              {voiceGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
              ) : (
                "Generate Audio"
              )}
            </Button>

            {voiceAudio && (
              <div className="pt-4 space-y-4">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <AudioPlayer src={voiceAudio} isMe={true} />
                </div>
                <Button
                  onClick={handleSendVoice}
                  disabled={voiceSending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {voiceSending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Send voice message</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
