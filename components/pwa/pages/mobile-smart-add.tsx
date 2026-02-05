'use client'

import { useState } from 'react'
import axios from 'axios'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Sparkles, Check, X, MessageCircle } from 'lucide-react'

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
)

interface MobileSmartAddProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    agentId: string
    onSuccess?: () => void
}

type ContactType = 'whatsapp' | 'discord'

export function MobileSmartAdd({ open, onOpenChange, agentId, onSuccess }: MobileSmartAddProps) {
    const [contactType, setContactType] = useState<ContactType>('whatsapp')
    const [identifier, setIdentifier] = useState('') // phone or discord username
    const [platform, setPlatform] = useState('')
    const [conversation, setConversation] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [generatedContext, setGeneratedContext] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        if (!identifier || !platform || !conversation) {
            setError('Fill all fields')
            return
        }

        setLoading(true)
        setError('')

        try {
            const res = await axios.post('/api/contacts/smart-add', {
                // Send phone OR discordId based on contactType
                ...(contactType === 'whatsapp'
                    ? { phone: identifier }
                    : { discordId: identifier }
                ),
                contactType,
                platform,
                conversation,
                agentId
            })

            setGeneratedContext(res.data.generatedContext || '')
            setSuccess(true)
            setTimeout(() => {
                handleClose()
                onSuccess?.()
            }, 1500)

        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading) {
            onOpenChange(false)
            // Reset after animation
            setTimeout(() => {
                setContactType('whatsapp')
                setIdentifier('')
                setPlatform('')
                setConversation('')
                setSuccess(false)
                setGeneratedContext('')
                setError('')
            }, 300)
        }
    }

    return (
        <Sheet open={open} onOpenChange={handleClose}>
            <SheetContent
                side="bottom"
                className="h-[90vh] rounded-t-[30px] border-white/10 bg-[#0f172a] p-0 overflow-hidden"
            >
                <div className="flex flex-col h-full">
                    {/* Drag Handle */}
                    <div className="w-12 h-1 rounded-full bg-white/10 mx-auto mt-3 mb-2" />

                    {/* Header */}
                    <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            <h2 className="text-xl font-bold text-white">Smart Add</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClose}
                            disabled={loading}
                            className="h-8 w-8 rounded-full text-white/40"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {success ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Check className="h-10 w-10 text-green-400" />
                            </div>
                            <p className="text-white font-semibold text-lg">Contact Added!</p>
                            {generatedContext && (
                                <div className="mt-4 p-4 bg-white/5 rounded-xl max-w-sm w-full">
                                    <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Extracted Context:</p>
                                    <p className="text-white/80 text-sm line-clamp-4">{generatedContext}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Form */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                                {/* Contact Type Selector */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Contact Type</label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            onClick={() => setContactType('whatsapp')}
                                            disabled={loading}
                                            className={`flex-1 h-12 rounded-xl font-semibold transition-all ${contactType === 'whatsapp'
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-white/5 hover:bg-white/10 text-white/50'
                                                }`}
                                        >
                                            <MessageCircle className="h-4 w-4 mr-2" />
                                            WhatsApp
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => setContactType('discord')}
                                            disabled={loading}
                                            className={`flex-1 h-12 rounded-xl font-semibold transition-all ${contactType === 'discord'
                                                    ? 'bg-[#5865F2] hover:bg-[#4752C4] text-white'
                                                    : 'bg-white/5 hover:bg-white/10 text-white/50'
                                                }`}
                                        >
                                            <DiscordIcon className="h-4 w-4 mr-2" />
                                            Discord
                                        </Button>
                                    </div>
                                </div>

                                {/* Identifier (Phone or Discord Username) */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">
                                        {contactType === 'whatsapp' ? 'Phone Number' : 'Discord Username'}
                                    </label>
                                    <Input
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder={contactType === 'whatsapp' ? '+33612345678' : 'username or user#1234'}
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 h-12"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Platform (where conversation happened) */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Original Platform</label>
                                    <Input
                                        value={platform}
                                        onChange={(e) => setPlatform(e.target.value)}
                                        placeholder="Instagram, Telegram, Discord..."
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 h-12"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Conversation */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/30">Conversation</label>
                                    <Textarea
                                        value={conversation}
                                        onChange={(e) => setConversation(e.target.value)}
                                        placeholder="Paste the chat here..."
                                        className="bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/20 min-h-[200px] text-sm"
                                        disabled={loading}
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-400 text-sm text-center">{error}</p>
                                )}
                            </div>

                            {/* Submit Button (Sticky Bottom) */}
                            <div className="p-6 pt-0 pb-28">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading || !identifier || !platform || !conversation}
                                    className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-base disabled:opacity-40"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5 mr-2" />
                                            Smart Add
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
