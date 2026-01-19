'use client'

import { usePWAMode } from '@/hooks/use-pwa-mode'
import { MobileChatView } from '@/components/pwa/pages/mobile-chat-view'
import { ConversationView } from '@/components/conversation-view'

interface ConversationPageClientProps {
    conversation: any
    agentId: string
    id: number
}

export function ConversationPageClient({ conversation, agentId, id }: ConversationPageClientProps) {
    const { isPWAStandalone } = usePWAMode()

    if (isPWAStandalone) {
        return (
            <MobileChatView
                conversation={conversation}
                agentId={agentId}
                onSendMessage={async (text) => {
                    // Re-implement or pass server action if needed, 
                    // or usage of axios as in other components
                    // For now keeping it simple as placeholder for logic
                }}
            />
        )
    }

    return (
        <div className="h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)]">
            <ConversationView conversationId={id} initialData={conversation} />
        </div>
    )
}
