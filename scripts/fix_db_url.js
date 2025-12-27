const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const newDbUrl = 'postgresql://postgres.cfpcmrecikujyjammjck:Bhcmi6pm_@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

try {
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
    }

    const lines = content.split('\n');
    let found = false;
    const newLines = lines.map(line => {
        if (line.startsWith('DATABASE_URL=')) {
            found = true;
            return `DATABASE_URL="${newDbUrl}"`;
        }
        return line;
    });

    if (!found) {
        newLines.push(`DATABASE_URL="${newDbUrl}"`);
    }

    fs.writeFileSync(envPath, newLines.join('\n'));
    console.log('Successfully updated DATABASE_URL in .env');
} catch (e) {
    console.error('Error updating .env:', e);
}
