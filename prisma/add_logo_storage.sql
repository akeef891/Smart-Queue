-- Ensure Supabase storage bucket exists for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies on storage.objects for business-logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'business_logos_public_select'
  ) THEN
    CREATE POLICY business_logos_public_select ON storage.objects 
      FOR SELECT USING (bucket_id = 'business-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'business_logos_allow_insert'
  ) THEN
    CREATE POLICY business_logos_allow_insert ON storage.objects 
      FOR INSERT WITH CHECK (bucket_id = 'business-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'business_logos_allow_update'
  ) THEN
    CREATE POLICY business_logos_allow_update ON storage.objects 
      FOR UPDATE USING (bucket_id = 'business-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'business_logos_allow_delete'
  ) THEN
    CREATE POLICY business_logos_allow_delete ON storage.objects 
      FOR DELETE USING (bucket_id = 'business-logos');
  END IF;
END $$;
