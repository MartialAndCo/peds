'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Phone, MessageSquare, MoreHorizontal, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface MobileContactListProps {
    contacts: any[]
    onSearch: (query: string) => void
    loading: boolean
    agentId: string
    refresh: () => void
}

export function MobileContactList({ contacts, onSearch, loading, agentId, refresh }: MobileContactListProps) {
    const router = useRouter()
    const [search, setSearch] = useState('')
    const [selectedContact, setSelectedContact] = useState<any>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        onSearch(search)
    }

    const openDetails = (contact: any) => {
        setSelectedContact(contact)
        setDetailsOpen(true)
    }

    return (
        <div className="space-y-4">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06] pb-2 pt-2 px-1 pwa-safe-area-top-margin transition-all">
                <h1 className="text-2xl font-bold text-white px-1 mb-2">Contacts</h1>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 focus:ring-white/20 h-10"
                    />
                </form>
            </div>

            {/* Contact List */}
            <div className="space-y-3 pb-24">
                {loading ? (
                    <div className="text-center py-10 text-white/30">Loading contacts...</div>
                ) : contacts.length === 0 ? (
                    <div className="text-center py-10 text-white/30">No contacts found</div>
                ) : (
                    contacts.map((contact) => (
                        <div
                            key={contact.id}
                            onClick={() => openDetails(contact)}
                            className="bg-white/[0.03] active:bg-white/[0.08] border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                                    <span className="text-white font-semibold text-lg">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-base">{contact.name}</h3>
                                    <p className="text-white/40 text-sm font-mono">{contact.phone_whatsapp}</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    contact.status === 'active' ? "bg-emerald-500 box-shadow-glow-emerald" : "bg-white/20"
                                )} />
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Details Sheet */}
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[30px] border-white/10 bg-[#0f172a] p-0 overflow-hidden">
                    {selectedContact && (
                        <div className="flex flex-col h-full">
                            <div className="p-6 flex flex-col items-center border-b border-white/10 relative">
                                <div className="w-12 h-1 rounded-full bg-white/10 mb-6 absolute top-3" />

                                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-4">
                                    <span className="text-white font-bold text-3xl">
                                        {selectedContact.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-white text-center">{selectedContact.name}</h2>
                                <p className="text-white/50 font-mono mt-1">{selectedContact.phone_whatsapp}</p>

                                <div className="flex items-center gap-4 mt-6 w-full max-w-xs">
                                    <Button
                                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl h-12"
                                        onClick={() => router.push(`/workspace/${agentId}/conversations?contact=${selectedContact.id}`)}
                                    >
                                        <MessageSquare className="mr-2 h-5 w-5" />
                                        Chat
                                    </Button>
                                    <div className="w-px h-8 bg-white/10" />
                                    <Button
                                        className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl h-12"
                                        onClick={() => router.push(`/workspace/${agentId}/contacts/${selectedContact.id}`)}
                                    >
                                        <User className="mr-2 h-5 w-5" />
                                        Contact
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">Status</label>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-white/60 border-white/10">{selectedContact.status}</Badge>
                                            {selectedContact.testMode && <Badge variant="outline" className="text-yellow-400 border-yellow-500/20 bg-yellow-500/10">Test Mode</Badge>}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">Context / Notes</label>
                                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                                                {selectedContact.notes || "No context notes provided."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
