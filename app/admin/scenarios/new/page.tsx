"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { createScenario } from "@/app/actions/scenarios"

export default function NewScenarioPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        targetContext: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title || !formData.description) {
            toast({ title: "Validation Error", description: "Title and description are required.", variant: "destructive" })
            return
        }

        setIsLoading(true)
        const result = await createScenario(formData)
        setIsLoading(false)

        if (result.success && result.scenarioId) {
            toast({ title: "Scenario created", description: "You can now add media and launch it." })
            router.push(`/admin/scenarios/${result.scenarioId}`) // Redirect to details page to add media
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" })
        }
    }

    return (
        <div className="space-y-8 p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/admin/scenarios">
                    <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">Create New Scenario</h1>
                    <p className="text-white/40">Design a new catastrophe or event</p>
                </div>
            </div>

            <Card className="bg-[#1e293b] border-white/10 text-white">
                <CardHeader>
                    <CardTitle>Scenario Details</CardTitle>
                    <CardDescription className="text-white/40">
                        Define the story the AI will roleplay.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Title</label>
                            <Input
                                placeholder="e.g., Inondation soudaine, Accident de voiture..."
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Main Description (Context)</label>
                            <p className="text-xs text-white/40 mb-2">This is the core event you are living right now.</p>
                            <Textarea
                                placeholder="Tout mon appartement est inondé, je viens de me réveiller avec de l'eau jusqu'aux chevilles..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white min-h-[120px]"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Target Context / Directives (Optional)</label>
                            <p className="text-xs text-white/40 mb-2">Instructions on how to behave, what to ask for (e.g., ask for money for a hotel room).</p>
                            <Textarea
                                placeholder="Sois paniquée. Dis que l'assurance ne répond pas. Demande si on peut t'avancer 150€ pour payer une chambre d'hôtel en urgence ce soir."
                                value={formData.targetContext}
                                onChange={(e) => setFormData(prev => ({ ...prev, targetContext: e.target.value }))}
                                className="bg-[#0f172a] border-white/10 text-white min-h-[120px]"
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <Button type="submit" disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save & Continue
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
