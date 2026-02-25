'use client'

import { useRouter } from "next/navigation"
import { formatDistanceToNow } from 'date-fns'
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getContactDisplayName, getContactInitial } from '@/lib/contact-display'
import { 
  MessageCircle, 
  Bot, 
  TrendingUp,
  AlertTriangle,
  Heart,
  Pause,
  Bell
} from 'lucide-react'

interface MobileConversationListProps {
  conversations: any[]
  loading: boolean
  agentId: string
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

export function MobileConversationList({ conversations, loading, agentId }: MobileConversationListProps) {
  const router = useRouter()

  if (loading) {
    return <div className="p-8 text-center text-white/30 text-sm">Loading conversations...</div>
  }

  if (conversations.length === 0) {
    return <div className="p-8 text-center text-white/30 text-sm">No conversations found</div>
  }

  return (
    <div className="space-y-0 pb-24">
      {conversations.map((conv) => {
        const lastMessage = conv.lastMessage
        const unreadCount = conv.unreadCount || 0
        const needsReply = lastMessage?.sender === 'contact' && unreadCount > 0
        const isNewContact = conv.contact?.status === 'new'
        const phase = conv.contact?.agentPhase || 'CONNECTION'
        const phaseInfo = phaseConfig[phase] || phaseConfig.CONNECTION
        const PhaseIcon = phaseInfo.icon
        const trustScore = conv.contact?.trustScore || 0
        const displayName = getContactDisplayName(conv.contact)
        const displayInitial = getContactInitial(conv.contact)
        
        return (
          <div
            key={conv.id}
            onClick={() => router.push(`/workspace/${agentId}/conversations/${conv.id}`)}
            className={cn(
              "group active:bg-white/[0.08] -mx-4 px-4 py-3 transition-all flex items-center gap-3 border-b border-white/[0.03] cursor-pointer",
              needsReply && "bg-red-500/5"
            )}
          >
            {/* Avatar with status indicator */}
            <div className="relative">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-lg border-2 transition-all",
                needsReply 
                  ? "bg-red-500/10 border-red-500/50 text-red-200"
                  : isNewContact
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                    : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10 text-white"
              )}>
                {displayInitial}
              </div>
              {/* Status dot */}
              {needsReply && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-1 border-2 border-[#0f172a]">
                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </div>
              )}
              {conv.status === 'paused' && !needsReply && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5 border-2 border-[#0f172a]">
                  <Pause className="h-2 w-2 text-white" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <h3 className={cn(
                  "truncate text-base",
                  needsReply ? "font-bold text-white" : "font-semibold text-white/90"
                )}>
                  {displayName}
                </h3>
                <span className={cn(
                  "text-xs truncate ml-2",
                  needsReply ? "text-red-400 font-medium" : "text-white/30"
                )}>
                  {conv.lastMessageAt 
                    ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false }) 
                    : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className={cn(
                  "truncate text-sm leading-snug pr-4",
                  needsReply ? "text-white font-medium" : "text-white/50"
                )}>
                  {lastMessage ? (
                    <>
                      {lastMessage.sender === 'admin' && (
                        <span className="text-blue-400 mr-1">You:</span>
                      )}
                      {lastMessage.sender === 'ai' && (
                        <span className="text-purple-400 mr-1">AI:</span>
                      )}
                      {lastMessage.message_text}
                    </>
                  ) : (
                    <span className="italic opacity-50">No messages yet</span>
                  )}
                </p>
                {unreadCount > 0 && (
                  <div className="h-5 min-w-[20px] rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white px-1.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
              {/* Phase & Trust badge row */}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge 
                  variant="outline" 
                  className={cn("text-[9px] px-1.5 py-0 h-4", phaseInfo.color)}
                >
                  <PhaseIcon className="h-2.5 w-2.5 mr-1" />
                  {phaseInfo.label}
                </Badge>
                {trustScore > 0 && (
                  <span className={cn(
                    "text-[10px] font-medium",
                    trustScore > 70 ? "text-emerald-400" : trustScore > 30 ? "text-amber-400" : "text-red-400"
                  )}>
                    {trustScore}% trust
                  </span>
                )}
                {conv.aiEnabled === false && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-white/10 text-white/40">
                    <Bot className="h-2.5 w-2.5 mr-1" />
                    AI Off
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
