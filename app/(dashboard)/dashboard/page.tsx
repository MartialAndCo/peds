import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, MessageSquare, Bot, ArrowRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Separator } from "@/components/ui/separator"

export default async function DashboardPage() {
    const [contactsCount, activeConversationsCount, promptsCount] = await Promise.all([
        prisma.contact.count(),
        prisma.conversation.count({ where: { status: 'active' } }),
        prisma.prompt.count()
    ])

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-400">
                    Dashboard
                </h2>
                <p className="text-muted-foreground">
                    Overview of your WhatsApp automation agent.
                </p>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-l-4 border-l-sky-500 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-default bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Contacts Total
                        </CardTitle>
                        <div className="p-2 bg-sky-500/10 rounded-full">
                            <Users className="h-4 w-4 text-sky-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{contactsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Recorded contacts
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-600 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-default bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Conversations
                        </CardTitle>
                        <div className="p-2 bg-green-600/10 rounded-full">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeConversationsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Currently active sessions
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-violet-500 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-default bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Prompts Configured
                        </CardTitle>
                        <div className="p-2 bg-violet-500/10 rounded-full">
                            <Bot className="h-4 w-4 text-violet-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{promptsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Available prompts
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
