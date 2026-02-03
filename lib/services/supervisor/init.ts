/**
 * Supervisor Initialization
 * Démarre la surveillance du système au lancement de l'application
 */

import { supervisorOrchestrator } from './orchestrator';

let initialized = false;

/**
 * Initialise le superviseur et démarre les monitoring
 * À appeler une seule fois au démarrage de l'app
 */
export function initSupervisor(): void {
    if (initialized) {
        console.log('[Supervisor] Already initialized, skipping');
        return;
    }

    // Vérifier qu'on est côté serveur (pas en build time ni browser)
    if (typeof window !== 'undefined') {
        return; // Pas côté serveur, ne rien faire
    }

    console.log('[Supervisor] 🚀 Initializing supervisor...');

    // Démarrer la surveillance de la file d'attente
    supervisorOrchestrator.startQueueMonitoring();

    initialized = true;
    console.log('[Supervisor] ✅ Supervisor initialized successfully');
}

/**
 * Arrête proprement le superviseur (pour les tests ou shutdown)
 */
export function shutdownSupervisor(): void {
    if (!initialized) return;

    console.log('[Supervisor] 🛑 Shutting down supervisor...');

    supervisorOrchestrator.stopQueueMonitoring();

    initialized = false;
    console.log('[Supervisor] ✅ Supervisor shut down successfully');
}
