"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Play, Loader2, CalendarIcon, User } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { launchScenario } from "@/app/actions/scenarios"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { getContactDisplayName } from "@/lib/contact-display"

export default function LaunchScenarioPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const scenarioId = params.id as string

    const [isLoading, setIsLoading] = useState(true)
    const [scenario, setScenario] = useState<any>(null)
    const [contacts, setContacts] = useState<any[]>([])

    // Form state
    const [selectedContactId, setSelectedContactId] = useState<string>("")
    const [scheduleType, setScheduleType] = useState<"now" | "later">("now")
    const [scheduledDate, setScheduledDate] = useState<string>("")
    const [scheduledTime, setScheduledTime] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Scenario
                const resScen = await fetch(`/api/scenarios/${scenarioId}`)
                if (resScen.ok) {
                    const data = await resScen.json()
                    setScenario(data.scenario)
                }

                // Fetch Contacts (ideally from an API, we'll fetch just active ones)
                const resCont = await fetch(`/api/contacts`)
                if (resCont.ok) {
                    const data = await resCont.json()
                    // Filter to active contacts to make list manageable, or just show all
                    setContacts(Array.isArray(data) ? data : (data.contacts || []))
                }
            } catch (e) {
                console.error("Failed to load data", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [scenarioId])

    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedContactId) {
            toast({ title: "Validation Error", description: "You must select a target contact.", variant: "destructive" })
            return
        }

        let startTime = new Date()
        if (scheduleType === 'later') {
            if (!scheduledDate || !scheduledTime) {
                toast({ title: "Validation Error", description: "Date and Time are required for scheduled launch.", variant: "destructive" })
                return
            }
            startTime = new Date(`${scheduledDate}T${scheduledTime}`)
        }

        if (startTime < new Date() && scheduleType === 'later') {
            toast({ title: "Validation Error", description: "Scheduled time cannot be in the past.", variant: "destructive" })
            return
        }

        setIsSubmitting(true)
        const result = await launchScenario(scenarioId, selectedContactId, startTime)
        setIsSubmitting(false)

        if (result.success) {
            toast({
                title: "Scenario Scheduled",
                description: scheduleType === 'now' ? "The scenario will start immediately via the scheduler." : `Scheduled for ${format(startTime, 'PP p')}`
            })
            router.push(`/admin/scenarios`)
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    if (isLoading) return <div className="p-6 text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div>
    if (!scenario) return <div className="p-6 text-red-400">Scenario not found.</div>

    return (
        <div className="space-y-8 p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href={`/admin/scenarios/${scenarioId}`}>
                    <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Deploy Scenario: {scenario.title}</h1>
                    <p className="text-white/40">Select a target and schedule the event.</p>
                </div>
            </div>

            <Card className="bg-[#1e293b] border-white/10 text-white">
                <CardHeader>
                    <CardTitle>Launch Configuration</CardTitle>
                    <CardDescription className="text-white/40">
                        The AI will instantly switch persona to simulate the crisis for the targeted contact.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLaunch} className="space-y-8">

                        {/* Target Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-400" /> Target Contact
                            </label>
                            <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                                <SelectTrigger className="w-full bg-[#0f172a] border-white/10 text-white h-12">
                                    <SelectValue placeholder="Select a contact to target..." />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1e293b] border-white/10 text-white max-h-[300px]">
                                    {contacts.map((contact) => {
                                        const displayName = getContactDisplayName(contact, 'Unnamed Contact')
                                        return (
                                        <SelectItem key={contact.id} value={contact.id}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{displayName}</span>
                                                <span className="text-xs text-white/40">{contact.phone_whatsapp}</span>
                                            </div>
                                        </SelectItem>
                                        )
                                    })}
                                    {contacts.length === 0 && (
                                        <div className="p-2 text-sm text-white/40">No contacts available.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Timing Configuration */}
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <label className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-amber-400" /> Timing
                            </label>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setScheduleType("now")}
                                    className={`flex-1 p-4 rounded-xl border ${scheduleType === 'now' ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-[#0f172a]'} transition-all text-left`}
                                >
                                    <div className="font-semibold text-white mb-1">Immediate Launch</div>
                                    <div className="text-xs text-white/50">Triggers as soon as the next scheduler tick runs (usually within 1 minute).</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScheduleType("later")}
                                    className={`flex-1 p-4 rounded-xl border ${scheduleType === 'later' ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 bg-[#0f172a]'} transition-all text-left`}
                                >
                                    <div className="font-semibold text-white mb-1">Schedule for Later</div>
                                    <div className="text-xs text-white/50">Set a specific date and time to silently start the scenario.</div>
                                </button>
                            </div>

                            {scheduleType === 'later' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/60">Date</label>
                                        <Input
                                            type="date"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            className="bg-[#0f172a] border-white/10 text-white"
                                            required={scheduleType === 'later'}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/60">Time</label>
                                        <Input
                                            type="time"
                                            value={scheduledTime}
                                            onChange={(e) => setScheduledTime(e.target.value)}
                                            className="bg-[#0f172a] border-white/10 text-white"
                                            required={scheduleType === 'later'}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-6 border-t border-white/10">
                            <Button
                                type="submit"
                                disabled={isSubmitting || !selectedContactId}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 h-12 text-lg shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Play className="w-5 h-5 mr-3 fill-current" />}
                                Deploy Scenario
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
