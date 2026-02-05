'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { 
  Send, 
  X, 
  Bot, 
  User, 
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
  BarChart3,
  Zap,
  Clock
} from 'lucide-react'
import { ConversationCardData } from './conversation-card'
import { AudioPlayer } from '@/components/chat/audio-player'
import { getExportData } from '@/app/actions/conversation'
import { generateDossier } from '@/lib/pdf-generator'

interface ConversationUnifiedViewProps {
  conversation: ConversationCardData
  isOpen: boolean
  onClose: () => void
  agentId: string
  embedded?: boolean // If true, renders without the overlay wrapper (for desktop split view)
}

interface Message {
  id: number
  sender: string
  message_text: string
  mediaUrl?: string | null
  timestamp: string
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
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevScrollHeight = useRef<number>(0)

  const conversationId = conversation.id

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=50`)
      setMessages(res.data.messages || [])
      setHasMore(res.data.hasMore)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Mark as read when opened
  useEffect(() => {
    if (isOpen) {
      loadMessages()
      // Mark conversation as read
      axios.post(`/api/conversations/${conversationId}/read`).catch(console.error)
    }
  }, [isOpen, conversationId, loadMessages])

  // Poll for new messages
  useEffect(() => {
    if (!isOpen) return
    
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=20`)
        const newMessages = res.data.messages || []
        
        // Merge new messages
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const trulyNew = newMessages.filter((m: Message) => !existingIds.has(m.id))
          if (trulyNew.length > 0) {
            return [...prev, ...trulyNew]
          }
          return prev
        })
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isOpen, conversationId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    setSending(true)
    try {
      await axios.post(`/api/conversations/${conversationId}/send`, {
        message_text: inputText,
        sender: 'admin'
      })
      setInputText('')
      // Refresh messages
      const res = await axios.get(`/api/conversations/${conversationId}/messages?limit=20`)
      setMessages(res.data.messages || [])
    } catch (error) {
      console.error('Failed to send:', error)
    } finally {
      setSending(false)
    }
  }

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
      alert("Export Failed: " + String(e))
    } finally {
      setExporting(false)
    }
  }

  const phase = conversation.contact.agentPhase || 'CONNECTION'
  const phaseInfo = phaseConfig[phase] || phaseConfig.CONNECTION
  const PhaseIcon = phaseInfo.icon
  const trustScore = conversation.contact.trustScore || 0

  const content = (
    <div className="flex flex-col h-full bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0f172a]/95 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60">
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
              {(conversation.contact.name || '?').charAt(0).toUpperCase()}
            </div>
            {conversation.status === 'paused' && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-[#0f172a]">
                <Pause className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {conversation.contact.name || 'Inconnu'}
            </h3>
            <p className="text-xs text-white/40 font-mono">
              {conversation.contact.phone_whatsapp}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn("text-xs px-2 py-0.5", phaseInfo.color)}
          >
            <PhaseIcon className="h-3 w-3 mr-1" />
            {phaseInfo.label}
          </Badge>
          {embedded && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-white/[0.06] bg-white/[0.02] px-4 h-12">
          <TabsTrigger value="chat" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat
            {conversation.unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {conversation.unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <UserCircle className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 mt-0 min-h-0 data-[state=active]:flex">
          {/* Messages */}
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            <div className="py-4 space-y-4">
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
                messages.map((m) => {
                  const isMe = m.sender === 'admin'
                  const isAi = m.sender === 'ai'
                  const isContact = m.sender === 'contact'
                  
                  const isImage = m.mediaUrl && (m.mediaUrl.startsWith('data:image') || m.mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i))
                  const isVideo = m.mediaUrl && (m.mediaUrl.startsWith('data:video') || m.mediaUrl.match(/\.(mp4|mov)$/i))
                  const isAudio = m.mediaUrl && (m.mediaUrl.startsWith('data:audio') || m.mediaUrl.match(/\.(mp3|wav|ogg)$/i))

                  return (
                    <div key={m.id} className={cn("flex w-full",
                      isContact ? "justify-start" : "justify-end"
                    )}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
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

                        {isImage && (
                          <div className="mb-2 mt-1">
                            <a href={m.mediaUrl!} target="_blank" rel="noopener noreferrer">
                              <img src={m.mediaUrl!} alt="Shared" className="max-w-full rounded-lg max-h-48 object-cover" />
                            </a>
                          </div>
                        )}
                        {isVideo && (
                          <div className="mb-2 mt-1">
                            <video src={m.mediaUrl!} controls className="max-w-full rounded-lg max-h-48" />
                          </div>
                        )}
                        {isAudio && (
                          <div className="mb-2 mt-1">
                            <AudioPlayer src={m.mediaUrl!} isMe={isMe} />
                          </div>
                        )}

                        <p className="whitespace-pre-wrap">{m.message_text}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.06] bg-[#0f172a]">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/20"
              />
              <Button 
                type="submit" 
                disabled={sending || !inputText.trim()}
                className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="flex-1 m-0 mt-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-6">
              {/* Contact Info Card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Contact Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Name</span>
                    <span className="text-white">{conversation.contact.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Phone</span>
                    <span className="text-white font-mono text-sm">{conversation.contact.phone_whatsapp}</span>
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
                </div>
              </div>

              {/* Phase & Trust */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Relationship Progress</h4>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60">Current Phase</span>
                      <Badge className={cn("text-xs", phaseInfo.color)}>
                        <PhaseIcon className="h-3 w-3 mr-1" />
                        {phaseInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/40">{phaseInfo.description}</p>
                  </div>

                  <Separator className="bg-white/[0.06]" />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60">Trust Score</span>
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
                {exporting ? "Generating PDF..." : "Export Conversation PDF"}
              </Button>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="flex-1 m-0 mt-0 overflow-hidden data-[state=active]:flex">
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-6">
              {/* AI Toggle */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">AI Control</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="ai-toggle" className="text-white font-medium">AI Response</Label>
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
                    <span className="text-white font-medium block">
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
                    <p className="text-xs text-white/40">Total Messages</p>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-lg">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-white/40" />
                    <span className="text-2xl font-bold text-white">
                      {Math.ceil((Date.now() - new Date(conversation.contact.status === 'new' ? conversation.contact.status : Date.now()).getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                    <p className="text-xs text-white/40">Days Active</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )

  // Mobile: Full screen overlay
  if (!embedded) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0f172a] animate-in slide-in-from-right duration-300">
        {content}
      </div>
    )
  }

  // Desktop: Embedded in split view
  return content
}
