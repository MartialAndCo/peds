import { getPipelineData } from './actions'
import PipelineBoard from './_components/PipelineBoard'

export const dynamic = 'force-dynamic'

export default async function ProfilesPage() {
    const data = await getPipelineData()

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 overflow-hidden">
            <div className="mb-6">
                <h1 className="text-3xl font-bold font-serif text-slate-800">Cercle Privé</h1>
                <p className="text-slate-500">Gestion des relations et suivi des profils</p>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <PipelineBoard initialData={data as any} agentId="admin" />
            </div>
        </div>
    )
}
