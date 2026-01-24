-- SQL query to check agent IDs in database
-- Run this in Prisma Studio SQL query tab or via psql

SELECT 
    id,
    name,
    "isActive",
    "createdAt",
    (SELECT COUNT(*) FROM "Conversation" WHERE "agentId" = "Agent"."id") as conversation_count,
    (SELECT COUNT(*) FROM "AgentSetting" WHERE "agentId" = "Agent"."id") as settings_count
FROM "Agent"
ORDER BY "createdAt" ASC;

-- To identify numeric vs CUID:
-- Numeric IDs will be simple integers (e.g., '5', '678')
-- CUID IDs will be long alphanumeric strings (e.g., 'clxy1234567890')
