
import { toZonedTime, format } from 'date-fns-tz';

const now = new Date();
const tz = 'America/Los_Angeles';

console.log('--- Debug ---');
console.log('Original (Local):', now.toString());
console.log('TZ:', tz);

// 1. Zone the date
const zoned = toZonedTime(now, tz);
console.log('Zoned Date .toString():', zoned.toString()); // Should look like Local but with shifted hours

// 2. Format implementations
const fmt1 = format(zoned, 'HH:mm');
console.log('format(zoned, "HH:mm"):', fmt1);

const fmt2 = format(zoned, 'HH:mm', { timeZone: tz });
console.log('format(zoned, "HH:mm", { timeZone }):', fmt2);

const fmt3 = format(now, 'HH:mm', { timeZone: tz });
console.log('format(now, "HH:mm", { timeZone }):', fmt3);
