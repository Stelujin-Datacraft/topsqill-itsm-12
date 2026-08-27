-- Ensure blog cover uploads work even when the earlier CMS migration
-- was not applied, and relax storage writes to any authenticated user
-- (matching report-media / form-attachments).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('blog-media', 'blog-media', true, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = COALESCE(storage.buckets.file_size_limit, 10485760);

-- Replace admin-only policies with authenticated policies (idempotent)
DROP POLICY IF EXISTS "Public can read blog media" ON storage.objects;
CREATE POLICY "Public can read blog media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "Admins can upload blog media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload blog media" ON storage.objects;
CREATE POLICY "Authenticated can upload blog media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "Admins can update blog media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update blog media" ON storage.objects;
CREATE POLICY "Authenticated can update blog media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "Admins can delete blog media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete blog media" ON storage.objects;
CREATE POLICY "Authenticated can delete blog media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'blog-media');
