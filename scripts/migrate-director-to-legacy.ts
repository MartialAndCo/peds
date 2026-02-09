/**
 * 🔥 MIGRATION : DIRECTOR → SWARM-ONLY
 * 
 * Ce script migre complètement le système pour utiliser UNIQUEMENT le SWARM
 * et archive le vieux director.ts (legacy)
 * 
 * Date: 2026-02-07
 * Auteur: Migration automatique
 */

import fs from 'fs'
import path from 'path'

console.log('🔥 MIGRATION: DIRECTOR → SWARM-ONLY')
console.log('=' .repeat(60))

const ROOT_DIR = path.resolve(__dirname, '..')
const LIB_DIR = path.join(ROOT_DIR, 'lib')
const ARCHIVE_DIR = path.join(ROOT_DIR, '_archive', 'legacy-director', new Date().toISOString().split('T')[0])

// ============================================================================
// ÉTAPE 1: Créer l'archive
// ============================================================================
console.log('\n📦 ÉTAPE 1: Création de l\'archive...')

if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
}

// Fichiers à archiver
const filesToArchive = [
    'lib/director.ts',
    'lib/config/ai-mode.ts',  // On va créer une version simplifiée swarm-only
]

filesToArchive.forEach(file => {
    const src = path.join(ROOT_DIR, file)
    const dest = path.join(ARCHIVE_DIR, path.basename(file))
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        console.log(`   ✅ Archivé: ${file}`)
    }
})

// ============================================================================
// ÉTAPE 2: Modifier ai-mode.ts pour forcer SWARM
// ============================================================================
console.log('\n🔧 ÉTAPE 2: Configuration SWARM-ONLY...')

const aiModePath = path.join(LIB_DIR, 'config', 'ai-mode.ts')
const aiModeContent = `// Configuration AI Mode - SWARM-ONLY (Legacy Director Archived)
// MIGRATION: 2026-02-07 - Director completement desactive

export type AIMode = 'SWARM'

class AIConfig {
    private _mode: AIMode = 'SWARM'

    get mode(): AIMode {
        // 🔒 SWARM-ONLY: Director archive
        return 'SWARM'
    }

    isClassic(): boolean {
        // 🔒 Director desactive
        return false
    }

    isSwarm(): boolean {
        // ✅ Seul mode actif
        return true
    }
}

export const aiConfig = new AIConfig()
`

fs.writeFileSync(aiModePath, aiModeContent)
console.log('   ✅ ai-mode.ts → SWARM-ONLY')

// ============================================================================
// ÉTAPE 3: Créer un director minimal (stub) pour compatibilité
// ============================================================================
console.log('\n📋 ÉTAPE 3: Création du stub director.ts...')

const directorStub = `// lib/director.ts - STUB pour compatibilité
// 🔥 MIGRATION: Director legacy archivé - Utiliser SWARM uniquement
// Date: 2026-02-07

import { signalAnalyzer } from './services/signal-analyzer'

export type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'

export const director = {
    /**
     * ⚠️ DEPRECATED: Utiliser le SWARM directement
     * Cette fonction est conservée pour compatibilité mais ne retourne pas de prompt
     */
    async buildSystemPrompt(): Promise<null> {
        console.warn('[Director] ⚠️ DEPRECATED: buildSystemPrompt() called but Director is archived. Use SWARM.')
        return null  // Force l'utilisation du SWARM
    },

    /**
     * Détermine la phase actuelle (encore utilisé par le SWARM)
     */
    async determinePhase(contactPhone: string, agentId: string) {
        const { prisma } = await import('./prisma')
        
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })

        if (!contact) throw new Error('Contact not found')

        const agentContact = await prisma.agentContact.findUnique({
            where: {
                agentId_contactId: {
                    agentId,
                    contactId: contact.id
                }
            }
        })

        const phase = (agentContact?.phase || 'CONNECTION') as AgentPhase
        const signals = (agentContact?.signals || []) as any[]

        return {
            phase,
            details: {
                signals,
                signalCount: signals.length,
                trustScore: agentContact?.trustScore || 0
            },
            reason: signals.length > 0 ? \`Signals: [\${signals.join(', ')}]\` : 'No signals yet'
        }
    },

    /**
     * Analyse des signaux (encore utilisée)
     */
    async performSignalAnalysis(contactPhone: string, agentId: string) {
        const { prisma } = await import('./prisma')
        
        const contact = await prisma.contact.findUnique({
            where: { phone_whatsapp: contactPhone }
        })
        
        if (!contact) return null

        return signalAnalyzer.updateSignals(agentId, contact.id)
    }
}
`

fs.writeFileSync(path.join(LIB_DIR, 'director.ts'), directorStub)
console.log('   ✅ director.ts → Stub (compatibilité only)')

// ============================================================================
// RÉSUMÉ
// ============================================================================
console.log('\n' + '='.repeat(60))
console.log('✅ MIGRATION TERMINÉE')
console.log('\n📝 Résumé:')
console.log('   • Director legacy archivé dans:')
console.log(`     ${ARCHIVE_DIR}`)
console.log('   • ai-mode.ts → SWARM-ONLY')
console.log('   • director.ts → Stub (compatibilité)')
console.log('\n⚠️  PROCHAINES ÉTAPES MANUELLES:')
console.log('   1. Modifier lib/handlers/chat.ts pour supprimer les fallback director')
console.log('   2. Améliorer lib/swarm/nodes/phase-node.ts (anti-répétition)')
console.log('   3. Améliorer lib/swarm/nodes/response-node.ts (écoute active)')
console.log('   4. Redémarrer le serveur')
console.log('\n🔥 Le système utilise maintenant UNIQUEMENT le SWARM')
