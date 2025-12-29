
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
