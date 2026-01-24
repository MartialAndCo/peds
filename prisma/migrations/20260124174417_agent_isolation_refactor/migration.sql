-- CreateTable
CREATE TABLE "agent_profiles" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "baseAge" INTEGER NOT NULL DEFAULT 18,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "contextTemplate" TEXT,
    "missionTemplate" TEXT,
    "identityTemplate" TEXT,
    "paymentRules" TEXT,
    "safetyRules" TEXT,
    "paypalEmail" TEXT,
    "cashappTag" TEXT,
    "venmoHandle" TEXT,
    "fastTrackDays" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_contacts" (
    "id" TEXT NOT NULL,
    "agentId" INTEGER NOT NULL,
    "contactId" TEXT NOT NULL,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'CONNECTION',
    "lastPhaseUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTrustAnalysis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agent_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_agentId_key" ON "agent_profiles"("agentId");

-- CreateIndex
CREATE INDEX "agent_contacts_agentId_idx" ON "agent_contacts"("agentId");

-- CreateIndex
CREATE INDEX "agent_contacts_contactId_idx" ON "agent_contacts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_contacts_agentId_contactId_key" ON "agent_contacts"("agentId", "contactId");

-- AddForeignKey
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_contacts" ADD CONSTRAINT "agent_contacts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_contacts" ADD CONSTRAINT "agent_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
