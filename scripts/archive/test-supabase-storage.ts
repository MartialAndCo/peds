
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

async function testSupabaseStorage() {
    console.log('=== Testing Supabase Storage ===\n');

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log(`SUPABASE_URL: ${supabaseUrl ? 'Found (' + supabaseUrl.substring(0, 30) + '...)' : '❌ NOT FOUND'}`);
    console.log(`SUPABASE_KEY: ${supabaseKey ? 'Found (' + supabaseKey.substring(0, 15) + '...)' : '❌ NOT FOUND'}`);

    if (!supabaseUrl || !supabaseKey) {
        console.error('\n❌ Supabase credentials missing! Add to .env:');
        console.log('NEXT_PUBLIC_SUPABASE_URL=your_url');
        console.log('SUPABASE_SERVICE_ROLE_KEY=your_key');
        return;
    }

    // Import storage after env is loaded
    const { storage, supabase } = require('../lib/storage');

    if (!supabase) {
        console.error('\n❌ Supabase client failed to initialize');
        return;
    }

    console.log('\n✅ Supabase client initialized');

    // Check if bucket exists
    console.log('\n📦 Checking "media" bucket...');
    try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
            console.error('❌ Error listing buckets:', bucketsError);
            return;
        }

        console.log('Available buckets:', buckets.map((b: any) => b.name));

        const mediaBucket = buckets.find((b: any) => b.name === 'media');
        if (!mediaBucket) {
            console.error('❌ "media" bucket does not exist!');
            console.log('Create it in Supabase Dashboard > Storage > New Bucket > "media" (public)');
            return;
        }
        console.log('✅ "media" bucket exists');

    } catch (e) {
        console.error('❌ Bucket check failed:', e);
        return;
    }

    // Test upload with a simple image
    console.log('\n📤 Testing upload...');
    const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const url = await storage.uploadMedia(testBuffer, 'image/png');

    if (url) {
        console.log('✅ Upload successful!');
        console.log('📎 URL:', url);
    } else {
        console.error('❌ Upload failed');
    }
}

testSupabaseStorage();
