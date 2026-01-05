'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function WorkspaceConversationsPage() {
    const router = useRouter()
    const { agentId } = useParams()
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showNeedsContext, setShowNeedsContext] = useState(false)

    useEffect(() => {
        fetchConversations()
    }, [agentId])

    const fetchConversations = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`/api/conversations?agentId=${agentId}`)
            setConversations(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const filteredConversations = showNeedsContext
        ? conversations.filter(c => c.status === 'paused')
        : conversations

    const needsContextCount = conversations.filter(c => c.status === 'paused').length

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Conversation Hub</h2>
                    <Button
                        variant={showNeedsContext ? "default" : "outline"}
                        className={showNeedsContext ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" : "text-orange-400 border-slate-700 hover:bg-slate-800"}
                        onClick={() => setShowNeedsContext(!showNeedsContext)}
                    >
                        ⚠️ Needs Context
                        {needsContextCount > 0 && <Badge variant="secondary" className="ml-2 bg-white/20 text-current">{needsContextCount}</Badge>}
                    </Button>
                </div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur-sm">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-slate-400">Contact</TableHead>
                            <TableHead className="text-slate-400">Status</TableHead>
                            <TableHead className="text-slate-400">Last Message</TableHead>
                            <TableHead className="text-slate-400">Started</TableHead>
                            <TableHead className="text-right text-slate-400">Chat</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredConversations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">No conversations found for this agent</TableCell>
                            </TableRow>
                        ) : (
                            filteredConversations.map((conv) => (
                                <TableRow
                                    key={conv.id}
                                    className="cursor-pointer border-white/5 hover:bg-white/5 transition-colors group"
                                    onClick={() => router.push(`/workspace/${agentId}/conversations/${conv.id}`)}
                                >
                                    <TableCell className="font-medium text-slate-200">{conv.contact.name}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "font-bold uppercase text-[10px]",
                                            conv.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                conv.status === 'paused' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                                    "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                        )} variant="outline">
                                            {conv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate text-slate-400 group-hover:text-slate-200 transition-colors">
                                        {conv.messages?.[0]?.message_text || '-'}
                                    </TableCell>
                                    <TableCell className="text-slate-500">{new Date(conv.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="text-sky-400 hover:text-sky-300 hover:bg-sky-400/10">Open Chat &rarr;</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
