-- Ensure pending_signups exists with OTP columns and service-role access.
-- Safe to re-run if an earlier partial migration left the table incomplete.

CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  organization_domain TEXT,
  verification_token UUID NOT NULL DEFAULT gen_random_uuid(),
  otp_code TEXT,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS organization_domain TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS verification_token UUID;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS password_encrypted TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Backfill required OTP values for any incomplete rows, then enforce NOT NULL.
UPDATE public.pending_signups
SET otp_code = COALESCE(otp_code, '000000')
WHERE otp_code IS NULL;

UPDATE public.pending_signups
SET verification_token = COALESCE(verification_token, gen_random_uuid())
WHERE verification_token IS NULL;

UPDATE public.pending_signups
SET expires_at = COALESCE(expires_at, now() + interval '24 hours')
WHERE expires_at IS NULL;

ALTER TABLE public.pending_signups
  ALTER COLUMN otp_code SET NOT NULL,
  ALTER COLUMN verification_token SET NOT NULL,
  ALTER COLUMN expires_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_email_pending_uidx
  ON public.pending_signups (lower(email))
  WHERE verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pending_signups_token_uidx
  ON public.pending_signups (verification_token);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pending_signups FROM PUBLIC;
REVOKE ALL ON public.pending_signups FROM anon, authenticated;
GRANT ALL ON public.pending_signups TO service_role;
GRANT ALL ON public.pending_signups TO postgres;

-- Atomic create/replace pending signup (bypasses RLS via SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.create_pending_signup(
  p_email TEXT,
  p_password_encrypted TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_organization_name TEXT,
  p_organization_domain TEXT,
  p_otp_code TEXT,
  p_expires_at TIMESTAMPTZ,
  p_verification_token UUID DEFAULT gen_random_uuid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR v_email = '' OR p_password_encrypted IS NULL OR p_otp_code IS NULL THEN
    RAISE EXCEPTION 'Missing required pending signup fields';
  END IF;

  DELETE FROM public.pending_signups
  WHERE lower(email) = v_email
    AND verified_at IS NULL;

  INSERT INTO public.pending_signups (
    email,
    password_encrypted,
    first_name,
    last_name,
    organization_name,
    organization_domain,
    verification_token,
    otp_code,
    otp_attempts,
    expires_at
  ) VALUES (
    v_email,
    p_password_encrypted,
    COALESCE(NULLIF(trim(p_first_name), ''), 'User'),
    COALESCE(NULLIF(trim(p_last_name), ''), COALESCE(NULLIF(trim(p_first_name), ''), 'User')),
    COALESCE(NULLIF(trim(p_organization_name), ''), 'Organization'),
    NULLIF(trim(p_organization_domain), ''),
    COALESCE(p_verification_token, gen_random_uuid()),
    p_otp_code,
    0,
    COALESCE(p_expires_at, now() + interval '30 minutes')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_signup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pending_signup(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID) TO service_role;
