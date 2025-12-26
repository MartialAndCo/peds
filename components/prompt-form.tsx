'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface PromptFormProps {
    initialData?: any
}

export function PromptForm({ initialData }: PromptFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState<any>({})
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        system_prompt: initialData?.system_prompt || '',
        model: initialData?.model || 'venice-uncensored',
        temperature: initialData?.temperature?.toString() || '0.7',
        max_tokens: initialData?.max_tokens || 500,
        isActive: initialData?.isActive || false
    })

    useEffect(() => {
        axios.get('/api/settings').then(res => {
            setSettings(res.data)
        }).catch(console.error)
    }, [])

    const getAvailableModels = () => {
        const models: string[] = []
        if (settings.venice_api_key) {
            models.push('venice-uncensored', 'llama-3-8b', 'llama-3-70b')
        }
        if (settings.anthropic_api_key) {
            models.push('claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229')
        }
        // Fallback if nothing configured or just default
        if (models.length === 0) {
            models.push('venice-uncensored')
        }
        return Array.from(new Set(models))
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = {
                ...formData,
                temperature: parseFloat(formData.temperature.replace(',', '.')),
                max_tokens: Number(formData.max_tokens)
            }
            if (initialData) {
                await axios.put(`/api/prompts/${initialData.id}`, payload)
            } else {
                await axios.post('/api/prompts', payload)
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

    const availableModels = getAvailableModels()

    return (
        <Card>
            <CardHeader>
                <CardTitle>{initialData ? 'Edit Prompt' : 'Create Prompt'}</CardTitle>
            </CardHeader>
            <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between border pl-4 pr-4 pt-2 pb-2 rounded-md">
                        <Label htmlFor="active-mode" className="font-semibold">Active Prompt</Label>
                        <Switch
                            id="active-mode"
                            checked={formData.isActive}
                            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            disabled={loading}
                        />
                    </div>

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
                    {/* Dynamic Prompt Info Banner */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    <span className="font-bold">Dynamic Prompting Enabled 🧠</span>
                                    <br />
                                    This prompt is now part of the <strong>State-Aware Director</strong>.
                                    <br />
                                    The text below is used strictly as the <strong>Base Identity (&#123;&#123;ROLE&#125;&#125;)</strong>.
                                    The Context, Mission, and Global Rules are injected dynamically based on the relationship phase.
                                    <br />
                                    <a href="/settings" className="underline font-bold hover:text-blue-900">Configure Templates in Settings &rarr;</a>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Base Role / Identity</Label>
                        <p className="text-xs text-muted-foreground pb-1">
                            Defines the core personality (e.g. "You are Julien, 30yo..."). This replaces the &#123;&#123;ROLE&#125;&#125; placeholder.
                        </p>
                        <Textarea
                            disabled={loading}
                            placeholder="You are a helpful assistant..."
                            value={formData.system_prompt}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            className="h-40 font-mono text-sm"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label>Model</Label>
                            <Select
                                disabled={loading}
                                onValueChange={(val) => setFormData({ ...formData, model: val })}
                                value={formData.model}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Temperature ({formData.temperature})</Label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                disabled={loading}
                                value={formData.temperature}
                                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
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
