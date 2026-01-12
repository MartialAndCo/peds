'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Trash, MessageSquare, Search, AlertTriangle } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function WorkspaceContactsPage() {
    const router = useRouter()
    const { agentId } = useParams()
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)

    useEffect(() => {
        fetchContacts()
    }, [])

    const fetchContacts = async (query = '') => {
        setLoading(true)
        try {
            const params = query ? { search: query } : {}
            const res = await axios.get('/api/contacts', { params })
            setContacts(res.data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchContacts(search)
    }

    const handleHardDelete = async (id: string, name: string) => {
        const confirmed = confirm(
            `⚠️ HARD DELETE\n\nThis will permanently delete:\n- Contact: ${name}\n- All conversations\n- All messages\n- All memories\n- All pending requests\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?`
        )
        if (!confirmed) return

        setDeleting(id)
        try {
            await axios.delete(`/api/contacts/${id}`)
            fetchContacts(search)
        } catch (error) {
            console.error('Hard delete failed:', error)
            alert('Delete failed. See console.')
        } finally {
            setDeleting(null)
        }
    }

    const goToConversation = (contactId: string) => {
        router.push(`/workspace/${agentId}/conversations?contact=${contactId}`)
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Contacts</h2>
                    <p className="text-white/40 text-sm italic">Manage contacts and perform HARD delete (removes ALL data).</p>
                </div>
            </div>

            <form onSubmit={handleSearch} className="flex gap-3 glass p-4 rounded-xl border-white/10">
                <Input
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-white/20"
                />
                <Button type="submit" variant="secondary" className="glass border-white/10 hover:bg-white/5 text-white">
                    <Search className="h-4 w-4 mr-2 opacity-50" />
                    Search
                </Button>
            </form>

            <div className="glass overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Name</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Phone</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Status</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Test Mode</TableHead>
                            <TableHead className="text-right text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-white/20 italic">Loading...</TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-white/20">No contacts found.</TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => (
                                <TableRow key={contact.id} className="border-white/5 hover:bg-white/5 transition-all group">
                                    <TableCell className="font-semibold text-white/90 py-4">{contact.name}</TableCell>
                                    <TableCell className="text-white/50 font-mono text-xs">{contact.phone_whatsapp}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter",
                                            contact.status === 'new' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                                                contact.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                    "bg-white/5 text-white/40 border-white/10"
                                        )}>
                                            {contact.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {contact.testMode ? (
                                            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 px-2 py-0.5 text-[10px]">TEST</Badge>
                                        ) : (
                                            <span className="text-white/20 text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                            onClick={() => goToConversation(contact.id)}
                                            title="View Conversations"
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            onClick={() => handleHardDelete(contact.id, contact.name)}
                                            disabled={deleting === contact.id}
                                            title="HARD Delete (removes everything)"
                                        >
                                            {deleting === contact.id ? (
                                                <span className="animate-spin">⏳</span>
                                            ) : (
                                                <Trash className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="glass p-4 rounded-xl border-orange-500/20 bg-orange-500/5">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-orange-400 font-semibold text-sm">HARD Delete Warning</p>
                        <p className="text-orange-400/70 text-xs mt-1">
                            Clicking the trash icon will permanently delete the contact AND all associated data:
                            conversations, messages, memory, and pending voice requests. This cannot be undone.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
