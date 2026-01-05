'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, MessageSquare, Users, Eye } from 'lucide-react'

export default function AgentOverviewPage() {
    const { agentId } = useParams()
    const [agent, setAgent] = useState<any>(null)
    const [stats, setStats] = useState({ conversations: 0, messages: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Fetch agent info
        axios.get('/api/agents').then(res => {
            const found = res.data.find((a: any) => a.id.toString() === agentId)
            setAgent(found)
            setLoading(false)
        }).catch(e => setLoading(false))

        // TODO: Fetch real stats (mock for now because we don't have a specific stats endpoint per agent yet)
        setStats({ conversations: 12, messages: 342 })
    }, [agentId])

    if (loading) return <Loader2 className="animate-spin text-slate-400" />
    if (!agent) return <div>Agent not found</div>

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">My Desk</h1>
                <p className="text-slate-500">Welcome to {agent.name}'s workspace.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                        <MessageSquare className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.conversations}</div>
                        <p className="text-xs text-muted-foreground">+2 from yesterday</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Messages Exchanged</CardTitle>
                        <Eye className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.messages}</div>
                        <p className="text-xs text-muted-foreground">+45 new messages</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Status</CardTitle>
                        <Users className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">Online</div>
                        <p className="text-xs text-muted-foreground">System is running</p>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
                <div className="text-sm text-slate-500 italic">No recent activity log available.</div>
            </div>
        </div>
    )
}
