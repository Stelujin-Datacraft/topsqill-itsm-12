-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload attachments
CREATE POLICY "Authenticated users can upload email attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to read their attachments
CREATE POLICY "Authenticated users can read email attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'email-attachments');

-- Allow service role to read all attachments (for edge function)
CREATE POLICY "Service role can read all email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');