import { ContactForm } from "@/components/contact-form"

export default function NewContactPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">New Contact</h2>
            <ContactForm />
        </div>
    )
}
