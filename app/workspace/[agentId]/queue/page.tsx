'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getQueueItems, deleteQueueItem, sendQueueItemNow } from '@/app/actions/queue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCcw, Trash2, Zap, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function WorkspaceQueuePage() {
    const { agentId } = useParams()
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchItems = async () => {
        setLoading(true)
        // Pass agentId to filter items
        const id = Array.isArray(agentId) ? parseInt(agentId[0]) : parseInt(agentId || '0')
        // @ts-ignore - mismatch in queue actions sig vs client use, checking types later
        const data = await getQueueItems(id)
        setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        if (agentId) fetchItems()

        // Auto refresh
        const interval = setInterval(fetchItems, 10000)
        return () => clearInterval(interval)
    }, [agentId])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this message?')) return
        await deleteQueueItem(id)
        fetchItems()
    }

    const handleSendNow = async (id: string) => {
        if (!confirm('Send this message immediately?')) return
        setLoading(true)
        const result = await sendQueueItemNow(id)
        if (!result.success) alert('Failed: ' + result.error)
        fetchItems()
    }

    if (!agentId) return null

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tighter text-white italic">Transmission Queue</h2>
                    <p className="text-white/40 mt-1">Pending outgoing signals</p>
                </div>
                <Button onClick={fetchItems} variant="outline" size="sm" className="glass border-white/10 hover:bg-white/5">
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="glass overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Status</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Scheduled</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Contact</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Content</TableHead>
                            <TableHead className="text-right text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableCell colSpan={5} className="text-center py-12 text-white/20 italic">
                                    Queue empty. No transmissions pending.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-all">
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider"
                                        )}>
                                            <Clock className="w-3 h-3 mr-1" />
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-white/80 text-sm">
                                            <span className="font-mono">
                                                {new Date(item.scheduledAt).toLocaleTimeString()}
                                            </span>
                                            <span className="text-xs text-white/30">
                                                {new Date(item.scheduledAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-white/90 text-sm">{item.contact.name}</span>
                                            <span className="text-xs text-white/40 font-mono">{item.contact.phone_whatsapp}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[300px]">
                                        <p className="truncate text-white/60 text-sm italic" title={item.content}>
                                            "{item.content}"
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                            title="Send Now (Force)"
                                            onClick={() => handleSendNow(item.id)}
                                        >
                                            <Zap className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            title="Cancel"
                                            onClick={() => handleDelete(item.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
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
