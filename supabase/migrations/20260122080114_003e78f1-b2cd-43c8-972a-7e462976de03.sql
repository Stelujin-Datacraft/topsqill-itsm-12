-- Deactivate all active sessions to force fresh logins
UPDATE public.user_sessions 
SET is_active = false 
WHERE is_active = true;