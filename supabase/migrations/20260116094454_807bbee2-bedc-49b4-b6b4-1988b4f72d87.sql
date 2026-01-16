-- Create password history table for password reuse prevention
CREATE TABLE public.password_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- Only allow system to read password history (via service role)
CREATE POLICY "Users cannot directly access password history"
ON public.password_history
FOR ALL
USING (false);

-- Create MFA codes table for email OTP
CREATE TABLE public.mfa_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'email',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mfa_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own MFA codes
CREATE POLICY "Users can read their own MFA codes"
ON public.mfa_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Create user sessions table for concurrent session tracking
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read their own sessions"
ON public.user_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own sessions (for logout)
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_password_history_user_id ON public.password_history(user_id);
CREATE INDEX idx_password_history_created_at ON public.password_history(created_at DESC);
CREATE INDEX idx_mfa_codes_user_id ON public.mfa_codes(user_id);
CREATE INDEX idx_mfa_codes_expires_at ON public.mfa_codes(expires_at);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_is_active ON public.user_sessions(is_active);

-- Add password_hash column to user_security_parameters if it doesn't exist
-- This stores the hash of the current password for history comparison
ALTER TABLE public.user_security_parameters 
ADD COLUMN IF NOT EXISTS current_password_hash TEXT;