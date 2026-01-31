/**
 * Script to add agent_base_age setting to all agents
 * This allows each agent to have their own base age for the birthday system
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addAgentBaseAge() {
    console.log('Adding agent_base_age setting to all agents...\n');

    // Get all agents
    const agents = await prisma.agent.findMany();

    if (agents.length === 0) {
        console.log('⚠️  No agents found in database');
        return;
    }

    console.log(`Found ${agents.length} agent(s)\n`);

    for (const agent of agents) {
        // Check if agent_base_age already exists
        const existing = await prisma.agentSetting.findUnique({
            where: {
                agentId_key: {
                    agentId: agent.id,
                    key: 'agent_base_age'
                }
            }
        });

        if (existing) {
            console.log(`Agent ${agent.id} (${agent.name}): Already has agent_base_age = ${existing.value}`);
        } else {
            // Add default age of 18 (you can customize per agent)
            await prisma.agentSetting.create({
                data: {
                    agentId: agent.id,
                    key: 'agent_base_age',
                    value: '18' // Default age - customize as needed
                }
            });
            console.log(`Agent ${agent.id} (${agent.name}): ✅ Added agent_base_age = 18 (default)`);
        }
    }

    console.log('\n✅ All agents now have agent_base_age setting');
    console.log('\nTo customize an agent\'s age:');
    console.log('  1. Open Prisma Studio: npx prisma studio');
    console.log('  2. Go to AgentSetting table');
    console.log('  3. Find the agent_base_age row for your agent');
    console.log('  4. Change the value (e.g., 15, 22, 30)');
}

addAgentBaseAge()
    .catch(e => {
        console.error('❌ Failed:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
