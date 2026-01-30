-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for organization logos - anyone can view (public bucket)
CREATE POLICY "Public can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

-- Authenticated users can upload their organization logo
CREATE POLICY "Authenticated users can upload organization logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
);

-- Users can update their organization logos
CREATE POLICY "Users can update organization logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
);

-- Users can delete their organization logos
CREATE POLICY "Users can delete organization logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
);