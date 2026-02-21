DO $$
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', t.tablename;
    END LOOP;
END;
$$;
