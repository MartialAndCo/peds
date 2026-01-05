'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { ContactForm } from "@/components/contact-form"
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PlayCircle, AlertTriangle, Trash2, EyeOff, Zap } from 'lucide-react'

export default function EditContactPage() {
    const params = useParams()
    const router = useRouter()
    const [contact, setContact] = useState<any>(null)
    const [conversation, setConversation] = useState<any>(null)
    const [context, setContext] = useState('')
    const [activating, setActivating] = useState(false)

    useEffect(() => {
        if (params.id) {
            axios.get(`/api/contacts/${params.id}`)
                .then(res => {
                    setContact(res.data)
                    setContext(res.data.notes || '')
                    // Ideally API should return conversation status too, or we fetch conversation separately.
                    // Assuming contact includes conversation or we fetch it.
                    // Let's assume the API returns conversations array.
                    const activeConv = res.data.conversations?.[0]
                    setConversation(activeConv)
                })
                .catch(err => console.error(err))
        }
    }, [params.id])

    const handleActivate = async () => {
        if (!conversation) return
        setActivating(true)
        try {
            await axios.post(`/api/conversations/${conversation.id}/activate`, {
                context: context
            })
            alert('Activated! AI should reply shortly.')
            window.location.reload()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setActivating(false)
        }
    }

    const handleUpdateSettings = async (updates: any) => {
        try {
            setContact({ ...contact, ...updates }) // Optimistic UI
            await axios.put(`/api/contacts/${contact.id}`, updates)
        } catch (e: any) {
            alert('Failed to update settings: ' + e.message)
        }
    }

    const handleDelete = async () => {
        if (!confirm("ATTENTION: Cela va supprimer DÉFINITIVEMENT ce contact et TOUTES ses conversations, messages, et souvenirs. Cette action est irréversible. Continuer ?")) return;

        try {
            await axios.delete(`/api/contacts/${contact.id}`)
            router.push('/contacts')
        } catch (e: any) {
            alert('Delete failed: ' + e.message)
        }
    }

    if (!contact) return <div className="p-8 text-center animate-pulse">Loading contact data...</div>

    const isPaused = conversation?.status === 'paused'

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{contact.name || 'Unknown'}</h2>
                    <p className="text-muted-foreground">{contact.phone_whatsapp}</p>
                </div>
                <div className="flex space-x-2">
                    <Badge variant={isPaused ? "destructive" : "default"} className="text-lg px-4 py-1">
                        {conversation?.status?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                </div>
            </div>

            {/* SETTINGS CARD (testMode, isHidden, Delete) */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        Paramètres Avancés
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-500" />
                                Mode Test (Réponse Instantanée)
                            </Label>
                            <p className="text-sm text-slate-500">
                                Ignore les délais (délai de réflexion, écriture) pour tester rapidement l'IA.
                            </p>
                        </div>
                        <Switch
                            checked={contact?.testMode || false}
                            onCheckedChange={(checked) => handleUpdateSettings({ testMode: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                                <EyeOff className="h-4 w-4 text-slate-500" />
                                Masquer des listes
                            </Label>
                            <p className="text-sm text-slate-500">
                                Cache ce numéro du Dashboard (ex: Numéro source de Leads).
                            </p>
                        </div>
                        <Switch
                            checked={contact?.isHidden || false}
                            onCheckedChange={(checked) => handleUpdateSettings({ isHidden: checked })}
                        />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <Button variant="destructive" size="sm" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer Définitivement (Deep Clean)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* COLD START ACTIVATION PANEL */}
            {isPaused && (
                <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <h4 className="text-orange-800 font-bold ml-2">Context Required</h4>
                    </div>
                    <p className="mt-2 text-orange-700 text-sm">
                        This conversation is PAUSED. The AI will not reply until you activate it.
                        <br />
                        Please add context below (e.g. "We met on Instagram, he thinks I'm 16") so the AI knows how to start.
                    </p>

                    <div className="mt-4 space-y-3">
                        <Textarea
                            placeholder="Enter context/backstory here..."
                            className="bg-white dark:bg-black min-h-[100px]"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                        />
                        <Button
                            onClick={handleActivate}
                            disabled={activating || !context.trim()}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
                        >
                            {activating ? 'Activating...' : (
                                <>
                                    <PlayCircle className="mr-2 h-5 w-5" />
                                    Activate & Reply
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
                    <CardContent>
                        <ContactForm initialData={contact} />
                    </CardContent>
                </Card>

                {/* If active, just show standard notes */}
                {!isPaused && (
                    <Card>
                        <CardHeader><CardTitle>Notes & Context</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Internal notes..."
                                className="min-h-[200px]"
                            />
                            <Button onClick={async () => {
                                await axios.put(`/api/contacts/${contact.id}`, { notes: context })
                                alert('Notes saved')
                            }}>Save Notes</Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
