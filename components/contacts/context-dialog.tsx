'use client'

import { useState } from 'react'
import axios from 'axios'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sparkles, Loader2 } from 'lucide-react'

export function ContextDialog({ contact, open, onOpenChange, onSaved }: any) {
    const [notes, setNotes] = useState(contact?.notes || '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await axios.put(`/api/contacts/${contact.id}`, {
                notes: notes
            })
            onSaved()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Context for {contact?.name}</DialogTitle>
                    <DialogDescription>
                        Valid context helps the AI understand who this person is, their goals, and their tone.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Context / Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. 'Single mother, interested in financial freedom, strictly verified.'..."
                            className="h-32"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {saving ? 'Saving...' : 'Save Context'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
