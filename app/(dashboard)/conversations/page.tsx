'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Check, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ConversationsPage() {
    const router = useRouter()
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchConversations()
    }, [])

    const fetchConversations = async () => {
        try {
            const res = await axios.get('/api/conversations')
            setConversations(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Conversations</h2>
                <Link href="/conversations/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Conversation
                    </Button>
                </Link>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Contact</TableHead>
                            <TableHead>Prompt</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Message</TableHead>
                            <TableHead>Started</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-4">Loading...</TableCell>
                            </TableRow>
                        ) : conversations.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-4">No conversations found</TableCell>
                            </TableRow>
                        ) : (
                            conversations.map((conv) => (
                                <TableRow key={conv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/conversations/${conv.id}`)}>
                                    <TableCell className="font-medium">{conv.contact.name}</TableCell>
                                    <TableCell>{conv.prompt.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={conv.status === 'active' ? 'default' : conv.status === 'paused' ? 'outline' : 'secondary'}>
                                            {conv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                                        {conv.messages?.[0]?.message_text || '-'}
                                    </TableCell>
                                    <TableCell>{new Date(conv.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Open</Button>
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
