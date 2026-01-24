import { ConversationPageClient } from "@/components/pwa/conversation-page-client"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ConversationPage({ params }: { params: Promise<{ agentId: string, id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const { agentId, id: idStr } = await params
    const id = parseInt(idStr)

    const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
            contact: true,
            prompt: true,
            messages: {
                orderBy: {
                    timestamp: 'asc'
                }
            }
        }
    })

    if (!conversation) {
        return <div>Conversation not found</div>
    }

    return (
        <ConversationPageClient
            conversation={conversation}
            agentId={agentId}
            id={id}
        />
    )
}
