import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupScenarioBucket() {
    console.log('📦 Checking if "scenarios" bucket exists...');

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Error listing buckets:', listError.message);
        process.exit(1);
    }

    const scenarioBucketExists = buckets.some((b) => b.name === 'scenarios');

    if (!scenarioBucketExists) {
        console.log('⚙️ Creating "scenarios" bucket...');
        const { error: createError } = await supabase.storage.createBucket('scenarios', {
            public: true,
            allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
            fileSizeLimit: 104857600 // 100MB
        });

        if (createError) {
            console.error('❌ Error creating bucket:', createError.message);
            process.exit(1);
        }
        console.log('✅ "scenarios" bucket created successfully.');
    } else {
        console.log('✅ "scenarios" bucket already exists.');
    }
}

setupScenarioBucket().then(() => {
    console.log('🎉 Setup complete!');
    process.exit(0);
});
