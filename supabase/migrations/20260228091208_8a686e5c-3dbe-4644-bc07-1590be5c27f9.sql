-- Create storage bucket for policy attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-attachments', 'policy-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload policy attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'policy-attachments');

-- Allow public read
CREATE POLICY "Anyone can read policy attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'policy-attachments');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete policy attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'policy-attachments');