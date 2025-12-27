'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ContextDialog } from '@/components/contacts/context-dialog'

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
        <div className="space-y-4">
            <ContextDialog
                contact={selectedContact}
                open={contextOpen}
                onOpenChange={setContextOpen}
                onSaved={() => fetchContacts(search)}
            />

            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
                <Link href="/contacts/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Contact
                    </Button>
                </Link>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <Button type="submit" variant="secondary">Search</Button>
            </form>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Context Status</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">Loading...</TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">No contacts found</TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => {
                                const needsContext = !contact.notes || contact.notes.length < 5
                                return (
                                    <TableRow key={contact.id}>
                                        <TableCell className="font-medium">{contact.name}</TableCell>
                                        <TableCell>{contact.phone_whatsapp}</TableCell>
                                        <TableCell>
                                            {needsContext ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">Needs Context</Badge>
                                                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => handleOpenContext(contact)}>
                                                        Add
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                    Context Set ({contact.notes.substring(0, 10)}...)
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={contact.status === 'new' ? 'default' : 'secondary'}>
                                                {contact.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" className="text-green-600" onClick={() => startConversation(contact.id)} title="Start Conversation">
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => router.push(`/contacts/${contact.id}`)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(contact.id)}>
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
