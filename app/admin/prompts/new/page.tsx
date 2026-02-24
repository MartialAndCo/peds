import { PromptForm } from "@/components/prompt-form"

export default function NewPromptPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">New Prompt</h2>
            <PromptForm />
        </div>
    )
}
