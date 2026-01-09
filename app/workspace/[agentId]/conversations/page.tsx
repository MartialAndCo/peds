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
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <h2 className="text-3xl font-bold tracking-tighter text-white italic">Conversation Hub</h2>
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
            </div>

            <div className="glass overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Participant</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">State</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Latest Transmission</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Established</TableHead>
                            <TableHead className="text-right text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Access</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredConversations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-white/20 italic">No signals detected in this sector.</TableCell>
                            </TableRow>
                        ) : (
                            filteredConversations.map((conv) => (
                                <TableRow
                                    key={conv.id}
                                    className="cursor-pointer border-white/5 hover:bg-white/5 transition-all group"
                                    onClick={() => router.push(`/workspace/${agentId}/conversations/${conv.id}`)}
                                >
                                    <TableCell className="font-semibold text-white/90 py-4">{conv.contact.name}</TableCell>
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
                                    <TableCell className="max-w-[300px] truncate text-white/40 group-hover:text-white/70 transition-colors italic text-sm font-light">
                                        {conv.messages?.[0]?.message_text || '-'}
                                    </TableCell>
                                    <TableCell className="text-white/20 text-xs font-mono">{new Date(conv.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="glass h-7 text-[10px] font-bold uppercase tracking-widest border-white/5 hover:bg-white/10 text-white/60 group-hover:text-white transition-all">
                                            Open Stream &rarr;
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
