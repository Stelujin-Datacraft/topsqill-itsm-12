-- Clear stale sessions for admin user
UPDATE public.user_sessions 
SET is_active = false 
WHERE user_id = '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c';

-- Increase max concurrent sessions to 5 for the admin user
UPDATE public.user_security_parameters 
SET max_concurrent_sessions = 5 
WHERE user_id = '6543b14f-252f-4c8a-8d01-c5f2f4c8ec2c';