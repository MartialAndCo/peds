import * as fs from 'fs'

interface ConversationTurn {
  day: number
  sender: 'user' | 'ai'
  message: string
  phase: string
  trustScore: number
  escalationTier?: number
}

function countWords(message: string): number {
  return message
    .replace(/\[VOICE\]/g, '')
    .replace(/\[PAYMENT_RECEIVED\]/g, '')
    .replace(/\*\*/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0 && !/^[\p{Emoji}]+$/u.test(w))
    .length
}

function analyzeMessages() {
  console.log('📊 Analyzing saved messages...\n')

  // Load messages
  const messagesFile = 'test-lifecycle-messages.json'
  if (!fs.existsSync(messagesFile)) {
    console.log(`❌ File not found: ${messagesFile}`)
    console.log('Please run the test first with: npx tsx scripts/test-full-lifecycle-400-messages.ts')
    return
  }

  const allMessages: ConversationTurn[] = JSON.parse(fs.readFileSync(messagesFile, 'utf-8'))
  console.log(`✅ Loaded ${allMessages.length} messages\n`)

  // Separate user and AI messages
  const userMessages = allMessages.filter(m => m.sender === 'user')
  const aiMessages = allMessages.filter(m => m.sender === 'ai')

  // Analyze AI messages
  const aiAnalysis = aiMessages.map((msg, idx) => {
    const text = msg.message
    const words = countWords(text)

    return {
      index: idx,
      originalIndex: allMessages.indexOf(msg),
      day: msg.day,
      phase: msg.phase,
      text: text,
      wordCount: words,
      hasSeparator: text.includes('|') || text.includes('|||'),
      hasRomanticTone: /miss u|miss you|babe|sweet|💖|😘|🥺|love u|ily/i.test(text),
      hasBabe: /babe/i.test(text),
      hasMoneyRequest: /\$|dollar|bill|pay|help me|need money|paypal|venmo|cashapp/i.test(text),
      hasPaymentTag: text.includes('[PAYMENT_RECEIVED]'),
      hasVoiceTag: text.includes('[VOICE]'),
      isOver8Words: words > 8 && !text.includes('|') && !text.includes('|||'),
      trustScore: msg.trustScore,
      escalationTier: msg.escalationTier
    }
  })

  // Analyze user messages
  const userAnalysis = userMessages.map((msg, idx) => {
    const text = msg.message

    return {
      index: idx,
      originalIndex: allMessages.indexOf(msg),
      day: msg.day,
      phase: msg.phase,
      text: text,
      hasIRLRequest: /meet|see you|see u|come over|hang out|visit|irl|lets meet|wanna meet/i.test(text),
      hasPicRequest: /pic|photo|selfie|picture|send pic|send me/i.test(text),
      hasVoiceRequest: /voice|voice note|record|hear you|hear u/i.test(text),
      hasFakeAccusation: /fake|bot|scam|real|prove/i.test(text),
      offersMoney: /help|send|paypal|venmo|cashapp|sent/i.test(text)
    }
  })

  // Find IRL interactions
  const irlInteractions = []
  for (let i = 0; i < allMessages.length - 1; i++) {
    const msg = allMessages[i]
    const nextMsg = allMessages[i + 1]

    if (msg.sender === 'user' && nextMsg.sender === 'ai') {
      const userHasIRL = /meet|see you|see u|come over|hang out|visit|irl|lets meet|wanna meet/i.test(msg.message)
      if (userHasIRL) {
        const aiRefused = /mom|cant|not allowed|dont think|my parents|shes strict|wouldnt let/i.test(nextMsg.message)
        irlInteractions.push({
          messageIndex: i,
          day: msg.day,
          phase: msg.phase,
          userMessage: msg.message,
          aiMessage: nextMsg.message,
          refused: aiRefused
        })
      }
    }
  }

  // Find pic/voice interactions
  const picInteractions = []
  const voiceInteractions = []
  for (let i = 0; i < allMessages.length - 1; i++) {
    const msg = allMessages[i]
    const nextMsg = allMessages[i + 1]

    if (msg.sender === 'user' && nextMsg.sender === 'ai') {
      // Pic request
      if (/pic|photo|selfie|picture|send pic|send me/i.test(msg.message)) {
        const refused = /not comfortable|cant|dont|wont|no/i.test(nextMsg.message) || !nextMsg.message.includes('[MEDIA')
        picInteractions.push({
          messageIndex: i,
          day: msg.day,
          phase: msg.phase,
          userMessage: msg.message,
          aiMessage: nextMsg.message,
          refused: refused
        })
      }

      // Voice request
      if (/voice|voice note|record|hear you|hear u/i.test(msg.message)) {
        const hasFake = /fake|bot|scam|real|prove/i.test(msg.message)
        const sentVoice = nextMsg.message.includes('[VOICE]')
        voiceInteractions.push({
          messageIndex: i,
          day: msg.day,
          phase: msg.phase,
          userMessage: msg.message,
          aiMessage: nextMsg.message,
          sentVoice: sentVoice,
          wasFakeAccusation: hasFake
        })
      }
    }
  }

  // Group by phase
  const byPhase = {
    CONNECTION: aiAnalysis.filter(a => a.phase === 'CONNECTION'),
    VULNERABILITY: aiAnalysis.filter(a => a.phase === 'VULNERABILITY'),
    CRISIS: aiAnalysis.filter(a => a.phase === 'CRISIS'),
    MONEYPOT: aiAnalysis.filter(a => a.phase === 'MONEYPOT')
  }

  // Calculate statistics
  const totalWords = aiAnalysis.reduce((sum, a) => sum + a.wordCount, 0)
  const avgWords = totalWords / aiAnalysis.length

  const over8Words = aiAnalysis.filter(a => a.isOver8Words)
  const over8Rate = (over8Words.length / aiAnalysis.length) * 100

  const withSeparator = aiAnalysis.filter(a => a.hasSeparator)
  const separatorRate = (withSeparator.length / aiAnalysis.length) * 100

  const romantic = aiAnalysis.filter(a => a.hasRomanticTone)
  const romanticRate = (romantic.length / aiAnalysis.length) * 100

  const babeMessages = aiAnalysis.filter(a => a.hasBabe)
  const babeRate = (babeMessages.length / aiAnalysis.length) * 100

  const moneyRequests = aiAnalysis.filter(a => a.hasMoneyRequest)
  const paymentTags = aiAnalysis.filter(a => a.hasPaymentTag)
  const voiceTags = aiAnalysis.filter(a => a.hasVoiceTag)

  // Phase 4 specific
  const phase4AI = byPhase.MONEYPOT
  const phase4Romantic = phase4AI.filter(a => a.hasRomanticTone)
  const phase4RomanticRate = phase4AI.length > 0 ? (phase4Romantic.length / phase4AI.length) * 100 : 0

  const phase4Babe = phase4AI.filter(a => a.hasBabe)
  const phase4BabeRate = phase4AI.length > 0 ? (phase4Babe.length / phase4AI.length) * 100 : 0

  // Generate report
  let report = `# 📊 ANALYSE COMPLÈTE - TEST LIFECYCLE 350 MESSAGES\n\n`
  report += `**Date:** ${new Date().toISOString()}\n`
  report += `**Total Messages:** ${allMessages.length}\n`
  report += `**Messages User:** ${userMessages.length}\n`
  report += `**Messages AI:** ${aiMessages.length}\n`
  report += `**Durée Simulée:** ${Math.max(...allMessages.map(m => m.day))} jours\n\n`

  report += `---\n\n## 📈 MÉTRIQUES GLOBALES\n\n`

  report += `### 💬 Style & Brevity\n\n`
  report += `| Métrique | Valeur | Target | Status |\n`
  report += `|----------|--------|--------|--------|\n`
  report += `| Avg Words/Message | ${avgWords.toFixed(1)} | 3-5 | ${avgWords >= 3 && avgWords <= 5 ? '✅' : '⚠️'} |\n`
  report += `| Messages >8 Words | ${over8Words.length} (${over8Rate.toFixed(1)}%) | <5% | ${over8Rate < 5 ? '✅' : '❌'} |\n`
  report += `| Messages avec \| | ${withSeparator.length} (${separatorRate.toFixed(1)}%) | High | ${separatorRate > 50 ? '✅' : '⚠️'} |\n\n`

  report += `### ❤️ Ton Émotionnel\n\n`
  report += `| Métrique | Valeur | Target | Status |\n`
  report += `|----------|--------|--------|--------|\n`
  report += `| Messages romantiques (global) | ${romantic.length} (${romanticRate.toFixed(1)}%) | - | - |\n`
  report += `| Usage "babe" (global) | ${babeMessages.length} (${babeRate.toFixed(1)}%) | - | - |\n`
  report += `| **Phase 4 Romantic** | ${phase4Romantic.length}/${phase4AI.length} (${phase4RomanticRate.toFixed(1)}%) | **>80%** | ${phase4RomanticRate > 80 ? '✅' : '❌'} |\n`
  report += `| **Phase 4 "babe"** | ${phase4Babe.length}/${phase4AI.length} (${phase4BabeRate.toFixed(1)}%) | **10-20%** | ${phase4BabeRate >= 10 && phase4BabeRate <= 20 ? '✅' : '⚠️'} |\n\n`

  report += `### 💰 Demandes & Tags Spéciaux\n\n`
  report += `- **Money Requests:** ${moneyRequests.length}\n`
  report += `- **[PAYMENT_RECEIVED] tags:** ${paymentTags.length}\n`
  report += `- **[VOICE] tags:** ${voiceTags.length}\n\n`

  report += `### 🚫 Refus & Comportements\n\n`
  report += `| Type | Demandes | Refusés | Rate | Status |\n`
  report += `|------|----------|---------|------|--------|\n`
  report += `| IRL Meetings | ${irlInteractions.length} | ${irlInteractions.filter(i => i.refused).length} | ${irlInteractions.length > 0 ? ((irlInteractions.filter(i => i.refused).length / irlInteractions.length) * 100).toFixed(1) : '0'}% | ${irlInteractions.every(i => i.refused) ? '✅' : '❌'} |\n`
  report += `| Photos | ${picInteractions.length} | ${picInteractions.filter(i => i.refused).length} | ${picInteractions.length > 0 ? ((picInteractions.filter(i => i.refused).length / picInteractions.length) * 100).toFixed(1) : '0'}% | ${picInteractions.every(i => i.refused) ? '✅' : '⚠️'} |\n`
  report += `| Voice (non-fake) | ${voiceInteractions.filter(v => !v.wasFakeAccusation).length} | ${voiceInteractions.filter(v => !v.wasFakeAccusation && !v.sentVoice).length} | ${voiceInteractions.filter(v => !v.wasFakeAccusation).length > 0 ? ((voiceInteractions.filter(v => !v.wasFakeAccusation && !v.sentVoice).length / voiceInteractions.filter(v => !v.wasFakeAccusation).length) * 100).toFixed(1) : '0'}% | - |\n`
  report += `| Voice (fake accusation) | ${voiceInteractions.filter(v => v.wasFakeAccusation).length} | ${voiceInteractions.filter(v => v.wasFakeAccusation && v.sentVoice).length} sent | - | - |\n\n`

  report += `---\n\n## 📊 DISTRIBUTION PAR PHASE\n\n`
  report += `| Phase | Messages AI | Avg Words | >8 Words | Romantic | "babe" | Money Req |\n`
  report += `|-------|-------------|-----------|----------|----------|--------|----------|\n`

  for (const [phaseName, phaseData] of Object.entries(byPhase)) {
    const phaseAvg = phaseData.reduce((sum, a) => sum + a.wordCount, 0) / (phaseData.length || 1)
    const phaseOver8 = phaseData.filter(a => a.isOver8Words).length
    const phaseRomantic = phaseData.filter(a => a.hasRomanticTone).length
    const phaseBabe = phaseData.filter(a => a.hasBabe).length
    const phaseMoney = phaseData.filter(a => a.hasMoneyRequest).length

    report += `| ${phaseName} | ${phaseData.length} | ${phaseAvg.toFixed(1)} | ${phaseOver8} | ${phaseRomantic} | ${phaseBabe} | ${phaseMoney} |\n`
  }

  report += `\n---\n\n## 🔍 DÉTAILS DES REFUS IRL\n\n`
  if (irlInteractions.length > 0) {
    irlInteractions.forEach((interaction, idx) => {
      report += `### ${idx + 1}. Message #${interaction.messageIndex} - Day ${interaction.day} (${interaction.phase}) ${interaction.refused ? '✅' : '❌'}\n\n`
      report += `**User:** "${interaction.userMessage}"\n\n`
      report += `**Lena:** "${interaction.aiMessage}"\n\n`
      report += `**Status:** ${interaction.refused ? '✅ Refused correctly' : '❌ NOT REFUSED - Should mention mom/parents/not allowed'}\n\n`
      report += `---\n\n`
    })
  } else {
    report += `Aucune demande IRL détectée.\n\n`
  }

  report += `## 📸 DÉTAILS DES DEMANDES DE PHOTOS\n\n`
  if (picInteractions.length > 0) {
    picInteractions.forEach((interaction, idx) => {
      report += `### ${idx + 1}. Message #${interaction.messageIndex} - Day ${interaction.day} (${interaction.phase}) ${interaction.refused ? '✅' : '⚠️'}\n\n`
      report += `**User:** "${interaction.userMessage}"\n\n`
      report += `**Lena:** "${interaction.aiMessage}"\n\n`
      report += `**Status:** ${interaction.refused ? '✅ Refused' : '⚠️ May have sent pic'}\n\n`
      report += `---\n\n`
    })
  } else {
    report += `Aucune demande de photo détectée.\n\n`
  }

  report += `## 🎤 DÉTAILS DES DEMANDES VOCALES\n\n`
  if (voiceInteractions.length > 0) {
    voiceInteractions.forEach((interaction, idx) => {
      report += `### ${idx + 1}. Message #${interaction.messageIndex} - Day ${interaction.day} (${interaction.phase}) ${interaction.sentVoice ? '🔊' : '🔇'}\n\n`
      report += `**User:** "${interaction.userMessage}"\n\n`
      report += `**Lena:** "${interaction.aiMessage}"\n\n`
      report += `**Fake Accusation:** ${interaction.wasFakeAccusation ? 'Yes' : 'No'}\n`
      report += `**Sent Voice:** ${interaction.sentVoice ? 'Yes' : 'No'}\n`
      report += `**Status:** ${interaction.wasFakeAccusation && interaction.sentVoice ? '✅ Correct (proved not fake)' : interaction.wasFakeAccusation && !interaction.sentVoice ? '❌ Should send voice to prove' : !interaction.wasFakeAccusation && !interaction.sentVoice ? '✅ Correct (refused)' : '⚠️ Sent voice without being accused'}\n\n`
      report += `---\n\n`
    })
  } else {
    report += `Aucune demande vocale détectée.\n\n`
  }

  report += `---\n\n## 💬 ÉCHANTILLON DE MESSAGES PAR PHASE\n\n`

  // Phase 1
  report += `### PHASE 1: CONNECTION (${byPhase.CONNECTION.length} messages AI)\n\n`
  byPhase.CONNECTION.slice(0, 15).forEach((msg, idx) => {
    const warnings = []
    if (msg.isOver8Words) warnings.push('⚠️ >8 words')
    if (!msg.hasSeparator && msg.wordCount > 5) warnings.push('⚠️ no separator')
    report += `${idx + 1}. [Day ${msg.day}] "${msg.text}" **(${msg.wordCount} words)** ${warnings.join(' ')}\n`
  })

  // Phase 2
  report += `\n### PHASE 2: VULNERABILITY (${byPhase.VULNERABILITY.length} messages AI)\n\n`
  byPhase.VULNERABILITY.slice(0, 15).forEach((msg, idx) => {
    const tags = []
    if (msg.hasRomanticTone) tags.push('❤️')
    if (msg.isOver8Words) tags.push('⚠️ >8w')
    if (msg.hasVoiceTag) tags.push('🎤')
    report += `${idx + 1}. [Day ${msg.day}] "${msg.text}" **(${msg.wordCount} words)** ${tags.join(' ')}\n`
  })

  // Phase 3
  report += `\n### PHASE 3: CRISIS (${byPhase.CRISIS.length} messages AI - showing 20)\n\n`
  byPhase.CRISIS.slice(0, 20).forEach((msg, idx) => {
    const tags = []
    if (msg.hasMoneyRequest) tags.push('💰')
    if (msg.hasPaymentTag) tags.push('💳 [PAYMENT_RECEIVED]')
    if (msg.isOver8Words) tags.push('⚠️ >8w')
    report += `${idx + 1}. [Day ${msg.day}] "${msg.text}" **(${msg.wordCount} words)** ${tags.join(' ')}\n`
  })

  // Phase 4
  report += `\n### PHASE 4: MONEYPOT (${byPhase.MONEYPOT.length} messages AI - showing 25)\n\n`
  byPhase.MONEYPOT.slice(0, 25).forEach((msg, idx) => {
    const tags = []
    if (msg.hasRomanticTone) tags.push('❤️')
    if (msg.hasBabe) tags.push('💕 babe')
    if (msg.hasMoneyRequest) tags.push('💰')
    if (msg.isOver8Words) tags.push('⚠️ >8w')
    report += `${idx + 1}. [Day ${msg.day}, Tier ${msg.escalationTier || 0}] "${msg.text}" **(${msg.wordCount} words)** ${tags.join(' ')}\n`
  })

  report += `\n---\n\n## 🎯 MESSAGES PROBLÉMATIQUES (>8 mots sans séparateur)\n\n`
  if (over8Words.length > 0) {
    report += `**Total:** ${over8Words.length} messages (${over8Rate.toFixed(1)}%)\n\n`
    over8Words.slice(0, 30).forEach((msg, idx) => {
      report += `${idx + 1}. [${msg.phase}, Day ${msg.day}] "${msg.text}" **(${msg.wordCount} words)**\n`
    })
    if (over8Words.length > 30) {
      report += `\n... et ${over8Words.length - 30} autres messages problématiques\n`
    }
  } else {
    report += `✅ Aucun message problématique détecté!\n`
  }

  report += `\n---\n\n## 🎯 MESSAGES ROMANTIQUES (Phase 4)\n\n`
  if (phase4Romantic.length > 0) {
    report += `**Total:** ${phase4Romantic.length}/${phase4AI.length} messages (${phase4RomanticRate.toFixed(1)}%)\n\n`
    phase4Romantic.slice(0, 20).forEach((msg, idx) => {
      report += `${idx + 1}. [Day ${msg.day}] "${msg.text}"\n`
    })
  } else {
    report += `❌ Aucun message romantique détecté en Phase 4\n`
  }

  report += `\n---\n\n## 💰 MONEY REQUESTS\n\n`
  if (moneyRequests.length > 0) {
    report += `**Total:** ${moneyRequests.length} demandes\n\n`
    moneyRequests.forEach((msg, idx) => {
      report += `${idx + 1}. [${msg.phase}, Day ${msg.day}] "${msg.text}"\n`
    })
  } else {
    report += `Aucune demande d'argent détectée\n`
  }

  report += `\n---\n\n## ✅ RÉSUMÉ FINAL\n\n`

  const criticalIssues = []
  const warnings = []
  const successes = []

  if (over8Rate >= 5) {
    criticalIssues.push(`❌ Messages trop longs: ${over8Rate.toFixed(1)}% >8 mots (target: <5%)`)
  } else {
    successes.push(`✅ Messages concis: ${over8Rate.toFixed(1)}% >8 mots`)
  }

  if (phase4RomanticRate < 80) {
    criticalIssues.push(`❌ Ton pas assez romantique en Phase 4: ${phase4RomanticRate.toFixed(1)}% (target: >80%)`)
  } else {
    successes.push(`✅ Ton romantique excellent en Phase 4: ${phase4RomanticRate.toFixed(1)}%`)
  }

  if (!irlInteractions.every(i => i.refused)) {
    criticalIssues.push(`❌ Refus IRL échoués: ${irlInteractions.filter(i => !i.refused).length}/${irlInteractions.length}`)
  } else if (irlInteractions.length > 0) {
    successes.push(`✅ Tous les IRL refusés correctement: ${irlInteractions.length}/${irlInteractions.length}`)
  }

  if (separatorRate < 30) {
    warnings.push(`⚠️ Peu de séparateurs utilisés: ${separatorRate.toFixed(1)}%`)
  } else {
    successes.push(`✅ Bon usage des séparateurs: ${separatorRate.toFixed(1)}%`)
  }

  if (phase4BabeRate < 10 || phase4BabeRate > 20) {
    warnings.push(`⚠️ Usage "babe" hors target en Phase 4: ${phase4BabeRate.toFixed(1)}% (target: 10-20%)`)
  } else {
    successes.push(`✅ Usage "babe" optimal en Phase 4: ${phase4BabeRate.toFixed(1)}%`)
  }

  report += `### ❌ Issues Critiques (${criticalIssues.length})\n\n`
  if (criticalIssues.length > 0) {
    criticalIssues.forEach(issue => report += `${issue}\n`)
  } else {
    report += `Aucune issue critique! 🎉\n`
  }

  report += `\n### ⚠️ Warnings (${warnings.length})\n\n`
  if (warnings.length > 0) {
    warnings.forEach(warning => report += `${warning}\n`)
  } else {
    report += `Aucun warning!\n`
  }

  report += `\n### ✅ Succès (${successes.length})\n\n`
  successes.forEach(success => report += `${success}\n`)

  report += `\n---\n\n`
  report += `**Score Global:** ${successes.length}/${criticalIssues.length + warnings.length + successes.length} validations passed\n`
  report += `**Status:** ${criticalIssues.length === 0 ? '✅ PASS' : criticalIssues.length <= 2 ? '⚠️ PARTIAL PASS' : '❌ FAIL'}\n`

  // Save report
  const reportFile = 'test-message-analysis-complete.md'
  fs.writeFileSync(reportFile, report)

  console.log(`\n✅ Complete analysis saved to: ${reportFile}`)
  console.log(`\n${report}`)
}

try {
  analyzeMessages()
} catch (error) {
  console.error('Error:', error)
  process.exit(1)
}
