import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

// --- CONFIGURATION ---
// ANCIEN (Cloud)
const OLD_URL = 'https://cfpcmrecikujyjammjck.supabase.co'; // Cloud URL
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmcGNtcmVjaWt1anlqYW1tamNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjUxODQ4NCwiZXhwIjoyMDgyMDk0NDg0fQ.D2F58rPe935YmNdbRqfSO2LZieH8KJLw0MBRiJWkYK0'; // Cloud Service Role Key

// NOUVEAU (EC2 Self-Hosted) - VIA TUNNEL SSH (localhost:8000)
const NEW_URL = 'http://127.0.0.1:8000';
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_LOCAL || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

// BUCKETS À MIGRER
const BUCKETS = ['voice-uploads', 'media-uploads', 'avatars']; // Ajoute tes buckets ici

async function migrateStorage() {
    console.log("🔍 Checking Credentials:");
    console.log(`   - OLD_URL (Cloud): ${OLD_URL ? '✅ Found' : '❌ MISSING'}`);
    console.log(`   - OLD_KEY (Cloud): ${OLD_KEY ? '✅ Found' : '❌ MISSING'}`);
    console.log(`   - NEW_URL (Local): ${NEW_URL ? '✅ Found' : '❌ MISSING'}`);
    console.log(`   - NEW_KEY (Local): ${NEW_KEY ? '✅ Found' : '❌ MISSING'}`);

    if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
        console.error('\n❌ CRITICAL: Missing configuration credentials. Please check your .env or .env.local file.');
        console.error('   Hint: OLD_KEY needs SUPABASE_SERVICE_ROLE_KEY (from Cloud settings).');
        return;
    }

    const oldClient = createClient(OLD_URL, OLD_KEY);
    const newClient = createClient(NEW_URL, NEW_KEY);

    console.log('🚀 Starting Storage Migration...');

    for (const bucket of BUCKETS) {
        console.log(`\n📦 Processing bucket: ${bucket}`);

        // 1. Create Bucket on New (if not exists)
        const { data: buckets } = await newClient.storage.listBuckets();
        const exists = buckets?.find(b => b.name === bucket);

        if (!exists) {
            console.log(`   Creating bucket ${bucket}...`);
            await newClient.storage.createBucket(bucket, { public: true });
        }

        // 2. List Files from Old
        // Note: This lists only root files. Recursion needed for folders, but let's assume flat for now or simple folders.
        // Enhanced listing:
        const { data: files, error } = await oldClient.storage.from(bucket).list('', { limit: 1000 });

        if (error) {
            console.error(`   ❌ Error listing bucket ${bucket}:`, error.message);
            continue;
        }

        if (!files || files.length === 0) {
            console.log(`   ⚠️ No files found in ${bucket}`);
            continue;
        }

        console.log(`   Found ${files.length} files. Transferring...`);

        // 3. Transfer Loop
        for (const file of files) {
            if (file.name === '.emptyFolderPlaceholder') continue;

            process.stdout.write(`   ➡️ ${file.name}... `);

            // Download
            const { data: fileData, error: downErr } = await oldClient.storage.from(bucket).download(file.name);
            if (downErr) {
                console.log(`❌ Download failed: ${downErr.message}`);
                continue;
            }

            // Upload
            const { error: upErr } = await newClient.storage.from(bucket).upload(file.name, fileData!, {
                contentType: file.metadata?.mimetype,
                upsert: true
            });

            if (upErr) {
                console.log(`❌ Upload failed: ${upErr.message}`);
            } else {
                console.log(`✅ OK`);
            }
        }
    }

    console.log('\n✨ Migration Complete!');
}

migrateStorage();
