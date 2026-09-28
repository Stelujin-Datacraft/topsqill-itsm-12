-- Pending organization signups — account is created only after OTP email verification.

CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  organization_domain TEXT,
  verification_token UUID NOT NULL DEFAULT gen_random_uuid(),
  otp_code TEXT NOT NULL,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_email_pending_uidx
  ON public.pending_signups (lower(email))
  WHERE verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_token_uidx
  ON public.pending_signups (verification_token);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- No authenticated client policies: service role only (edge/Nest).
REVOKE ALL ON public.pending_signups FROM PUBLIC;
REVOKE ALL ON public.pending_signups FROM anon, authenticated;
GRANT ALL ON public.pending_signups TO service_role;
