-- Script SQL pour ajouter la table SupervisorAlert sans toucher aux autres tables
-- Exécuter sur ta base PostgreSQL

CREATE TABLE IF NOT EXISTS "supervisor_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "agentId" TEXT NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "contactId" TEXT,
    "agentType" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "autoPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Création des index
CREATE INDEX IF NOT EXISTS "supervisor_alerts_agentId_status_idx" ON "supervisor_alerts"("agentId", "status");
CREATE INDEX IF NOT EXISTS "supervisor_alerts_severity_status_idx" ON "supervisor_alerts"("severity", "status");
CREATE INDEX IF NOT EXISTS "supervisor_alerts_agentType_createdAt_idx" ON "supervisor_alerts"("agentType", "createdAt");
CREATE INDEX IF NOT EXISTS "supervisor_alerts_createdAt_idx" ON "supervisor_alerts"("createdAt");

-- Ajout des relations (foreign keys) - optionnel mais recommandé
-- Si tu as déjà des données qui casseraient ces contraintes, tu peux les commenter

-- ALTER TABLE "supervisor_alerts" 
-- ADD CONSTRAINT "supervisor_alerts_conversationId_fkey" 
-- FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ALTER TABLE "supervisor_alerts" 
-- ADD CONSTRAINT "supervisor_alerts_contactId_fkey" 
-- FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vérification
SELECT 'Table supervisor_alerts créée avec succès' as result;
