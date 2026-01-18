import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import 'dotenv/config';

async function checkMigration() {
    console.log("🚦 Starting Connectivity Check...\n");

    const dbUrl = process.env.DATABASE_URL;
    const directUrl = process.env.DIRECT_URL; // Using Port 54322
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Check Database (Pooler - Port 5432)
    console.log(`🔹 Checking Pooler Connection (Port 5432)...`);
    if (dbUrl) {
        const client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
            await client.query('SELECT 1');
            console.log(`✅ Pooler Connection Successful!`);
            await client.end();
        } catch (err: any) {
            console.warn(`⚠️ Pooler Connection Issue (Expected for Admin tasks): ${err.message}`);
        }
    }

    // 2. Check Direct Database (Port 54322) - CRITICAL
    console.log(`\n🔹 Checking DIRECT DB Connection (Port 54322)...`);
    if (directUrl) {
        const client = new Client({ connectionString: directUrl });
        try {
            await client.connect();
            const res = await client.query('SELECT count(*) FROM auth.users');
            console.log(`✅ DIRECT DB Connection Successful! (Port 54322 is OPEN). Users count query worked.`);
            await client.end();
        } catch (err: any) {
            console.error(`❌ DIRECT DB Connection FAILED: ${err.message}`);
            if (err.message.includes('timeout')) {
                console.error("   👉 TIMEOUT: Check AWS Security Group! Open Port 54322 for 0.0.0.0/0");
            }
        }
    } else {
        console.error("❌ DIRECT_URL is missing.");
    }

    console.log("\n---------------------------------------------------\n");

    // 2. Check API / Storage (Port 8000)
    console.log(`🔹 Checking Supabase API (${supabaseUrl})...`);
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ NEXT_PUBLIC_SUPABASE_URL or KEY is missing in .env");
    } else {
        const sb = createClient(supabaseUrl, supabaseKey);
        // Try to list buckets (needs connection to Storage service)
        const { data, error } = await sb.storage.listBuckets();
        if (error) {
            console.error(`❌ API Connection FAILED: ${error.message}`);
            if (error.message.includes('fetch failed')) {
                console.error("   👉 FETCH FAILED: Check your AWS Security Group! (Port 8000 must be allowed for 0.0.0.0/0)");
            }
        } else {
            console.log(`✅ API & Storage Connection Successful! (Port 8000 is OPEN)`);
            console.log(`   📦 Buckets found: ${data?.map(b => b.name).join(', ')}`);
        }
    }
}

checkMigration();
