'use client'

import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  MessageCircle, 
  Bot, 
  User, 
  AlertCircle, 
  Zap,
  Clock,
  TrendingUp,
  Heart,
  AlertTriangle,
  Pause,
  Check
} from 'lucide-react'

export interface ConversationCardData {
  id: number
  contact: {
    id: string
    name: string
    phone_whatsapp: string
    status: string
    agentPhase: string | null
    trustScore: number | null
    signals?: string[]
    source?: string | null
  }
  lastMessage?: {
    message_text: string
    sender: 'contact' | 'ai' | 'admin'
    timestamp: string
  }
  unreadCount: number
  aiEnabled: boolean
  status: 'active' | 'paused' | 'closed'
  lastMessageAt: string | null
  priority?: 'high' | 'normal' | 'low'
  createdAt: string
}

interface ConversationCardProps {
  conversation: ConversationCardData
  onClick: () => void
  isSelected?: boolean
  compact?: boolean // For mobile
}

const phaseConfig: Record<string, { label: string; color: string; icon: any }> = {
  CONNECTION: { 
    label: 'Connection', 
    color: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
    icon: MessageCircle
  },
  VULNERABILITY: { 
    label: 'Vulnerability', 
    color: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    icon: Heart
  },
  CRISIS: { 
    label: 'Crisis', 
    color: 'text-red-400 border-red-500/20 bg-red-500/10',
    icon: AlertTriangle
  },
  MONEYPOT: { 
    label: 'Moneypot', 
    color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    icon: TrendingUp
  },
}

export function ConversationCard({ 
  conversation, 
  onClick, 
  isSelected = false,
  compact = false 
}: ConversationCardProps) {
  const { contact, lastMessage, unreadCount, aiEnabled, status, lastMessageAt } = conversation
  const phase = contact.agentPhase || 'CONNECTION'
  const phaseInfo = phaseConfig[phase] || phaseConfig.CONNECTION
  const PhaseIcon = phaseInfo.icon
  
  const isNewContact = contact.status === 'new'
  const needsReply = lastMessage?.sender === 'contact' && unreadCount > 0
  const isDormant = lastMessageAt && 
    new Date().getTime() - new Date(lastMessageAt).getTime() > 24 * 60 * 60 * 1000
  
  const trustScore = contact.trustScore || 0
  
  // Determine priority color for left border (desktop only)
  const getBorderColor = () => {
    if (compact) return 'border-l-transparent' // No border on mobile
    if (needsReply) return 'border-l-red-500'
    if (phase === 'MONEYPOT') return 'border-l-emerald-500'
    if (phase === 'CRISIS') return 'border-l-orange-500'
    if (isNewContact) return 'border-l-sky-500'
    return 'border-l-transparent'
  }

  if (compact) {
    // Mobile compact view - FIXED responsive
    return (
      <div
        onClick={onClick}
        className={cn(
          "group active:bg-white/[0.08] px-3 py-2.5 transition-all flex items-center gap-3 cursor-pointer rounded-lg mx-1",
          isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
          needsReply && "bg-red-500/5"
        )}
      >
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-base border-2 transition-all",
            needsReply 
              ? "bg-red-500/10 border-red-500/50 text-red-200"
              : isNewContact
                ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10 text-white"
          )}>
            {(contact.name || '?').charAt(0).toUpperCase()}
          </div>
          {/* Status dot */}
          {needsReply && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-0.5 border-2 border-[#0f172a]">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </div>
          )}
          {status === 'paused' && !needsReply && (
            <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-[#0f172a]">
              <Pause className="h-1.5 w-1.5 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex justify-between items-center mb-0.5">
            <h3 className={cn(
              "truncate text-sm",
              needsReply ? "font-bold text-white" : "font-semibold text-white/90"
            )}>
              {contact.name || 'Inconnu'}
            </h3>
            {/* Time on mobile - smaller and constrained */}
            <span className={cn(
              "text-[10px] flex-shrink-0 ml-1",
              needsReply ? "text-red-400 font-medium" : "text-white/40"
            )}>
              {lastMessageAt ? formatDistanceToNow(new Date(lastMessageAt), { addSuffix: false }) : ''}
            </span>
          </div>
          
          {/* Last message preview */}
          <div className="flex justify-between items-center">
            <p className={cn(
              "truncate text-xs leading-tight",
              needsReply ? "text-white font-medium" : "text-white/50",
              !lastMessage && "italic"
            )}>
              {lastMessage ? (
                <>
                  {lastMessage.sender === 'admin' && <span className="text-blue-400 mr-1">You:</span>}
                  {lastMessage.sender === 'ai' && <span className="text-purple-400 mr-1">AI:</span>}
                  {lastMessage.message_text}
                </>
              ) : (
                <span className="opacity-50">No messages yet</span>
              )}
            </p>
            {unreadCount > 0 && (
              <div className="h-4 min-w-[16px] rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white px-1 flex-shrink-0 ml-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </div>
          
          {/* Phase & Trust badge row - compact on mobile */}
          <div className="flex items-center gap-1.5 mt-1">
            <Badge 
              variant="outline" 
              className={cn("text-[8px] px-1 py-0 h-3.5", phaseInfo.color)}
            >
              <PhaseIcon className="h-2 w-2 mr-0.5" />
              {phaseInfo.label}
            </Badge>
            {trustScore > 0 && (
              <span className={cn(
                "text-[9px] font-medium",
                trustScore > 70 ? "text-emerald-400" : trustScore > 30 ? "text-amber-400" : "text-red-400"
              )}>
                {trustScore}%
              </span>
            )}
            {aiEnabled === false && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-white/10 text-white/40">
                <Bot className="h-2 w-2 mr-0.5" />
                AI Off
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Desktop view - IMPROVED layout
  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer transition-all duration-200 rounded-lg border",
        "hover:bg-white/[0.04] hover:border-white/[0.08]",
        "bg-white/[0.02] border-white/[0.04]",
        isSelected && "bg-white/[0.08] border-white/20",
        "border-l-2",
        getBorderColor()
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2",
              needsReply 
                ? "bg-red-500/10 border-red-500/50 text-red-200"
                : isNewContact
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                  : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10"
            )}>
              {(contact.name || '?').charAt(0).toUpperCase()}
            </div>
            {/* Online/Activity indicator */}
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0f172a]",
              needsReply ? "bg-red-500 animate-pulse" :
              status === 'paused' ? "bg-amber-500" :
              isDormant ? "bg-white/20" : "bg-emerald-500"
            )} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className={cn(
                  "font-semibold text-sm text-white truncate",
                  needsReply && "text-white"
                )}>
                  {contact.name || 'Inconnu'}
                </h3>
                <p className="text-xs text-white/40 font-mono truncate">
                  {contact.phone_whatsapp}
                </p>
              </div>
              
              {/* Right side: time & unread */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {lastMessageAt && (
                  <span className={cn(
                    "text-xs",
                    needsReply ? "text-red-400 font-medium" : "text-white/30"
                  )}>
                    {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true })}
                  </span>
                )}
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white border-0 text-xs px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* Last message preview */}
            <div className="mt-1">
              {lastMessage ? (
                <p className={cn(
                  "text-xs truncate",
                  needsReply ? "text-white/80" : "text-white/50"
                )}>
                  {lastMessage.sender === 'admin' && (
                    <span className="text-blue-400 font-medium mr-1">You:</span>
                  )}
                  {lastMessage.sender === 'ai' && (
                    <span className="text-purple-400 font-medium mr-1">AI:</span>
                  )}
                  {lastMessage.sender === 'contact' && needsReply && (
                    <span className="text-red-400 font-medium mr-1">New:</span>
                  )}
                  {lastMessage.message_text}
                </p>
              ) : (
                <p className="text-xs text-white/30 italic">No messages yet</p>
              )}
            </div>

            {/* Badges row - compact */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {/* Phase badge */}
              <Badge 
                variant="outline" 
                className={cn("text-[9px] px-1.5 py-0 h-5", phaseInfo.color)}
              >
                <PhaseIcon className="h-2.5 w-2.5 mr-1" />
                {phaseInfo.label}
              </Badge>

              {/* Trust score - compact */}
              {trustScore > 0 && (
                <span className={cn(
                  "text-[9px] font-medium",
                  trustScore > 70 ? "text-emerald-400" : trustScore > 30 ? "text-amber-400" : "text-red-400"
                )}>
                  {trustScore}%
                </span>
              )}

              {/* NEW badge */}
              {isNewContact && (
                <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-[9px] px-1.5 py-0 h-5">
                  NEW
                </Badge>
              )}

              {/* AI Status */}
              {aiEnabled === false && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-white/10 text-white/40">
                  <Bot className="h-2.5 w-2.5 mr-1" />
                  AI Off
                </Badge>
              )}

              {/* Paused status */}
              {status === 'paused' && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-amber-500/20 text-amber-400 bg-amber-500/10">
                  <Pause className="h-2.5 w-2.5 mr-1" />
                  Paused
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
