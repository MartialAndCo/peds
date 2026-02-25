type ContactLike = {
    name?: string | null
    profile?: { name?: string | null } | null
} | null | undefined

const UNKNOWN_NAME_PATTERN = /^(inconnu|unknown|discord user)$/i

function normalizeName(value?: string | null): string {
    if (!value) return ''
    return value.trim()
}

export function getContactDisplayName(contact: ContactLike, fallback = 'Inconnu'): string {
    const rawName = normalizeName(contact?.name)
    const profileName = normalizeName(contact?.profile?.name)

    const isUnknown = !rawName || UNKNOWN_NAME_PATTERN.test(rawName)
    if (isUnknown && profileName) return profileName
    if (rawName) return rawName
    if (profileName) return profileName
    return fallback
}

export function getContactInitial(contact: ContactLike, fallback = '?'): string {
    const name = getContactDisplayName(contact, '')
    const first = name.charAt(0)
    return (first || fallback).toUpperCase()
}

