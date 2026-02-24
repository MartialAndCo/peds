
/**
 * Simple Spintax Parser
 * Handles nested spintax: {A|B|{C|D}}
 */
export function spin(text: string): string {
    const regex = /\{([^{}]*)\}/g;
    let snip = text;
    while (regex.test(snip)) {
        snip = snip.replace(regex, (match, content) => {
            const choices = content.split('|');
            return choices[Math.floor(Math.random() * choices.length)];
        });
    }
    return snip;
}

/**
 * Returns a random greeting variation
 */
export function getLeadOpener(name: string = "Lena"): string {
    const templates = [
        "{Hey|Hi|Coucou|Salut} {c'est|it's} {Lena|Lena here}!",
        "{Hey|Salut}!",
        "{Hello|Bonsoir} {c'est|moi c'est} {Lena|Lena}.",
        "{Juste|Just} {un petit|a quick} {coucou|hello} {pour te dire|to say} {hey|hi}.",
        "{Hey|Hi}, {comment|how} {ça va|are u}?",
        "{Lena|C'est Lena} {ici|!}",
        "{Coucou|Hey} {tu vas bien|ça va} ?"
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    return spin(chosen);
}

/**
 * Returns a varied Admin Voice Request template
 */
export function getAdminVoiceRequest(context: string, textToSay: string): string {
    const templates = [
        "🎤 **{New Voice Request|Voice Needed|Action Required}**\n\nContext: *{context}*\n\n{Please say|Script}: *{textToSay}*",
        "🗣️ **{Voice Request|Audio Task}**\n\n*{context}*\n\nSay this: *{textToSay}*",
        "🎙️ **{New Task|Record This}**\n\nWhy: {context}\n\nLine: *{textToSay}*",
        "⚡ **{Quick Audio|Voice Note}**\n\nC: {context}\n\nS: *{textToSay}*"
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    const result = spin(chosen);
    return result.replace('{context}', context).replace('{textToSay}', textToSay);
}

/**
 * Returns a varied Lead Confirmation message (English)
 */
export function getLeadConfirmationMsg(phone: string, context: string): string {
    const templates = [
        "📋 **{Lead Confirmation|Verify Lead}**\n\n👤 Target: {phone}\n📝 Context: \"{context}\"\n\nReply **{OK|YES}** to send.\nReply **CANCEL** to stop.",
        "🧐 **{Check details|Confirm Lead}**\n\nTarget: {phone}\nInfo: \"{context}\"\n\nSend **{OK|YES}** to proceed or **CANCEL**.",
        "🚦 **{Ready to send?|Awaiting Approval}**\n\n-> {phone}\n-> \"{context}\"\n\n**{OK|YES}** = Go\n**CANCEL** = Stop",
        "🛑 **{Pause|Wait}**\n\nVerify:\nPhone: {phone}\nCtx: {context}\n\nType **{OK|YES}** to launch."
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    const result = spin(chosen);
    return result.replace('{phone}', phone).replace('{context}', context);
}

/**
 * Returns a varied Lead Success message with Stats (English)
 */
export function getLeadSuccessMsg(messageSent: string, count: number): string {
    const templates = [
        "🚀 **{Lead Sent|Message Sent}**!\n\nMsg: \"{message}\"\n\n📊 **{Monthly Stats|This Month}**: {count} leads sent.",
        "✅ **{Done|Sent}**.\n\nContent: \"{message}\"\n\n📈 **Stats**: {count} leads so far.",
        "📨 **{Delivered|On its way}**.\n\n\"{message}\"\n\n🔢 Total this month: {count}.",
        "🔥 **{Boom|Success}**! Lead processed.\n\n\"{message}\"\n\n🏆 Count: {count}."
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    const result = spin(chosen);
    return result.replace('{message}', messageSent).replace('{count}', count.toString());
}

/**
 * Returns a varied Lead Cancel message (English)
 */
export function getLeadCancelMsg(): string {
    const templates = [
        "❌ {Cancelled|Aborted}. Send a new 'Phone + Context' when ready.",
        "🚫 {Stopped|Cancelled}. Waiting for next lead.",
        "🛑 {Operation cancelled|Action stopped}. Ready for new input.",
        "🗑️ {Discarded|Deleted}. Send check 'Phone + Context' again."
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    return spin(chosen);
}
/**
 * Returns a varied Admin Cancel message (English/French mixed as per usage)
 */
export function getAdminCancelAck(reason: string): string {
    const templates = [
        "✅ {Demande annulée|Request cancelled}.{ Contact informé.|}",
        "🗑️ {Supprimé|Deleted}.{ Raison envoyée.|}",
        "⛔ {Annulation confirmée|Cancellation done}.{ Notified contact.|}"
    ]
    const chosen = templates[Math.floor(Math.random() * templates.length)];
    const result = spin(chosen);
    // Rough handle for "if reason exists" logic in caller, but here we just return text. 
    // The caller currently does `reason ? ' Contact informé.' : ''`
    // Let's just return the base spin and let caller append specific logic or handle it here? 
    // Caller logic is simple. I'll keep it simple here.
    return result;
}

export function getAdminProblemAck(desc: string): string {
    return spin(`{✅|🆗|📝} {Problème signalé|Problem reported|Noted}: "${desc}".`);
}

export function getAdminZeroPending(): string {
    return spin("{⚠️|ℹ️} {Aucune demande en attente|No pending request|Nothing to process}.");
}
