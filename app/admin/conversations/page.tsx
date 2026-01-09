'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Check, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

import { useAgent } from '@/components/agent-provider'

export default function ConversationsPage() {
    const router = useRouter()
    const { selectedAgent } = useAgent()
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showNeedsContext, setShowNeedsContext] = useState(false)

    useEffect(() => {
        fetchConversations()
    }, [selectedAgent])

    const fetchConversations = async () => {
        setLoading(true)
        try {
            const url = selectedAgent
                ? `/api/conversations?agentId=${selectedAgent.id}`
                : `/api/conversations`
            const res = await axios.get(url)
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

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <h2 className="text-3xl font-bold tracking-tight text-white italic">Conversations</h2>
                    <Button
                        variant="outline"
                        className={cn(
                            "transition-all duration-300 font-bold uppercase text-[10px] tracking-widest px-4",
                            showNeedsContext
                                ? "bg-orange-500/20 text-orange-400 border-orange-500/40 hover:bg-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
                                : "glass border-white/10 text-white/40 hover:text-white hover:bg-white/5"
                        )}
                        onClick={() => setShowNeedsContext(!showNeedsContext)}
                    >
                        {showNeedsContext ? "✨ High Priority" : "⚠️ Needs Context"}
                        {needsContextCount > 0 && <Badge className="ml-2 bg-white/10 text-white border-transparent">{needsContextCount}</Badge>}
                    </Button>
                </div>
                <Link href="/conversations/new">
                    <Button className="glass-strong border-white/10 hover:bg-white/10 text-white font-semibold transition-all shadow-xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Initiate Chat
                    </Button>
                </Link>
            </div>

            <div className="glass overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Participant</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Behavior</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">State</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Latest Transmission</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Established</TableHead>
                            <TableHead className="text-right text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Access</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-white/20 italic">Deciphering stream...</TableCell>
                            </TableRow>
                        ) : filteredConversations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-white/20">Silence in the network.</TableCell>
                            </TableRow>
                        ) : (
                            filteredConversations.map((conv) => (
                                <TableRow
                                    key={conv.id}
                                    className="cursor-pointer border-white/5 hover:bg-white/5 transition-all group"
                                    onClick={() => router.push(`/workspace/${conv.agentId}/conversations/${conv.id}`)}
                                >
                                    <TableCell className="font-semibold text-white/90 py-4">{conv.contact.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-white/5 border-white/10 text-white/40 text-[9px] font-bold uppercase px-2 py-0">
                                            {conv.prompt.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter",
                                            conv.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                conv.status === 'paused' ? "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]" :
                                                    "bg-white/5 text-white/30 border-white/10"
                                        )}>
                                            {conv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-white/50 group-hover:text-white/70 transition-colors italic text-sm font-light">
                                        {conv.messages?.[0]?.message_text || '-'}
                                    </TableCell>
                                    <TableCell className="text-white/30 text-xs font-mono">{new Date(conv.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="glass h-7 text-[10px] font-bold uppercase tracking-widest border-white/5 hover:bg-white/10 text-white/60 group-hover:text-white transition-all">
                                            Enter &rarr;
                                        </Button>
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
