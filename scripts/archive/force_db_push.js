const { exec } = require('child_process');
const path = require('path');

// Original URL from user: postgresql://postgres.cfpcmrecikujyjammjck:Bhcmi6pm_@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
// We try switching port 6543 -> 5432 for the migration
const dbUrl = 'postgresql://postgres.cfpcmrecikujyjammjck:Bhcmi6pm_@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

console.log('Attempting Prisma DB Push on port 5432...');

const cmd = `npx prisma db push`;

const child = exec(cmd, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: dbUrl }
});

child.stdout.on('data', (data) => {
    console.log(data.toString());
});

child.stderr.on('data', (data) => {
    console.error(data.toString());
});

child.on('exit', (code) => {
    if (code === 0) {
        console.log('✅ Success: Database schema updated!');
    } else {
        console.error(`❌ Failed with code ${code}`);
    }
});
