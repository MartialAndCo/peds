import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function analyzeTestMessages() {
  console.log('📊 Analyzing test messages from database...\n')

  // Get test contact
  const contact = await prisma.contact.findUnique({
    where: { phone_whatsapp: '+1234567890-lifecycle-test' }
  })

  if (!contact) {
    console.log('❌ Test contact not found')
    return
  }

  // Get agent
  const agent = await prisma.agent.findFirst({
    where: { isActive: true, name: 'Lena' }
  })

  if (!agent) {
    console.log('❌ Agent not found')
    return
  }

  // Get AgentContact for phase info
  const agentContact = await prisma.agentContact.findUnique({
    where: { agentId_contactId: { agentId: agent.id, contactId: contact.id } }
  })

  // Get conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      contactId: contact.id,
      agentId: agent.id
    },
    include: {
      messages: {
        orderBy: { timestamp: 'asc' }
      }
    }
  })

  if (!conversation || conversation.messages.length === 0) {
    console.log('⚠️ No messages found in database for test contact')
    console.log('Messages were likely stored in-memory only during test')
    console.log('\nChecking if we can extract from test output...')
    return
  }

  console.log(`✅ Found ${conversation.messages.length} messages\n`)

  // Analyze messages
  const analysis = {
    totalMessages: conversation.messages.length,
    messagesByPhase: {} as Record<string, number>,
    userMessages: conversation.messages.filter(m => m.sender === 'contact'),
    aiMessages: conversation.messages.filter(m => m.sender === 'ai'),
    analysis: [] as any[]
  }

  // Group messages by phase (estimate based on message count)
  let currentPhase = 'CONNECTION'
  let phaseMessageCount = 0
  const phaseTransitions = [
    { at: 30, phase: 'VULNERABILITY' },
    { at: 80, phase: 'CRISIS' },
    { at: 200, phase: 'MONEYPOT' }
  ]

  for (let i = 0; i < conversation.messages.length; i++) {
    const msg = conversation.messages[i]

    // Update phase based on message count
    for (const transition of phaseTransitions) {
      if (i === transition.at) {
        currentPhase = transition.phase
      }
    }

    if (!analysis.messagesByPhase[currentPhase]) {
      analysis.messagesByPhase[currentPhase] = 0
    }
    analysis.messagesByPhase[currentPhase]++

    if (msg.sender === 'ai') {
      const text = msg.message_text
      const words = text
        .replace(/\[VOICE\]/g, '')
        .replace(/\[PAYMENT_RECEIVED\]/g, '')
        .replace(/\*\*/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0 && !/^[\p{Emoji}]+$/u.test(w))
        .length

      analysis.analysis.push({
        index: i,
        phase: currentPhase,
        sender: msg.sender,
        text: text,
        wordCount: words,
        hasSeparator: text.includes('|') || text.includes('|||'),
        hasRomanticTone: /miss u|miss you|babe|sweet|💖|😘|🥺|love u/i.test(text),
        hasBabe: /babe/i.test(text),
        hasMoneyRequest: /\$|dollar|bill|pay|help|need money|paypal|venmo/i.test(text),
        hasPaymentTag: text.includes('[PAYMENT_RECEIVED]'),
        hasVoiceTag: text.includes('[VOICE]'),
        isOver8Words: words > 8 && !text.includes('|')
      })
    } else {
      analysis.analysis.push({
        index: i,
        phase: currentPhase,
        sender: msg.sender,
        text: text,
        hasIRLRequest: /meet|see you|come over|hang out|visit|irl/i.test(text),
        hasPicRequest: /pic|photo|selfie|picture|send pic/i.test(text),
        hasVoiceRequest: /voice|voice note|record|hear you/i.test(text)
      })
    }
  }

  // Generate detailed report
  const report = generateDetailedReport(analysis, agentContact)

  // Save to file
  const filename = 'test-message-analysis-complete.md'
  fs.writeFileSync(filename, report)

  console.log(`\n✅ Complete analysis saved to: ${filename}`)
  console.log('\n' + report)
}

function generateDetailedReport(analysis: any, agentContact: any): string {
  const aiMessages = analysis.analysis.filter((m: any) => m.sender === 'ai')
  const userMessages = analysis.analysis.filter((m: any) => m.sender === 'contact')

  const totalWords = aiMessages.reduce((sum: number, m: any) => sum + m.wordCount, 0)
  const avgWords = totalWords / aiMessages.length

  const over8Words = aiMessages.filter((m: any) => m.isOver8Words).length
  const over8Rate = (over8Words / aiMessages.length) * 100

  const withSeparator = aiMessages.filter((m: any) => m.hasSeparator).length
  const separatorRate = (withSeparator / aiMessages.length) * 100

  const romanticMessages = aiMessages.filter((m: any) => m.hasRomanticTone).length
  const romanticRate = (romanticMessages / aiMessages.length) * 100

  const babeMessages = aiMessages.filter((m: any) => m.hasBabe).length
  const babeRate = (babeMessages / aiMessages.length) * 100

  const moneyRequests = aiMessages.filter((m: any) => m.hasMoneyRequest).length
  const paymentTags = aiMessages.filter((m: any) => m.hasPaymentTag).length
  const voiceTags = aiMessages.filter((m: any) => m.hasVoiceTag).length

  const irlRequests = userMessages.filter((m: any) => m.hasIRLRequest).length
  const picRequests = userMessages.filter((m: any) => m.hasPicRequest).length
  const voiceRequests = userMessages.filter((m: any) => m.hasVoiceRequest).length

  // Check IRL refusals
  const irlRefusals = []
  for (let i = 0; i < analysis.analysis.length - 1; i++) {
    if (analysis.analysis[i].sender === 'contact' && analysis.analysis[i].hasIRLRequest) {
      const nextMsg = analysis.analysis[i + 1]
      if (nextMsg.sender === 'ai') {
        const refused = /mom|cant|not allowed|dont think|my parents/i.test(nextMsg.text)
        irlRefusals.push({ index: i, refused, userMsg: analysis.analysis[i].text, aiMsg: nextMsg.text })
      }
    }
  }

  // Group messages by phase
  const phase1 = analysis.analysis.filter((m: any) => m.phase === 'CONNECTION')
  const phase2 = analysis.analysis.filter((m: any) => m.phase === 'VULNERABILITY')
  const phase3 = analysis.analysis.filter((m: any) => m.phase === 'CRISIS')
  const phase4 = analysis.analysis.filter((m: any) => m.phase === 'MONEYPOT')

  const phase4AI = phase4.filter((m: any) => m.sender === 'ai')
  const phase4Romantic = phase4AI.filter((m: any) => m.hasRomanticTone).length
  const phase4RomanticRate = phase4AI.length > 0 ? (phase4Romantic / phase4AI.length) * 100 : 0

  let report = `# 📊 Analyse Complète des Messages - Test Lifecycle\n\n`
  report += `**Date:** ${new Date().toISOString()}\n`
  report += `**Total Messages:** ${analysis.totalMessages}\n`
  report += `**Messages User:** ${userMessages.length}\n`
  report += `**Messages AI:** ${aiMessages.length}\n\n`

  report += `---\n\n## 📈 Métriques Globales\n\n`
  report += `### Style & Brevity\n`
  report += `- **Average Words/Message:** ${avgWords.toFixed(1)} (Target: 3-5)\n`
  report += `- **Messages >8 Words:** ${over8Words}/${aiMessages.length} (${over8Rate.toFixed(1)}%) - Target: <5% ${over8Rate < 5 ? '✅' : '❌'}\n`
  report += `- **Messages avec séparateur |:** ${withSeparator}/${aiMessages.length} (${separatorRate.toFixed(1)}%)\n\n`

  report += `### Comportement Émotionnel\n`
  report += `- **Messages romantiques (global):** ${romanticMessages}/${aiMessages.length} (${romanticRate.toFixed(1)}%)\n`
  report += `- **Usage "babe" (global):** ${babeMessages}/${aiMessages.length} (${babeRate.toFixed(1)}%)\n`
  report += `- **Phase 4 Romantic Rate:** ${phase4Romantic}/${phase4AI.length} (${phase4RomanticRate.toFixed(1)}%) - Target: >80% ${phase4RomanticRate > 80 ? '✅' : '❌'}\n\n`

  report += `### Demandes & Tags\n`
  report += `- **Money Requests:** ${moneyRequests}\n`
  report += `- **[PAYMENT_RECEIVED] tags:** ${paymentTags}\n`
  report += `- **[VOICE] tags:** ${voiceTags}\n\n`

  report += `### Refus IRL\n`
  report += `- **IRL Requests détectés:** ${irlRequests}\n`
  report += `- **IRL Refusals réussis:** ${irlRefusals.filter(r => r.refused).length}/${irlRefusals.length}\n`
  report += `- **IRL Refusal Rate:** ${irlRefusals.length > 0 ? ((irlRefusals.filter(r => r.refused).length / irlRefusals.length) * 100).toFixed(1) : 'N/A'}% ${irlRefusals.filter(r => r.refused).length === irlRefusals.length ? '✅' : '❌'}\n\n`

  report += `---\n\n## 📝 Distribution par Phase\n\n`
  report += `| Phase | Messages | AI Messages | User Messages |\n`
  report += `|-------|----------|-------------|---------------|\n`
  report += `| CONNECTION | ${phase1.length} | ${phase1.filter((m: any) => m.sender === 'ai').length} | ${phase1.filter((m: any) => m.sender === 'contact').length} |\n`
  report += `| VULNERABILITY | ${phase2.length} | ${phase2.filter((m: any) => m.sender === 'ai').length} | ${phase2.filter((m: any) => m.sender === 'contact').length} |\n`
  report += `| CRISIS | ${phase3.length} | ${phase3.filter((m: any) => m.sender === 'ai').length} | ${phase3.filter((m: any) => m.sender === 'contact').length} |\n`
  report += `| MONEYPOT | ${phase4.length} | ${phase4.filter((m: any) => m.sender === 'ai').length} | ${phase4.filter((m: any) => m.sender === 'contact').length} |\n\n`

  report += `---\n\n## 🔍 Détails des Refus IRL\n\n`
  if (irlRefusals.length > 0) {
    irlRefusals.forEach((refusal, idx) => {
      report += `### Refusal ${idx + 1} - Message #${refusal.index} ${refusal.refused ? '✅' : '❌'}\n`
      report += `**User:** "${refusal.userMsg}"\n`
      report += `**Lena:** "${refusal.aiMsg}"\n`
      report += `**Status:** ${refusal.refused ? 'Refused correctly' : '⚠️ NOT REFUSED'}\n\n`
    })
  } else {
    report += `Aucune demande IRL détectée.\n\n`
  }

  report += `---\n\n## 💬 Échantillon de Messages par Phase\n\n`

  // Phase 1 sample
  report += `### Phase 1: CONNECTION (Premiers 10 messages AI)\n\n`
  const phase1AI = phase1.filter((m: any) => m.sender === 'ai').slice(0, 10)
  phase1AI.forEach((m: any, idx: number) => {
    report += `${idx + 1}. "${m.text}" (${m.wordCount} words${m.hasSeparator ? ', has |' : ''}${m.isOver8Words ? ', >8 words ⚠️' : ''})\n`
  })

  // Phase 2 sample
  report += `\n### Phase 2: VULNERABILITY (Premiers 10 messages AI)\n\n`
  const phase2AI = phase2.filter((m: any) => m.sender === 'ai').slice(0, 10)
  phase2AI.forEach((m: any, idx: number) => {
    report += `${idx + 1}. "${m.text}" (${m.wordCount} words${m.hasSeparator ? ', has |' : ''}${m.hasRomanticTone ? ', romantic ❤️' : ''}${m.isOver8Words ? ', >8 words ⚠️' : ''})\n`
  })

  // Phase 3 sample
  report += `\n### Phase 3: CRISIS (Premiers 10 messages AI)\n\n`
  const phase3AI = phase3.filter((m: any) => m.sender === 'ai').slice(0, 10)
  phase3AI.forEach((m: any, idx: number) => {
    report += `${idx + 1}. "${m.text}" (${m.wordCount} words${m.hasSeparator ? ', has |' : ''}${m.hasMoneyRequest ? ', money 💰' : ''}${m.hasPaymentTag ? ', [PAYMENT_RECEIVED] 💳' : ''}${m.isOver8Words ? ', >8 words ⚠️' : ''})\n`
  })

  // Phase 4 sample
  report += `\n### Phase 4: MONEYPOT (Premiers 15 messages AI)\n\n`
  const phase4AISample = phase4AI.slice(0, 15)
  phase4AISample.forEach((m: any, idx: number) => {
    report += `${idx + 1}. "${m.text}" (${m.wordCount} words${m.hasSeparator ? ', has |' : ''}${m.hasRomanticTone ? ', romantic ❤️' : ''}${m.hasBabe ? ', "babe" 💕' : ''}${m.isOver8Words ? ', >8 words ⚠️' : ''})\n`
  })

  report += `\n---\n\n## 🎯 Messages Problématiques (>8 mots sans séparateur)\n\n`
  const problematic = aiMessages.filter((m: any) => m.isOver8Words).slice(0, 20)
  if (problematic.length > 0) {
    problematic.forEach((m: any, idx: number) => {
      report += `${idx + 1}. [Phase ${m.phase}] "${m.text}" (${m.wordCount} words)\n`
    })
    if (aiMessages.filter((m: any) => m.isOver8Words).length > 20) {
      report += `\n... et ${aiMessages.filter((m: any) => m.isOver8Words).length - 20} autres\n`
    }
  } else {
    report += `Aucun message problématique détecté ✅\n`
  }

  report += `\n---\n\n## 📋 État Final AgentContact\n\n`
  if (agentContact) {
    report += `- **Phase:** ${agentContact.phase}\n`
    report += `- **Trust Score:** ${agentContact.trustScore}\n`
    report += `- **Message Count:** ${agentContact.messageCount}\n`
    report += `- **Escalation Tier:** ${agentContact.paymentEscalationTier}\n`
    report += `- **Total Payments:** ${agentContact.totalPaymentsReceived}\n`
    report += `- **Total Amount:** $${agentContact.totalAmountReceived}\n`
    report += `- **Consecutive Refusals:** ${agentContact.consecutiveRefusals}\n`
  }

  report += `\n---\n\n## ✅ Résumé\n\n`
  const issues = []
  if (over8Rate >= 5) issues.push('Messages trop longs')
  if (phase4RomanticRate < 80) issues.push('Ton pas assez romantique en Phase 4')
  if (irlRefusals.some(r => !r.refused)) issues.push('Refus IRL échoués')
  if (agentContact && agentContact.trustScore === 0) issues.push('Trust score bloqué à 0')

  if (issues.length === 0) {
    report += `✅ **Aucun problème critique détecté**\n`
  } else {
    report += `❌ **${issues.length} problème(s) détecté(s):**\n`
    issues.forEach(issue => {
      report += `- ${issue}\n`
    })
  }

  return report
}

analyzeTestMessages()
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
