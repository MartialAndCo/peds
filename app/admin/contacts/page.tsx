'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash, MessageSquare, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ContextDialog } from '@/components/contacts/context-dialog'
import { cn } from '@/lib/utils'

export default function ContactsPage() {
    const router = useRouter()
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

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

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure?')) return
        try {
            await axios.delete(`/api/contacts/${id}`)
            fetchContacts(search)
        } catch (error) {
            console.error(error)
        }
    }

    const startConversation = (contactId: number) => {
        // Redirect to new conversation page pre-filled?
        // Or just open modal.
        // For MVP, maybe redirect to conversations list or a "New Conversation" page.
        // Let's create a 'start' page or just use the Conversations list "New" button.
        // We haven't implemented Conversations Frontend yet.
        // Let's assume we will have /conversations/new?contactId=...
        router.push(`/conversations/new?contact_id=${contactId}`)
    }

    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [contextOpen, setContextOpen] = useState(false)

    const handleOpenContext = (contact: any) => {
        setSelectedContact(contact)
        setContextOpen(true)
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <ContextDialog
                contact={selectedContact}
                open={contextOpen}
                onOpenChange={setContextOpen}
                onSaved={() => fetchContacts(search)}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-white">Contacts Explorer</h2>
                    <p className="text-white/40 text-sm italic">Manage your lead database and conversation context.</p>
                </div>
                <Link href="/contacts/new">
                    <Button className="glass-strong border-white/10 hover:bg-white/10 text-white font-semibold transition-all">
                        <Plus className="mr-2 h-4 w-4" />
                        New Lead
                    </Button>
                </Link>
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
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Context Status</TableHead>
                            <TableHead className="text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Status</TableHead>
                            <TableHead className="text-right text-white/40 text-[10px] uppercase font-bold tracking-widest py-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-white/20 italic">Loading Lead Database...</TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-white/20">Zero leads found in the matrix.</TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => {
                                const needsContext = !contact.notes || contact.notes.length < 5
                                return (
                                    <TableRow key={contact.id} className="border-white/5 hover:bg-white/5 transition-all group">
                                        <TableCell className="font-semibold text-white/90 py-4">{contact.name}</TableCell>
                                        <TableCell className="text-white/50 font-mono text-xs">{contact.phone_whatsapp}</TableCell>
                                        <TableCell>
                                            {needsContext ? (
                                                <div className="flex items-center gap-3">
                                                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter">Needs Context</Badge>
                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-white/40 hover:text-white hover:bg-white/10 uppercase tracking-tighter font-bold" onClick={() => handleOpenContext(contact)}>
                                                        Fix &rarr;
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter">
                                                    Context Set ({contact.notes.substring(0, 15)}...)
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter",
                                                contact.status === 'new' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" : "bg-white/5 text-white/40 border-white/10"
                                            )}>
                                                {contact.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500/60 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" onClick={() => startConversation(contact.id)} title="Start Chat">
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/10 transition-colors" onClick={() => router.push(`/contacts/${contact.id}`)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-colors" onClick={() => handleDelete(contact.id)}>
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
