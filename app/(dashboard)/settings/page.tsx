'use client'

import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({
        waha_endpoint: '',
        waha_session: 'default',
        waha_api_key: '',
        venice_api_key: '',
        venice_model: 'venice-uncensored',
        anthropic_api_key: '',
        anthropic_model: 'claude-3-haiku-20240307',
        ai_provider: 'venice'
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [wahaStatus, setWahaStatus] = useState<string>('UNKNOWN')
    const [wahaMe, setWahaMe] = useState<any>(null)

    const fetchSettings = useCallback(() => {
        axios.get('/api/settings').then(res => {
            setSettings((prev: any) => ({ ...prev, ...res.data }))
            setLoading(false)
        }).catch(e => console.error(e))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    // Poll WAHA Status
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await axios.get('/api/waha/status')
                let status = res.data.status || 'UNREACHABLE'
                if (status === 'SCAN_QR_CODE') status = 'SCAN_QR'

                setWahaStatus(status)
                setWahaMe(res.data.me)
            } catch (e: any) {
                setWahaStatus('UNREACHABLE')
            }
        }

        checkStatus()
        const interval = setInterval(checkStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put('/api/settings', settings)
            alert('Settings saved')
        } catch (error) {
            alert('Error saving settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>

            <form onSubmit={handleSave} className="space-y-6">

                {/* WAHA Status Card */}
                <Card className="border-2 border-blue-50">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>WhatsApp Connection Status</CardTitle>
                            <Badge variant={wahaStatus === 'WORKING' ? 'default' : 'destructive'}>
                                {wahaStatus}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col items-center justify-center min-h-[150px]">
                        {wahaStatus === 'SCAN_QR' && (
                            <div className="text-center space-y-2">
                                <p className="font-medium">Scan this QR Code with WhatsApp</p>
                                <img
                                    src="/api/waha/qr"
                                    alt="WhatsApp QR Code"
                                    className="w-64 h-64 border rounded-md"
                                />
                                <div className="pt-4">
                                    <Button variant="destructive" onClick={async () => {
                                        setWahaStatus('STOPPING')
                                        try {
                                            await axios.post('/api/session/stop')
                                            setWahaStatus('STOPPED')
                                        } catch (e: any) {
                                            alert('Failed to stop session')
                                            setWahaStatus('UNKNOWN')
                                        }
                                    }}>
                                        Stop Session
                                    </Button>
                                </div>
                            </div>
                        )}
                        {wahaStatus === 'WORKING' && wahaMe && (
                            <div className="text-center text-green-600 space-y-4">
                                <div>
                                    <p className="text-xl font-bold">Connected!</p>
                                    <p>{wahaMe.pushName || 'WhatsApp User'}</p>
                                    <p className="text-sm opacity-70">{wahaMe.id}</p>
                                </div>
                                <Button variant="destructive" onClick={async () => {
                                    setWahaStatus('STOPPING')
                                    try {
                                        await axios.post('/api/session/stop')
                                        setWahaStatus('STOPPED')
                                    } catch (e: any) {
                                        alert('Failed to stop session')
                                        setWahaStatus('UNKNOWN')
                                    }
                                }}>
                                    Stop Session
                                </Button>
                            </div>
                        )}
                        {wahaStatus === 'UNREACHABLE' && (
                            <div className="text-center text-red-500">
                                <p>Cannot connect to WAHA Server.</p>
                                <p className="text-xs">Ensure WAHA is running at {settings.waha_endpoint || 'http://localhost:3001'}</p>
                            </div>
                        )}
                        {wahaStatus === 'STOPPED' && (
                            <div className="text-center text-orange-500 space-y-4">
                                <p>Session is currently stopped.</p>
                                <Button onClick={async () => {
                                    setWahaStatus('STARTING')
                                    try {
                                        const res = await axios.post('/api/session/start')
                                        // Status should update on next poll
                                    } catch (e: any) {
                                        const msg = e.response?.data?.error || e.message
                                        alert(`Failed to start session: ${msg}`)
                                        setWahaStatus('STOPPED')
                                    }
                                }}>
                                    Start Session
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Global AI Provider</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Button
                                type="button"
                                variant={settings.ai_provider === 'venice' ? 'default' : 'outline'}
                                onClick={() => setSettings({ ...settings, ai_provider: 'venice' })}
                                className="w-1/2"
                            >
                                Venice AI
                            </Button>
                            <Button
                                type="button"
                                variant={settings.ai_provider === 'anthropic' ? 'default' : 'outline'}
                                onClick={() => setSettings({ ...settings, ai_provider: 'anthropic' })}
                                className="w-1/2"
                            >
                                Anthropic
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {settings.ai_provider === 'venice' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Venice AI Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={settings.venice_api_key}
                                    onChange={(e) => setSettings({ ...settings, venice_api_key: e.target.value })}
                                    placeholder="sk-..."
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Default Model</Label>
                                <Input
                                    value={settings.venice_model}
                                    onChange={(e) => setSettings({ ...settings, venice_model: e.target.value })}
                                    placeholder="venice-uncensored"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {settings.ai_provider === 'anthropic' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Anthropic Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>API Key</Label>
                                <Input
                                    type="password"
                                    value={settings.anthropic_api_key}
                                    onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                                    placeholder="sk-ant-..."
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Default Model</Label>
                                <Input
                                    value={settings.anthropic_model}
                                    onChange={(e) => setSettings({ ...settings, anthropic_model: e.target.value })}
                                    placeholder="claude-3-haiku-20240307"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Voice Generation Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Voice Provider</Label>
                            <Select
                                value={settings.voice_provider || 'elevenlabs'}
                                onValueChange={(val) => setSettings({ ...settings, voice_provider: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                    <SelectItem value="cartesia">Cartesia AI (Faster)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {settings.voice_provider === 'cartesia' ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="cartesia_api_key">Cartesia API Key</Label>
                                    <Input
                                        id="cartesia_api_key"
                                        type="password"
                                        value={settings.cartesia_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, cartesia_api_key: e.target.value })}
                                        placeholder="sk_cartesia_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cartesia_voice_id">Cartesia Voice ID</Label>
                                    <Input
                                        id="cartesia_voice_id"
                                        value={settings.cartesia_voice_id || ''}
                                        onChange={(e) => setSettings({ ...settings, cartesia_voice_id: e.target.value })}
                                        placeholder="e.g. e8e5fffb-..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cartesia_model_id">Cartesia Model ID</Label>
                                    <Input
                                        id="cartesia_model_id"
                                        value={settings.cartesia_model_id || 'sonic-english'}
                                        onChange={(e) => setSettings({ ...settings, cartesia_model_id: e.target.value })}
                                        placeholder="sonic-english or sonic-multilingual"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <Label htmlFor="elevenlabs_api_key">ElevenLabs API Key</Label>
                                    <Input
                                        id="elevenlabs_api_key"
                                        type="password"
                                        value={settings.elevenlabs_api_key || ''}
                                        onChange={(e) => setSettings({ ...settings, elevenlabs_api_key: e.target.value })}
                                        placeholder="xi-..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="elevenlabs_voice_id">ElevenLabs Voice ID</Label>
                                    <Input
                                        id="elevenlabs_voice_id"
                                        value={settings.elevenlabs_voice_id || ''}
                                        onChange={(e) => setSettings({ ...settings, elevenlabs_voice_id: e.target.value })}
                                        placeholder="21m00Tcm4TlvDq8ikWAM"
                                    />
                                    <p className="text-xs text-muted-foreground">Default: Rachel</p>
                                </div>
                            </>
                        )}

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="voice_enabled"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={settings.voice_response_enabled === 'true' || settings.voice_response_enabled === true}
                                onChange={(e) => setSettings({ ...settings, voice_response_enabled: e.target.checked })}
                            />
                            <Label htmlFor="voice_enabled">Enable Voice Replies (Reply Voice if Incoming Voice)</Label>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>WAHA Configuration (WhatsApp)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label>Endpoint URL</Label>
                            <Input
                                value={settings.waha_endpoint}
                                onChange={(e) => setSettings({ ...settings, waha_endpoint: e.target.value })}
                                placeholder="http://localhost:3001"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>API Key</Label>
                            <Input
                                value={settings.waha_api_key}
                                type="password"
                                onChange={(e) => setSettings({ ...settings, waha_api_key: e.target.value })}
                                placeholder="secret"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Session Name</Label>
                            <Input
                                value={settings.waha_session}
                                onChange={(e) => setSettings({ ...settings, waha_session: e.target.value })}
                                placeholder="default"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pb-10">
                    <Button type="submit" disabled={saving || loading}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
