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
                    <>
                        {/* SECTION 1: NEW LEADS (Waiting for Reply) */}
                        {contacts.some(c => c.status === 'new') && (
                            <div className="mb-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-3 px-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                    New Leads
                                </h3>
                                <div className="space-y-3">
                                    {contacts.filter(c => c.status === 'new').map((contact) => (
                                        <ContactCard key={contact.id} contact={contact} onClick={() => openDetails(contact)} isLead={true} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SECTION 2: ACTIVE & OTHERS */}
                        {contacts.some(c => c.status !== 'new') && (
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3 px-2">Active Contacts</h3>
                                <div className="space-y-3">
                                    {contacts.filter(c => c.status !== 'new').map((contact) => (
                                        <ContactCard key={contact.id} contact={contact} onClick={() => openDetails(contact)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
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
                                        {(selectedContact.name || 'Inconnu').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-white text-center">{selectedContact.name || 'Inconnu'}</h2>
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

                            <div className="flex-1 p-6 overflow-y-auto pb-28">
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

function ContactCard({ contact, onClick, isLead }: { contact: any, onClick: () => void, isLead?: boolean }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "bg-white/[0.03] active:bg-white/[0.08] border rounded-2xl p-4 flex items-center justify-between transition-colors",
                isLead ? "border-sky-500/20 bg-sky-500/5" : "border-white/5"
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center border",
                    isLead ? "bg-sky-500/20 border-sky-500/30 text-sky-200" : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-white/10 text-white"
                )}>
                    <span className="font-semibold text-lg">
                        {(contact.name || 'Inconnu').charAt(0).toUpperCase()}
                    </span>
                </div>
                <div>
                    <h3 className={cn("font-medium text-base", isLead ? "text-sky-100" : "text-white")}>
                        {contact.name || 'Inconnu'}
                    </h3>
                    <p className={cn("text-sm font-mono", isLead ? "text-sky-300/50" : "text-white/40")}>
                        {contact.phone_whatsapp}
                    </p>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1">
                {isLead ? (
                    <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-400 bg-sky-500/10 px-1.5 py-0.5">
                        NEW
                    </Badge>
                ) : (
                    <span className={cn(
                        "w-2 h-2 rounded-full",
                        contact.status === 'active' ? "bg-emerald-500 box-shadow-glow-emerald" : "bg-white/20"
                    )} />
                )}
            </div>
        </div>
    )
}
