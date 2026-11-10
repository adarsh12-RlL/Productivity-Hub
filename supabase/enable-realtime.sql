-- Run after creating public.tasks and public.notes using the original schema.
-- Add only these tables; re-running this script does not add duplicates.
DO $$
DECLARE
  table_name_to_add text;
BEGIN
  FOREACH table_name_to_add IN ARRAY ARRAY['tasks', 'notes'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name_to_add
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name_to_add);
    END IF;
  END LOOP;
END;
$$;
