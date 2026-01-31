require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function setupStoragePolicy() {
    console.log('Connecting to database...');
    // Use DIRECT_URL for direct connection (bypassing pooler if needed, but here it's fine)
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('Missing DATABASE_URL/DIRECT_URL in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected!');

        // 1. Ensure bucket is public
        console.log('Ensuring "media" bucket is public...');
        await client.query(`
            INSERT INTO storage.buckets (id, name, public) 
            VALUES ('media', 'media', true)
            ON CONFLICT (id) DO UPDATE SET public = true;
        `);

        // 2. Initialiser RLS Policies
        console.log('Configuring RLS policies...');

        // Drop existing to avoid conflicts
        await client.query(`DROP POLICY IF EXISTS "Public Access" ON storage.objects;`);
        await client.query(`DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;`);

        // Create permissive policy for uploads
        await client.query(`
            CREATE POLICY "Allow Public Uploads"
            ON storage.objects FOR INSERT
            WITH CHECK ( bucket_id = 'media' );
        `);

        // Create permissive policy for reads (already covered by public bucket, but good measure)
        await client.query(`
            CREATE POLICY "Allow Public Select"
            ON storage.objects FOR SELECT
            USING ( bucket_id = 'media' );
        `);

        // Create permissive policy for updates/deletes (optional, but useful for admin)
        await client.query(`
            CREATE POLICY "Allow Public Updates"
            ON storage.objects FOR UPDATE
            USING ( bucket_id = 'media' );
        `);

        await client.query(`
            CREATE POLICY "Allow Public Deletes"
            ON storage.objects FOR DELETE
            USING ( bucket_id = 'media' );
        `);

        console.log('Policies applied successfully!');

    } catch (err) {
        console.error('Error applying policies:', err);
    } finally {
        await client.end();
    }
}

setupStoragePolicy();
