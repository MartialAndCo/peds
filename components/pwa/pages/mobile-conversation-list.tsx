'use client'

import { useRouter } from "next/navigation"
import { formatDistanceToNow } from 'date-fns'
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MobileConversationListProps {
    conversations: any[]
    loading: boolean
    agentId: string
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
        <div className="space-y-4 pb-24">
            <h1 className="text-2xl font-bold text-white px-1">Messages</h1>

            <div className="space-y-1">
                {conversations.map((conv) => {
                    const lastMessage = conv.messages?.[0]
                    const isUnread = false // Logic to implement if needed
                    const needsContext = conv.status === 'paused'

                    return (
                        <div
                            key={conv.id}
                            onClick={() => router.push(`/workspace/${agentId}/conversations/${conv.id}`)}
                            className="group active:bg-white/5 -mx-4 px-4 py-3 transition-colors flex items-center gap-3 border-b border-white/[0.03]"
                        >
                            {/* Avatar */}
                            <div className="relative">
                                <div className={cn(
                                    "h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold text-lg border transition-all",
                                    needsContext
                                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                                        : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-white/10"
                                )}>
                                    {conv.contact.name.charAt(0).toUpperCase()}
                                </div>
                                {needsContext && (
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-orange-500 rounded-full p-0.5 border-2 border-[#0f172a]">
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={cn(
                                        "truncate text-base",
                                        isUnread ? "font-bold text-white" : "font-semibold text-white/90"
                                    )}>
                                        {conv.contact.name}
                                    </h3>
                                    <span className={cn(
                                        "text-xs truncate ml-2",
                                        isUnread ? "text-white/60 font-medium" : "text-white/30"
                                    )}>
                                        {lastMessage ? formatDistanceToNow(new Date(lastMessage.timestamp), { addSuffix: false }) : ''}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={cn(
                                        "truncate text-sm leading-snug pr-4",
                                        isUnread ? "text-white font-medium" : "text-white/50"
                                    )}>
                                        {lastMessage
                                            ? (lastMessage.from_me ? `You: ${lastMessage.message_text}` : lastMessage.message_text)
                                            : <span className="italic opacity-50">No messages yet</span>
                                        }
                                    </p>
                                    {isUnread && (
                                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
