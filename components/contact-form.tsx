'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ContactFormProps {
    initialData?: any
}

export function ContactForm({ initialData }: ContactFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        phone_whatsapp: initialData?.phone_whatsapp || '',
        source: initialData?.source || 'Manual',
        notes: initialData?.notes || '',
        status: initialData?.status || 'new'
    })

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (initialData) {
                await axios.put(`/api/contacts/${initialData.id}`, formData)
            } else {
                await axios.post('/api/contacts', formData)
            }
            router.push('/contacts')
            router.refresh()
        } catch (error: any) {
            console.error(error)
            alert(error.response?.data?.error || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{initialData ? 'Edit Contact' : 'Create Contact'}</CardTitle>
            </CardHeader>
            <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            disabled={loading}
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>WhatsApp Number</Label>
                        <Input
                            disabled={loading}
                            placeholder="+33612345678"
                            value={formData.phone_whatsapp}
                            onChange={(e) => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                            required // format +...
                        />
                        <p className="text-xs text-gray-500">Format: +33612345678 (International)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Source</Label>
                            <Input
                                disabled={loading}
                                placeholder="LinkedIn, Instagram..."
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Status</Label>
                            <Select
                                disabled={loading}
                                onValueChange={(val) => setFormData({ ...formData, status: val })}
                                defaultValue={formData.status}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="qualified">Qualified</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Notes</Label>
                        <Textarea
                            disabled={loading}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="h-20"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button disabled={loading} type="submit">
                        {initialData ? 'Save Changes' : 'Create Contact'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
