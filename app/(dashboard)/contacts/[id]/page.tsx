'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { ContactForm } from "@/components/contact-form"
import { useParams } from 'next/navigation'

export default function EditContactPage() {
    const params = useParams()
    const [contact, setContact] = useState(null)

    useEffect(() => {
        if (params.id) {
            axios.get(`/api/contacts/${params.id}`)
                .then(res => setContact(res.data))
                .catch(err => console.error(err))
        }
    }, [params.id])

    if (!contact) return <div>Loading...</div>

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">Edit Contact</h2>
            <ContactForm initialData={contact} />
        </div>
    )
}
