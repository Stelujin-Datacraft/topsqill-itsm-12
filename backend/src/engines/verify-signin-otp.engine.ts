// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';

export async function verifySigninOtp(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  _ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || body.code || '').trim();

    if (!email || !otp) {
      return { success: false, error: 'Email and OTP code are required.' };
    }

    if (!/^\d{6}$/.test(otp)) {
      return { success: false, error: 'Enter the 6-digit code from your email.' };
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return { success: false, error: 'Invalid email or code.', code: 'INVALID' };
    }

    const { data: mfaCode, error: fetchError } = await supabase
      .from('mfa_codes')
      .select('*')
      .eq('user_id', profile.id)
      .eq('method', 'signin_otp')
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !mfaCode) {
      return {
        success: false,
        error: 'No valid sign-in code found. Please request a new code.',
        code: 'NOT_FOUND',
      };
    }

    if (mfaCode.expires_at && new Date(mfaCode.expires_at) < new Date()) {
      return {
        success: false,
        error: 'This sign-in code has expired. Please request a new one.',
        code: 'EXPIRED',
      };
    }

    if (mfaCode.attempts >= mfaCode.max_attempts) {
      await supabase.from('mfa_codes').delete().eq('id', mfaCode.id);
      return {
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.',
        code: 'TOO_MANY_ATTEMPTS',
      };
    }

    if (String(mfaCode.code) !== otp) {
      await supabase
        .from('mfa_codes')
        .update({ attempts: mfaCode.attempts + 1 })
        .eq('id', mfaCode.id);
      const remaining = mfaCode.max_attempts - (mfaCode.attempts + 1);
      return {
        success: false,
        error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        code: 'INVALID_OTP',
        remainingAttempts: remaining,
      };
    }

    await supabase
      .from('mfa_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', mfaCode.id);

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData) {
      console.error('Sign-in OTP magic link failed:', linkError);
      return { success: false, error: 'Could not create sign-in session. Please try again.' };
    }

    await supabase.from('audit_logs').insert({
      user_id: profile.id,
      event_type: 'otp_signin_success',
      event_category: 'authentication',
      description: `OTP sign-in successful for ${email}`,
      metadata: { email, method: 'signin_otp' },
    });

    return {
      success: true,
      email,
      userId: profile.id,
      verification: {
        actionLink: linkData.properties?.action_link,
        hashedToken: (linkData.properties as { hashed_token?: string } | undefined)?.hashed_token,
      },
      message: 'Sign-in code verified.',
    };
  } catch (error) {
    console.error('verifySigninOtp error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign-in verification failed',
    };
  }
}
