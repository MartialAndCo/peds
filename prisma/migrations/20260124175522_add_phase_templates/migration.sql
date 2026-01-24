-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN     "phaseConnectionTemplate" TEXT,
ADD COLUMN     "phaseCrisisTemplate" TEXT,
ADD COLUMN     "phaseMoneypotTemplate" TEXT,
ADD COLUMN     "phaseVulnerabilityTemplate" TEXT,
ADD COLUMN     "styleRules" TEXT;
