-- Create storage bucket for form file attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('form-attachments', 'form-attachments', true, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload form attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'form-attachments');

-- Allow anyone to view/download form attachments (public bucket)
CREATE POLICY "Anyone can view form attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-attachments');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete form attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'form-attachments');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update form attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'form-attachments');