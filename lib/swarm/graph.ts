// Moteur d'exécution du graph multi-agent avec support parallèle et barrières
import type { SwarmState, NodeFunction, EdgeConfig } from './types'

interface NodeInfo {
    name: string
    fn: NodeFunction
    dependencies: string[]  // Nodes qui doivent s'exécuter avant
}

export class SwarmGraph {
    private nodes: Map<string, NodeInfo> = new Map()

    addNode(name: string, fn: NodeFunction, dependencies: string[] = []) {
        this.nodes.set(name, { name, fn, dependencies })
    }

    async execute(startNode: string, initialState: SwarmState): Promise<SwarmState> {
        let state: SwarmState = { ...initialState, contexts: initialState.contexts || {} }
        const executed = new Set<string>()
        let iterations = 0
        const MAX_ITERATIONS = 100

        console.log(`[Swarm] Starting execution from: ${startNode}`)

        while (iterations < MAX_ITERATIONS) {
            iterations++
            
            // Trouver tous les nodes prêts (toutes les dépendances sont exécutées)
            const readyNodes: string[] = []
            for (const [name, info] of this.nodes) {
                if (executed.has(name)) continue
                const depsSatisfied = info.dependencies.every(dep => executed.has(dep))
                if (depsSatisfied && !readyNodes.includes(name)) {
                    readyNodes.push(name)
                }
            }

            if (readyNodes.length === 0) {
                // Vérifier si on a tout exécuté ou si on est bloqué
                const remaining = Array.from(this.nodes.keys()).filter(n => !executed.has(n))
                if (remaining.length === 0) {
                    console.log('[Swarm] All nodes executed')
                    break
                }
                console.warn('[Swarm] Deadlock detected! Remaining:', remaining)
                break
            }

            console.log(`[Swarm] [${iterations}] Ready nodes: ${readyNodes.join(', ')}`)

            // Exécuter les nodes SÉRIELLEMENT pour respecter les rate limits Venice (150 RPM)
            // Le parallèle fait exploser les limites avec 6-7 appels par message
            const results: Array<{name: string, result: any, success: boolean}> = []
            
            for (const nodeName of readyNodes) {
                const info = this.nodes.get(nodeName)!
                const startTime = Date.now()
                
                try {
                    console.log(`[Swarm] → Starting ${nodeName}...`)
                    const result = await info.fn(state)
                    const duration = Date.now() - startTime
                    console.log(`[Swarm] ✓ ${nodeName} done (${duration}ms)`)
                    results.push({ name: nodeName, result, success: true })
                    
                    // Délai entre appels API pour respecter 150 RPM (250ms = ~240 RPM max, safe buffer)
                    if (readyNodes.length > 1) {
                        await new Promise(r => setTimeout(r, 250))
                    }
                } catch (error: any) {
                    console.error(`[Swarm] ✗ ${nodeName} failed:`, error.message)
                    results.push({ name: nodeName, result: { error: `Error in ${nodeName}: ${error.message}` }, success: false })
                }
            }

            // Mettre à jour l'état et marquer comme exécuté
            // Accumuler tous les contexts des nodes exécutés dans cette itération
            const allContexts = { ...state.contexts }
            for (const { name, result } of results) {
                executed.add(name)
                // Merger SEULEMENT les nouvelles valeurs non-vides
                if (result.contexts) {
                    for (const [key, value] of Object.entries(result.contexts)) {
                        if (value) {  // Ne garder que les valeurs truthy
                            allContexts[key as keyof typeof allContexts] = value as any
                        }
                    }
                }
            }
            // Appliquer tous les autres changements d'état (sauf contexts qu'on gère séparément)
            for (const { name, result } of results) {
                const { contexts, ...rest } = result
                state = { ...state, ...rest }
            }
            // Mettre à jour les contexts accumulés
            state = { ...state, contexts: allContexts }

            // Vérifier si on a une réponse ET que tous les nodes sont exécutés
            // (ne pas s'arrêter juste parce qu'on a une réponse, laisser la validation tourner)
            const allExecuted = executed.size === this.nodes.size
            if (state.response && allExecuted) {
                console.log(`[Swarm] Response generated and all nodes executed, stopping`)
                break
            }
        }

        if (iterations >= MAX_ITERATIONS) {
            console.warn('[Swarm] Max iterations reached')
            state.error = 'Max iterations reached'
        }

        console.log(`[Swarm] Completed: ${executed.size}/${this.nodes.size} nodes, ${iterations} iterations`)
        return state
    }
}
