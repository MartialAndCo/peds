'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { 
    Loader2, 
    PlusCircle, 
    CheckCircle2, 
    AlertCircle,
    MessageCircle,
    Gamepad2,
    RefreshCcw
} from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

interface DuplicateCheck {
    exists: boolean
    type?: 'LEAD' | 'CONTACT'
    leadId?: string
    status?: string
    addedBy?: string
    agent?: string
    createdAt?: string
}

export default function AddLeadPage() {
    const [form, setForm] = useState({
        type: 'WHATSAPP' as 'WHATSAPP' | 'DISCORD',
        identifier: '',
        age: '',
        location: '',
        source: '',
        context: ''
    })
    
    const [isChecking, setIsChecking] = useState(false)
    const [duplicate, setDuplicate] = useState<DuplicateCheck | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [overwrite, setOverwrite] = useState(false)

    const debouncedIdentifier = useDebounce(form.identifier, 500)

    // Check for duplicates
    useEffect(() => {
        if (debouncedIdentifier.length < 3) {
            setDuplicate(null)
            return
        }

        const checkDuplicate = async () => {
            setIsChecking(true)
            try {
                const res = await fetch(`/api/provider/check-duplicate?identifier=${encodeURIComponent(debouncedIdentifier)}&type=${form.type}`)
                if (res.ok) {
                    const data = await res.json()
                    setDuplicate(data)
                }
            } catch (error) {
                console.error('Duplicate check error:', error)
            } finally {
                setIsChecking(false)
            }
        }

        checkDuplicate()
    }, [debouncedIdentifier, form.type])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')
        setSuccess(false)

        try {
            const res = await fetch('/api/provider/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    age: form.age ? parseInt(form.age) : undefined,
                    overwrite
                })
            })

            if (res.ok) {
                setSuccess(true)
                setForm({
                    type: 'WHATSAPP',
                    identifier: '',
                    age: '',
                    location: '',
                    source: '',
                    context: ''
                })
                setDuplicate(null)
                setOverwrite(false)
            } else {
                const data = await res.json()
                if (data.error === 'DUPLICATE') {
                    setError('This lead already exists in the system')
                    setDuplicate({
                        exists: true,
                        type: 'LEAD',
                        status: data.status,
                        leadId: data.leadId,
                        agent: data.agent
                    })
                } else {
                    setError(data.error || data.message || 'Failed to add lead')
                }
            }
        } catch (error) {
            setError('Network error. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setForm({
            type: 'WHATSAPP',
            identifier: '',
            age: '',
            location: '',
            source: '',
            context: ''
        })
        setDuplicate(null)
        setSuccess(false)
        setError('')
        setOverwrite(false)
    }

    return (
        <div className="max-w-lg mx-auto pb-24">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Add New Lead</h2>
                <p className="text-slate-400 mt-1">Enter lead information below</p>
            </div>

            {success ? (
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Lead Added!</h3>
                        <p className="text-slate-400 mb-6">
                            The lead has been successfully imported into the system.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Add Another
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selector */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <Label className="text-slate-300 mb-3 block">Lead Type</Label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: 'WHATSAPP', identifier: '' }))}
                                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                        form.type === 'WHATSAPP'
                                            ? 'bg-green-500/20 border-green-500 text-green-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    <span className="font-medium">WhatsApp</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, type: 'DISCORD', identifier: '' }))}
                                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                        form.type === 'DISCORD'
                                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <Gamepad2 className="w-5 h-5" />
                                    <span className="font-medium">Discord</span>
                                </button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Duplicate Warning */}
                    {duplicate?.exists && (
                        <Alert className="bg-yellow-500/10 border-yellow-500/50">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <AlertDescription className="text-yellow-200">
                                <div className="flex flex-col gap-2">
                                    <p>
                                        This {duplicate.type?.toLowerCase()} already exists in the system
                                        {duplicate.addedBy && ` (added by ${duplicate.addedBy})`}
                                        {duplicate.agent && ` for agent ${duplicate.agent}`}.
                                        <button 
                                            type="button"
                                            onClick={() => window.location.href = '/provider/history'}
                                            className="underline ml-1 hover:text-yellow-300"
                                        >
                                            View in history
                                        </button>
                                    </p>
                                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                                        <input
                                            type="checkbox"
                                            checked={overwrite}
                                            onChange={(e) => setOverwrite(e.target.checked)}
                                            className="rounded border-yellow-500/50 bg-yellow-500/10 text-yellow-500 focus:ring-yellow-500"
                                        />
                                        <span className="text-sm">Overwrite existing lead and all associated data</span>
                                    </label>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Main Form */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Lead Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Identifier */}
                            <div className="relative">
                                <Label htmlFor="identifier" className="text-slate-300">
                                    {form.type === 'WHATSAPP' ? 'Phone Number' : 'Discord Username'}
                                </Label>
                                <Input
                                    id="identifier"
                                    value={form.identifier}
                                    onChange={(e) => setForm(f => ({ ...f, identifier: e.target.value }))}
                                    placeholder={form.type === 'WHATSAPP' ? '+33612345678' : 'username#1234'}
                                    className="bg-slate-800 border-slate-700 text-white mt-1.5"
                                    required
                                />
                                {isChecking && (
                                    <Loader2 className="w-4 h-4 text-slate-500 absolute right-3 top-9 animate-spin" />
                                )}
                            </div>

                            {/* Age & Location */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="age" className="text-slate-300">Age</Label>
                                    <Input
                                        id="age"
                                        type="number"
                                        value={form.age}
                                        onChange={(e) => setForm(f => ({ ...f, age: e.target.value }))}
                                        placeholder="25"
                                        min={18}
                                        max={100}
                                        className="bg-slate-800 border-slate-700 text-white mt-1.5"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="location" className="text-slate-300">Location</Label>
                                    <Input
                                        id="location"
                                        value={form.location}
                                        onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                                        placeholder="Paris, France"
                                        className="bg-slate-800 border-slate-700 text-white mt-1.5"
                                    />
                                </div>
                            </div>

                            {/* Source */}
                            <div>
                                <Label htmlFor="source" className="text-slate-300">Source *</Label>
                                <Input
                                    id="source"
                                    value={form.source}
                                    onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))}
                                    placeholder="Where did you find this lead?"
                                    className="bg-slate-800 border-slate-700 text-white mt-1.5"
                                    required
                                />
                            </div>

                            {/* Context */}
                            <div>
                                <Label htmlFor="context" className="text-slate-300">Context</Label>
                                <Textarea
                                    id="context"
                                    value={form.context}
                                    onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))}
                                    placeholder="How did the conversation start? Any important details?"
                                    rows={3}
                                    className="bg-slate-800 border-slate-700 text-white mt-1.5 resize-none"
                                />
                            </div>


                        </CardContent>
                    </Card>

                    {/* Error */}
                    {error && (
                        <Alert className="bg-red-500/10 border-red-500/50">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <AlertDescription className="text-red-200">{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Submit */}
                    <Button 
                        type="submit" 
                        className={`w-full h-12 text-lg ${overwrite && duplicate?.exists ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        disabled={isSubmitting || (duplicate?.exists && !overwrite)}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                {overwrite ? 'Overwriting...' : 'Adding Lead...'}
                            </>
                        ) : overwrite && duplicate?.exists ? (
                            <>
                                <RefreshCcw className="w-5 h-5 mr-2" />
                                Overwrite Existing Lead
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-5 h-5 mr-2" />
                                Add Lead
                            </>
                        )}
                    </Button>

                    {duplicate?.exists && !overwrite && (
                        <p className="text-center text-sm text-slate-500">
                            Check "Overwrite" above to replace the existing lead and all associated data.
                        </p>
                    )}
                </form>
            )}
        </div>
    )
}
