-- AlterTable
ALTER TABLE "agent_contacts" ADD COLUMN "paymentEscalationTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "agent_contacts" ADD COLUMN "lastRequestedAmount" DECIMAL(10,2);
ALTER TABLE "agent_contacts" ADD COLUMN "lastRequestDate" TIMESTAMP(3);
ALTER TABLE "agent_contacts" ADD COLUMN "totalPaymentsReceived" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "agent_contacts" ADD COLUMN "totalAmountReceived" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "agent_contacts" ADD COLUMN "consecutiveRefusals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "agent_contacts" ADD COLUMN "lastPaymentDate" TIMESTAMP(3);
