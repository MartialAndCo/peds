
import { toZonedTime, format } from 'date-fns-tz';

const now = new Date();
console.log('UTC (toISOString):', now.toISOString());

const tzs = ['Europe/Paris', 'America/Los_Angeles', 'Asia/Tokyo'];

tzs.forEach(tz => {
    try {
        const zoned = toZonedTime(now, tz);
        console.log(`\n--- ${tz} ---`);
        console.log('Zoned Date object:', zoned.toString());
        console.log('Hours (local):', zoned.getHours());
        console.log('Formatted:', format(zoned, 'yyyy-MM-dd HH:mm:ss', { timeZone: tz }));
    } catch (e) {
        console.error(`Error with ${tz}:`, e);
    }
});
