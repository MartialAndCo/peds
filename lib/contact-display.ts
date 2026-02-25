type ContactLike = {
    name?: string | null
    phone_whatsapp?: string | null
    age?: number | string | null
    profile?: {
        name?: string | null
        age?: number | string | null
        birthDate?: string | Date | null
    } | Record<string, unknown> | null
    lead?: {
        age?: number | null
    } | null
    intelligentProfile?: {
        birthDate?: string | Date | null
    } | null
    birthDate?: string | Date | null
} | null | undefined

const UNKNOWN_NAME_PATTERN = /^(inconnu|unknown|discord user)$/i
const MIN_VALID_AGE = 12
const MAX_VALID_AGE = 100

const DIAL_CODE_TO_COUNTRY: Record<string, string> = {
    '1': 'US',
    '7': 'RU',
    '20': 'EG',
    '27': 'ZA',
    '30': 'GR',
    '31': 'NL',
    '32': 'BE',
    '33': 'FR',
    '34': 'ES',
    '39': 'IT',
    '40': 'RO',
    '41': 'CH',
    '43': 'AT',
    '44': 'GB',
    '45': 'DK',
    '46': 'SE',
    '47': 'NO',
    '48': 'PL',
    '49': 'DE',
    '51': 'PE',
    '52': 'MX',
    '53': 'CU',
    '54': 'AR',
    '55': 'BR',
    '56': 'CL',
    '57': 'CO',
    '58': 'VE',
    '60': 'MY',
    '61': 'AU',
    '62': 'ID',
    '63': 'PH',
    '64': 'NZ',
    '65': 'SG',
    '66': 'TH',
    '81': 'JP',
    '82': 'KR',
    '84': 'VN',
    '86': 'CN',
    '90': 'TR',
    '91': 'IN',
    '92': 'PK',
    '93': 'AF',
    '94': 'LK',
    '95': 'MM',
    '98': 'IR',
    '212': 'MA',
    '213': 'DZ',
    '216': 'TN',
    '218': 'LY',
    '220': 'GM',
    '221': 'SN',
    '222': 'MR',
    '223': 'ML',
    '224': 'GN',
    '225': 'CI',
    '226': 'BF',
    '227': 'NE',
    '228': 'TG',
    '229': 'BJ',
    '230': 'MU',
    '231': 'LR',
    '232': 'SL',
    '233': 'GH',
    '234': 'NG',
    '235': 'TD',
    '236': 'CF',
    '237': 'CM',
    '238': 'CV',
    '239': 'ST',
    '240': 'GQ',
    '241': 'GA',
    '242': 'CG',
    '243': 'CD',
    '244': 'AO',
    '245': 'GW',
    '248': 'SC',
    '249': 'SD',
    '250': 'RW',
    '251': 'ET',
    '252': 'SO',
    '253': 'DJ',
    '254': 'KE',
    '255': 'TZ',
    '256': 'UG',
    '257': 'BI',
    '258': 'MZ',
    '260': 'ZM',
    '261': 'MG',
    '262': 'RE',
    '263': 'ZW',
    '264': 'NA',
    '265': 'MW',
    '266': 'LS',
    '267': 'BW',
    '268': 'SZ',
    '269': 'KM',
    '290': 'SH',
    '291': 'ER',
    '297': 'AW',
    '298': 'FO',
    '299': 'GL',
    '350': 'GI',
    '351': 'PT',
    '352': 'LU',
    '353': 'IE',
    '354': 'IS',
    '355': 'AL',
    '356': 'MT',
    '357': 'CY',
    '358': 'FI',
    '359': 'BG',
    '370': 'LT',
    '371': 'LV',
    '372': 'EE',
    '373': 'MD',
    '374': 'AM',
    '375': 'BY',
    '376': 'AD',
    '377': 'MC',
    '378': 'SM',
    '380': 'UA',
    '381': 'RS',
    '382': 'ME',
    '383': 'XK',
    '385': 'HR',
    '386': 'SI',
    '387': 'BA',
    '389': 'MK',
    '420': 'CZ',
    '421': 'SK',
    '423': 'LI',
    '500': 'FK',
    '501': 'BZ',
    '502': 'GT',
    '503': 'SV',
    '504': 'HN',
    '505': 'NI',
    '506': 'CR',
    '507': 'PA',
    '508': 'PM',
    '509': 'HT',
    '591': 'BO',
    '592': 'GY',
    '593': 'EC',
    '594': 'GF',
    '595': 'PY',
    '596': 'MQ',
    '597': 'SR',
    '598': 'UY',
    '599': 'CW',
    '670': 'TL',
    '672': 'NF',
    '673': 'BN',
    '674': 'NR',
    '675': 'PG',
    '676': 'TO',
    '677': 'SB',
    '678': 'VU',
    '679': 'FJ',
    '680': 'PW',
    '681': 'WF',
    '682': 'CK',
    '683': 'NU',
    '685': 'WS',
    '686': 'KI',
    '687': 'NC',
    '688': 'TV',
    '689': 'PF',
    '690': 'TK',
    '691': 'FM',
    '692': 'MH',
    '850': 'KP',
    '852': 'HK',
    '853': 'MO',
    '855': 'KH',
    '856': 'LA',
    '880': 'BD',
    '886': 'TW',
    '960': 'MV',
    '961': 'LB',
    '962': 'JO',
    '963': 'SY',
    '964': 'IQ',
    '965': 'KW',
    '966': 'SA',
    '967': 'YE',
    '968': 'OM',
    '970': 'PS',
    '971': 'AE',
    '972': 'IL',
    '973': 'BH',
    '974': 'QA',
    '975': 'BT',
    '976': 'MN',
    '977': 'NP',
    '992': 'TJ',
    '993': 'TM',
    '994': 'AZ',
    '995': 'GE',
    '996': 'KG',
    '998': 'UZ'
}

const SORTED_DIAL_CODES = Object.keys(DIAL_CODE_TO_COUNTRY).sort((a, b) => b.length - a.length)
const CANADIAN_AREA_CODES = new Set([
    '204', '226', '236', '249', '250', '263', '289', '306', '343', '354', '365', '367', '368',
    '382', '403', '416', '418', '428', '431', '437', '438', '450', '468', '474', '506', '514',
    '519', '548', '579', '581', '584', '587', '600', '604', '613', '639', '647', '672', '683',
    '705', '709', '742', '753', '778', '780', '782', '807', '819', '825', '867', '873', '879',
    '902', '942'
])

function normalizeName(value?: string | null): string {
    if (!value) return ''
    return value.trim()
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

function parseAge(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const rounded = Math.floor(value)
        if (rounded >= MIN_VALID_AGE && rounded <= MAX_VALID_AGE) return rounded
        return null
    }

    if (typeof value === 'string') {
        const match = value.match(/\b(\d{1,3})\b/)
        if (!match) return null
        const parsed = Number(match[1])
        if (!Number.isFinite(parsed)) return null
        if (parsed < MIN_VALID_AGE || parsed > MAX_VALID_AGE) return null
        return parsed
    }

    return null
}

function parseAgeFromBirthDate(value: unknown): number | null {
    if (!(typeof value === 'string' || value instanceof Date)) return null
    const birthDate = new Date(value)
    if (Number.isNaN(birthDate.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    const isBeforeBirthday = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
    if (isBeforeBirthday) age -= 1

    if (age < MIN_VALID_AGE || age > MAX_VALID_AGE) return null
    return age
}

function getContactAge(contact: ContactLike): number | null {
    const profile = asObject(contact?.profile)
    const directAge = parseAge(contact?.age)
        ?? parseAge(profile?.age)
        ?? parseAge(contact?.lead?.age)
    if (directAge) return directAge

    return parseAgeFromBirthDate(contact?.birthDate)
        ?? parseAgeFromBirthDate(profile?.birthDate)
        ?? parseAgeFromBirthDate(contact?.intelligentProfile?.birthDate)
}

function extractDialDigits(phone?: string | null): string | null {
    if (!phone) return null
    const raw = phone.trim()
    if (!raw) return null
    if (/^DISCORD_/i.test(raw) || /@discord/i.test(raw)) return null

    const beforeAt = raw.split('@')[0]
    const hasInternationalPrefix = beforeAt.startsWith('+') || beforeAt.startsWith('00')
    let digits = beforeAt.replace(/\D/g, '')
    if (!digits) return null

    if (beforeAt.startsWith('00')) {
        digits = digits.slice(2)
    } else if (!hasInternationalPrefix && digits.length <= 10) {
        return null
    }

    return digits
}

function getCountryFromPhone(phone?: string | null): string | null {
    const digits = extractDialDigits(phone)
    if (!digits) return null

    // NANP split: +1 can be US or CA. Infer with 3-digit area code.
    if (digits.startsWith('1') && digits.length >= 4) {
        const areaCode = digits.slice(1, 4)
        if (CANADIAN_AREA_CODES.has(areaCode)) {
            return 'CA'
        }
        return 'US'
    }

    for (const dialCode of SORTED_DIAL_CODES) {
        if (digits.startsWith(dialCode)) {
            return DIAL_CODE_TO_COUNTRY[dialCode]
        }
    }
    return null
}

function getBaseContactDisplayName(contact: ContactLike, fallback = 'Inconnu'): string {
    const rawName = normalizeName(contact?.name)
    const profile = asObject(contact?.profile)
    const profileName = normalizeName(typeof profile?.name === 'string' ? profile.name : '')

    const isUnknown = !rawName || UNKNOWN_NAME_PATTERN.test(rawName)
    if (isUnknown && profileName) return profileName
    if (rawName) return rawName
    if (profileName) return profileName
    return fallback
}

function getContactMetaSuffix(contact: ContactLike): string {
    const age = getContactAge(contact)
    const country = getCountryFromPhone(contact?.phone_whatsapp)

    const parts: string[] = []
    if (age) {
        const ageUnit = country === 'FR' ? 'ans' : 'yo'
        parts.push(`${age} ${ageUnit}`)
    }
    if (country) {
        parts.push(country)
    }

    if (parts.length === 0) return ''
    return `, ${parts.join(', ')}`
}

export function getContactDisplayName(
    contact: ContactLike,
    fallback = 'Inconnu',
    options?: { includeMeta?: boolean }
): string {
    const includeMeta = options?.includeMeta ?? true
    const baseName = getBaseContactDisplayName(contact, fallback)
    if (!includeMeta || !baseName) return baseName
    return `${baseName}${getContactMetaSuffix(contact)}`
}

export function getContactInitial(contact: ContactLike, fallback = '?'): string {
    const name = getContactDisplayName(contact, '', { includeMeta: false })
    const first = name.charAt(0)
    return (first || fallback).toUpperCase()
}
