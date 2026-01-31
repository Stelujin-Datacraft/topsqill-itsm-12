-- Make email-attachments bucket public so files can be accessed for sending
UPDATE storage.buckets 
SET public = true 
WHERE id = 'email-attachments';