UPDATE "conversations" SET "agentId" = '1' WHERE "agentId" = 'default' OR "agentId" is null;
UPDATE "incoming_queue" SET "agentId" = '1' WHERE "agentId" = 'default' OR "agentId" is null;
