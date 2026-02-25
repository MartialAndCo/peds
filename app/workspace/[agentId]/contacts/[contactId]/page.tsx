'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, MessageSquare, ChevronDown, ChevronUp, Ban, ShieldCheck } from 'lucide-react'
import { usePWAMode } from '@/hooks/use-pwa-mode'
import { MobileContactDetails } from '@/components/pwa/pages/mobile-contact-details'
import { ContactIntelligenceDashboard } from '@/components/profile-intelligence'
import { cn } from '@/lib/utils'
import { getContactDisplayName } from '@/lib/contact-display'

export default function ContactDetailsPage() {
    const { contactId, agentId } = useParams()
    const router = useRouter()
    const [contact, setContact] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showLegacy, setShowLegacy] = useState(false)
    const [blocking, setBlocking] = useState(false)

    const { isPWAStandalone } = usePWAMode()

    useEffect(() => {
        const fetchContact = async () => {
            try {
                const res = await axios.get(`/api/contacts/${contactId}?agentId=${agentId}`)
                setContact(res.data)
            } catch (e) {
                console.error("Fetch error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchContact()
    }, [contactId, agentId])

    const handleToggleBlock = async () => {
        if (!contact?.id) return

        const isBlocked = ['blacklisted', 'archive'].includes(contact.status)
        const confirmed = isBlocked
            ? confirm('Débloquer ce contact ?')
            : confirm('Bloquer ce contact ? Il sera masqué et ses messages seront ignorés.')

        if (!confirmed) return

        setBlocking(true)
        try {
            const targetStatus = isBlocked ? 'active' : 'blacklisted'
            await axios.put(`/api/contacts/${contact.id}`, { status: targetStatus })

            if (targetStatus === 'blacklisted') {
                router.push(`/workspace/${agentId}/contacts`)
                return
            }

            const refreshed = await axios.get(`/api/contacts/${contactId}?agentId=${agentId}`)
            setContact(refreshed.data)
        } catch (e) {
            console.error('Toggle block failed', e)
            alert('Action impossible, regarde la console.')
        } finally {
            setBlocking(false)
        }
    }

    if (loading) return (
        <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin text-white/20" />
        </div>
    )
    
    if (!contact) return (
        <div className="p-20 text-white text-center">Contact not found</div>
    )

    if (isPWAStandalone) {
        return <MobileContactDetails contact={contact} media={[]} agentId={agentId as string} />
    }

    const displayName = getContactDisplayName(contact)

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="text-white/50 hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
                            {displayName || contact.phone_whatsapp}
                        </h2>
                        <p className="text-sm text-white/40 font-mono">{contact.phone_whatsapp}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        disabled={blocking}
                        className={cn(
                            "border-white/10",
                            ['blacklisted', 'archive'].includes(contact.status)
                                ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        )}
                        onClick={handleToggleBlock}
                    >
                        {blocking ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : ['blacklisted', 'archive'].includes(contact.status) ? (
                            <ShieldCheck className="h-4 w-4 mr-2" />
                        ) : (
                            <Ban className="h-4 w-4 mr-2" />
                        )}
                        {['blacklisted', 'archive'].includes(contact.status) ? 'Débloquer' : 'Bloquer'}
                    </Button>

                    <Button
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => router.push(`/workspace/${agentId}/conversations?contact=${contactId}`)}
                    >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ouvrir Chat
                    </Button>
                </div>
            </div>

            {/* NOUVEAU: Dashboard Intelligence */}
            <ContactIntelligenceDashboard 
                contactId={contactId as string}
                agentId={agentId as string}
            />

            {/* Ancien profil (collapsible) */}
            <div className="border-t border-white/10 pt-6">
                <button
                    onClick={() => setShowLegacy(!showLegacy)}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                    {showLegacy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showLegacy ? 'Masquer' : 'Afficher'} l'ancien profil (legacy)
                </button>
                
                {showLegacy && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg opacity-50">
                        <pre className="text-xs text-white/60 overflow-auto">
                            {JSON.stringify(contact.profile, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}
