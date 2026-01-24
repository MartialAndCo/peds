/*
  Warnings:

  - The primary key for the `agents` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "_AgentToUser" DROP CONSTRAINT "_AgentToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "agent_contacts" DROP CONSTRAINT "agent_contacts_agentId_fkey";

-- DropForeignKey
ALTER TABLE "agent_events" DROP CONSTRAINT "agent_events_agentId_fkey";

-- DropForeignKey
ALTER TABLE "agent_profiles" DROP CONSTRAINT "agent_profiles_agentId_fkey";

-- DropForeignKey
ALTER TABLE "agent_prompts" DROP CONSTRAINT "agent_prompts_agentId_fkey";

-- DropForeignKey
ALTER TABLE "agent_settings" DROP CONSTRAINT "agent_settings_agentId_fkey";

-- DropForeignKey
ALTER TABLE "blacklist_rules" DROP CONSTRAINT "blacklist_rules_agentId_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_agentId_fkey";

-- AlterTable
ALTER TABLE "_AgentToUser" ALTER COLUMN "A" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agent_contacts" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agent_events" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agent_profiles" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agent_prompts" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agent_settings" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "agents" DROP CONSTRAINT "agents_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "agents_id_seq";

-- AlterTable
ALTER TABLE "blacklist_rules" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "incoming_queue" ALTER COLUMN "agentId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_prompts" ADD CONSTRAINT "agent_prompts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_rules" ADD CONSTRAINT "blacklist_rules_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_contacts" ADD CONSTRAINT "agent_contacts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentToUser" ADD CONSTRAINT "_AgentToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
