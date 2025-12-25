'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, MessageSquare, Bot } from "lucide-react"
import { useState, useEffect } from "react"
import axios from "axios"

export default function DashboardPage() {
    const [stats, setStats] = useState({
        contactsCount: 0,
        activeConversationsCount: 0,
        promptsCount: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('/api/stats')
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Contacts Total
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.contactsCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {loading ? 'loading...' : 'Recorded contacts'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Conversations Actives
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.activeConversationsCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {loading ? 'loading...' : 'Currently active sessions'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Prompts Configured
                        </CardTitle>
                        <Bot className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? '...' : stats.promptsCount}</div>
                        <p className="text-xs text-muted-foreground">
                            {loading ? 'loading...' : 'Available prompts'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
