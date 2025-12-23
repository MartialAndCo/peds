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

interface PromptFormProps {
    initialData?: any
}

export function PromptForm({ initialData }: PromptFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        system_prompt: initialData?.system_prompt || '',
        model: initialData?.model || 'venice-uncensored',
        temperature: initialData?.temperature || 0.7,
        max_tokens: initialData?.max_tokens || 500
    })

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            if (initialData) {
                await axios.put(`/api/prompts/${initialData.id}`, formData)
            } else {
                await axios.post('/api/prompts', formData)
            }
            router.push('/prompts')
            router.refresh()
        } catch (error: any) {
            console.error(error)
            const serverError = error.response?.data?.error
            if (Array.isArray(serverError)) {
                // Zod array of issues
                const messages = serverError.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('\n')
                alert(`Validation Error:\n${messages}`)
            } else if (typeof serverError === 'string') {
                alert(`Error: ${serverError}`)
            } else {
                alert('Something went wrong')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{initialData ? 'Edit Prompt' : 'Create Prompt'}</CardTitle>
            </CardHeader>
            <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            disabled={loading}
                            placeholder="e.g. Sales Assistant"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>System Prompt</Label>
                        <Textarea
                            disabled={loading}
                            placeholder="You are a helpful assistant..."
                            value={formData.system_prompt}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            className="h-40"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label>Model</Label>
                            <Select
                                disabled={loading}
                                onValueChange={(val) => setFormData({ ...formData, model: val })}
                                defaultValue={formData.model}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="venice-uncensored">venice-uncensored</SelectItem>
                                    <SelectItem value="llama-3-8b">llama-3-8b</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Temperature ({formData.temperature})</Label>
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                disabled={loading}
                                value={formData.temperature}
                                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Max Tokens</Label>
                            <Input
                                type="number"
                                disabled={loading}
                                value={formData.max_tokens}
                                onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button disabled={loading} type="submit">
                        {initialData ? 'Save Changes' : 'Create Prompt'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
