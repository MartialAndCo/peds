#!/usr/bin/env tsx
/**
 * Script d'analyse des redondances Swarm/Database
 * Compte les requêtes et identifie les duplications
 */

import * as fs from 'fs';
import * as path from 'path';

const SWARM_DIR = path.join(process.cwd(), 'lib/swarm');
const SERVICES_DIR = path.join(process.cwd(), 'lib/services');

// Patterns à rechercher
const PATTERNS = {
  // Requêtes Prisma
  prismaQuery: /prisma\.(\w+)\.(findUnique|findMany|findFirst|create|update|updateMany)/g,
  
  // Accès AgentProfile
  agentProfileQuery: /prisma\.agentProfile\./g,
  
  // Accès AgentContact
  agentContactQuery: /prisma\.agentContact\./g,
  
  // Accès Setting
  settingQuery: /prisma\.setting\./g,
  
  // Accès Story
  storyQuery: /prisma\.story\./g,
  
  // Services externes
  mem0Usage: /memoryService\./g,
  veniceCall: /venice\./g,
  anthropicCall: /anthropic\./g,
  
  // State.contexts
  stateContext: /state\.contexts\./g,
};

// Liste des nodes du swarm
const SWARM_NODES = [
  'index.ts',
  'graph.ts',
  'nodes/intention-node.ts',
  'nodes/persona-node.ts',
  'nodes/phase-node.ts',
  'nodes/timing-node.ts',
  'nodes/style-node.ts',
  'nodes/safety-node.ts',
  'nodes/memory-node.ts',
  'nodes/payment-node.ts',
  'nodes/media-node.ts',
  'nodes/voice-node.ts',
  'nodes/response-node.ts',
  'nodes/validation-node.ts',
];

// Liste des services à analyser
const SERVICES = [
  'signal-analyzer.ts',
  'payment-escalation.ts',
  'supervisor/orchestrator.ts',
  'persona-schedule.ts',
];

interface AnalysisResult {
  file: string;
  prismaQueries: number;
  agentProfileQueries: number;
  agentContactQueries: number;
  settingQueries: number;
  storyQueries: number;
  mem0Calls: number;
  llmCalls: number;
  stateContextWrites: number;
}

function analyzeFile(filePath: string): AnalysisResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  return {
    file: path.basename(filePath),
    prismaQueries: (content.match(PATTERNS.prismaQuery) || []).length,
    agentProfileQueries: (content.match(PATTERNS.agentProfileQuery) || []).length,
    agentContactQueries: (content.match(PATTERNS.agentContactQuery) || []).length,
    settingQueries: (content.match(PATTERNS.settingQuery) || []).length,
    storyQueries: (content.match(PATTERNS.storyQuery) || []).length,
    mem0Calls: (content.match(PATTERNS.mem0Usage) || []).length,
    llmCalls: (content.match(PATTERNS.veniceCall) || []).length + 
              (content.match(PATTERNS.anthropicCall) || []).length,
    stateContextWrites: (content.match(PATTERNS.stateContext) || []).length,
  };
}

function printTable(title: string, results: AnalysisResult[]) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📊 ${title}`);
  console.log('='.repeat(100));
  
  // Header
  console.log(
    `${'Fichier'.padEnd(25)} | ` +
    `${'Prisma'.padEnd(6)} | ` +
    `${'Profile'.padEnd(7)} | ` +
    `${'Contact'.padEnd(7)} | ` +
    `${'Setting'.padEnd(7)} | ` +
    `${'Story'.padEnd(5)} | ` +
    `${'Mem0'.padEnd(4)} | ` +
    `${'LLM'.padEnd(3)} | ` +
    `${'Context'.padEnd(7)}`
  );
  console.log('-'.repeat(100));
  
  // Rows
  let totals = {
    prismaQueries: 0,
    agentProfileQueries: 0,
    agentContactQueries: 0,
    settingQueries: 0,
    storyQueries: 0,
    mem0Calls: 0,
    llmCalls: 0,
    stateContextWrites: 0,
  };
  
  for (const r of results) {
    console.log(
      `${r.file.padEnd(25)} | ` +
      `${r.prismaQueries.toString().padEnd(6)} | ` +
      `${r.agentProfileQueries.toString().padEnd(7)} | ` +
      `${r.agentContactQueries.toString().padEnd(7)} | ` +
      `${r.settingQueries.toString().padEnd(7)} | ` +
      `${r.storyQueries.toString().padEnd(5)} | ` +
      `${r.mem0Calls.toString().padEnd(4)} | ` +
      `${r.llmCalls.toString().padEnd(3)} | ` +
      `${r.stateContextWrites.toString().padEnd(7)}`
    );
    
    totals.prismaQueries += r.prismaQueries;
    totals.agentProfileQueries += r.agentProfileQueries;
    totals.agentContactQueries += r.agentContactQueries;
    totals.settingQueries += r.settingQueries;
    totals.storyQueries += r.storyQueries;
    totals.mem0Calls += r.mem0Calls;
    totals.llmCalls += r.llmCalls;
    totals.stateContextWrites += r.stateContextWrites;
  }
  
  console.log('-'.repeat(100));
  console.log(
    `${'TOTAL'.padEnd(25)} | ` +
    `${totals.prismaQueries.toString().padEnd(6)} | ` +
    `${totals.agentProfileQueries.toString().padEnd(7)} | ` +
    `${totals.agentContactQueries.toString().padEnd(7)} | ` +
    `${totals.settingQueries.toString().padEnd(7)} | ` +
    `${totals.storyQueries.toString().padEnd(5)} | ` +
    `${totals.mem0Calls.toString().padEnd(4)} | ` +
    `${totals.llmCalls.toString().padEnd(3)} | ` +
    `${totals.stateContextWrites.toString().padEnd(7)}`
  );
  
  return totals;
}

function main() {
  console.log('🔍 ANALYSE DES REDONDANCES SWARM/DB');
  console.log('=====================================\n');
  
  // Analyser le swarm
  const swarmResults: AnalysisResult[] = [];
  for (const node of SWARM_NODES) {
    const filePath = path.join(SWARM_DIR, node);
    if (fs.existsSync(filePath)) {
      swarmResults.push(analyzeFile(filePath));
    }
  }
  
  const swarmTotals = printTable('SWARM NODES', swarmResults);
  
  // Analyser les services
  const serviceResults: AnalysisResult[] = [];
  for (const svc of SERVICES) {
    const filePath = path.join(SERVICES_DIR, svc);
    if (fs.existsSync(filePath)) {
      serviceResults.push(analyzeFile(filePath));
    }
  }
  
  const serviceTotals = printTable('SERVICES', serviceResults);
  
  // Résumé
  console.log('\n' + '='.repeat(100));
  console.log('📈 RÉSUMÉ GLOBAL');
  console.log('='.repeat(100));
  
  const grandTotal = {
    prismaQueries: swarmTotals.prismaQueries + serviceTotals.prismaQueries,
    agentProfileQueries: swarmTotals.agentProfileQueries + serviceTotals.agentProfileQueries,
    agentContactQueries: swarmTotals.agentContactQueries + serviceTotals.agentContactQueries,
    settingQueries: swarmTotals.settingQueries + serviceTotals.settingQueries,
    storyQueries: swarmTotals.storyQueries + serviceTotals.storyQueries,
    mem0Calls: swarmTotals.mem0Calls + serviceTotals.mem0Calls,
    llmCalls: swarmTotals.llmCalls + serviceTotals.llmCalls,
  };
  
  console.log(`\n🗄️  Requêtes Prisma total: ${grandTotal.prismaQueries}`);
  console.log(`   ├─ AgentProfile: ${grandTotal.agentProfileQueries} ${grandTotal.agentProfileQueries > 5 ? '⚠️ HIGH' : '✅'}`);
  console.log(`   ├─ AgentContact: ${grandTotal.agentContactQueries} ${grandTotal.agentContactQueries > 5 ? '⚠️ HIGH' : '✅'}`);
  console.log(`   ├─ Setting: ${grandTotal.settingQueries} ${grandTotal.settingQueries > 3 ? '⚠️ MEDIUM' : '✅'}`);
  console.log(`   └─ Story: ${grandTotal.storyQueries} ${grandTotal.storyQueries > 3 ? '⚠️ MEDIUM' : '✅'}`);
  
  console.log(`\n🧠 Appels API externes:`);
  console.log(`   ├─ Mem0: ${grandTotal.mem0Calls}`);
  console.log(`   └─ LLM (Venice/Anthropic): ${grandTotal.llmCalls} ${grandTotal.llmCalls > 3 ? '💰 COÛTEUX' : ''}`);
  
  // Analyse redondances
  console.log('\n' + '='.repeat(100));
  console.log('🚨 REDONDANCES IDENTIFIÉES');
  console.log('='.repeat(100));
  
  if (swarmTotals.agentProfileQueries > 3) {
    console.log('\n1. ⚠️ AgentProfile requêté multiple fois dans le swarm');
    console.log(`   → ${swarmTotals.agentProfileQueries} requêtes dans différents nodes`);
    console.log('   → SOLUTION: Passer profile dans SwarmState');
  }
  
  if (swarmTotals.agentContactQueries > 2) {
    console.log('\n2. ⚠️ AgentContact requêté dans plusieurs nodes');
    console.log(`   → ${swarmTotals.agentContactQueries} requêtes`);
    console.log('   → SOLUTION: Centraliser dans index.ts');
  }
  
  if (swarmTotals.settingQueries > 2) {
    console.log('\n3. ⚠️ Settings requêtés sans cache');
    console.log(`   → ${swarmTotals.settingQueries} requêtes directes`);
    console.log('   → SOLUTION: Utiliser settingsService avec cache');
  }
  
  if (swarmTotals.llmCalls + serviceTotals.llmCalls > 5) {
    console.log('\n4. 💰 Nombreux appels LLM (coût important)');
    console.log(`   → ${swarmTotals.llmCalls + serviceTotals.llmCalls} appels LLM potentiels par message`);
    console.log('   → Swarm: Intention + Response');
    console.log('   → Services: Signal Analyzer (+1)');
    console.log('   → Supervisor: 6 agents (+6 si activés)');
    console.log('   → TOTAL: Jusqu\'à 9 appels LLM par message!');
  }
  
  // Recommandations
  console.log('\n' + '='.repeat(100));
  console.log('💡 RECOMMANDATIONS PRIORITAIRES');
  console.log('='.repeat(100));
  console.log(`
1. [HIGH] Centraliser AgentProfile dans SwarmState
   Effort: 30min | Gain: -${swarmTotals.agentProfileQueries - 1} requêtes

2. [HIGH] Passer settings dans SwarmState
   Effort: 15min | Gain: -${swarmTotals.settingQueries - 1} requêtes

3. [MEDIUM] Lazy loading pour stories (uniquement si phase avancée)
   Effort: 1h | Gain: -2 requêtes en CONNECTION

4. [MEDIUM] Batch les appels Supervisor
   Effort: 2h | Gain: -5 appels LLM → 1 appel

5. [LOW] Cache Redis pour settings/profiles
   Effort: 4h | Gain: -100% requêtes répétées
`);
}

main();
