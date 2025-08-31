-- Fix RLS security issues for the new email-related tables

-- Enable RLS on email_templates (it should already have policies but let's ensure RLS is enabled)
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Enable RLS on email_logs 
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on smtp_configs
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;