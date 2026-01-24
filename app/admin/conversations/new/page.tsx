'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function NewConversationForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const preSelectedContactId = searchParams.get('contact_id')

    const [contacts, setContacts] = useState<any[]>([])
    const [prompts, setPrompts] = useState<any[]>([])

    const [selectedContact, setSelectedContact] = useState('')
    const [selectedPrompt, setSelectedPrompt] = useState('')
    const [initialMessage, setInitialMessage] = useState('Bonjour ! Comment puis-je vous aider ?')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (preSelectedContactId) setSelectedContact(preSelectedContactId)
    }, [preSelectedContactId])

    useEffect(() => {
        axios.get('/api/contacts').then(res => setContacts(res.data))
        axios.get('/api/prompts').then(res => {
            setPrompts(res.data)
            if (res.data.length > 0) setSelectedPrompt(String(res.data[0].id))
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await axios.post('/api/conversations', {
                contact_id: parseInt(selectedContact),
                prompt_id: parseInt(selectedPrompt),
                initial_message: initialMessage
            })
            router.push(`/admin/conversations`)
        } catch (error: any) {
            console.error(error)
            alert('Error creating conversation')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1">
                        <Label>Contact</Label>
                        <Select
                            value={selectedContact}
                            onValueChange={setSelectedContact}
                            disabled={!!preSelectedContactId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {contacts.map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.phone_whatsapp})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label>Prompt System</Label>
                        <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select prompt" />
                            </SelectTrigger>
                            <SelectContent>
                                {prompts.map(p => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label>Initial Message (sent immediately)</Label>
                        <Textarea
                            value={initialMessage}
                            onChange={(e) => setInitialMessage(e.target.value)}
                            className="h-24"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={loading || !selectedContact || !selectedPrompt} className="w-full">
                        Start & Send Message
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}

export default function NewConversationPage() {
    return (
        <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">Start Conversation</h2>
            <Suspense fallback={<div>Loading...</div>}>
                <NewConversationForm />
            </Suspense>
        </div>
    )
}
