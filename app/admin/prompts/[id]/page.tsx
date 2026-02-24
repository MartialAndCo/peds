'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { PromptForm } from "@/components/prompt-form"
import { useParams } from 'next/navigation'

export default function EditPromptPage() {
    const params = useParams()
    const [prompt, setPrompt] = useState(null)

    useEffect(() => {
        if (params.id) {
            axios.get(`/api/prompts/${params.id}`)
                .then(res => setPrompt(res.data))
                .catch(err => console.error(err))
        }
    }, [params.id])

    if (!prompt) return <div>Loading...</div>

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">Edit Prompt</h2>
            <PromptForm initialData={prompt} />
        </div>
    )
}
