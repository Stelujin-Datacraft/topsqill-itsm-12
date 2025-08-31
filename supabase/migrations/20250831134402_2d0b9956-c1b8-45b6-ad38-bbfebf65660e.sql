-- Add recipients column to email_templates table
ALTER TABLE public.email_templates 
ADD COLUMN recipients JSONB DEFAULT '{"to": [], "cc": [], "bcc": [], "permanent_recipients": []}'::jsonb;