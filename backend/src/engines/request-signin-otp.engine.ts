// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';

const EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

async function loadSmtp(supabase: SupabaseClient, organizationId?: string | null) {
  if (organizationId) {
    const { data: configs } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });
    if (configs?.length) {
      return configs.find((c: { host: string }) => c.host.includes('hostinger')) || configs[0];
    }
  }

  const { data: defaults } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1);
  if (defaults?.[0]) return defaults[0];

  const { data: anyActive } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1);
  return anyActive?.[0] || null;
}

export async function requestSigninOtp(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  _ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return { success: false, error: 'A valid email is required.' };
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, organization_id, first_name, status')
      .ilike('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return {
        success: false,
        error: `No account found for ${email}. Please sign up first.`,
        code: 'ACCOUNT_NOT_FOUND',
      };
    }

    if (profile.status && profile.status !== 'active') {
      return {
        success: false,
        error: 'This account is not active. Contact your administrator.',
        code: 'ACCOUNT_INACTIVE',
      };
    }

    const smtpConfig = await loadSmtp(supabase, profile.organization_id);
    if (!smtpConfig) {
      return {
        success: false,
        error: 'No active SMTP configuration found. Configure SMTP in Email settings first.',
      };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabase
      .from('mfa_codes')
      .delete()
      .eq('user_id', profile.id)
      .eq('method', 'signin_otp')
      .is('verified_at', null);

    const { error: insertError } = await supabase.from('mfa_codes').insert({
      user_id: profile.id,
      code,
      method: 'signin_otp',
      max_attempts: MAX_ATTEMPTS,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('signin otp insert failed:', insertError);
      return { success: false, error: 'Could not create sign-in code. Please try again.' };
    }

    const firstName = profile.first_name || 'there';
    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        tls: smtpConfig.use_tls,
        auth: { username: smtpConfig.username, password: smtpConfig.password },
      },
    });

    try {
      await client.send({
        from: smtpConfig.from_name
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
          : smtpConfig.from_email,
        to: email,
        subject: `${code} is your TopSqill sign-in code`,
        content: `Hi ${firstName},\n\nYour TopSqill sign-in code is: ${code}\n\nIt expires in ${EXPIRY_MINUTES} minutes.\n`,
        html: `<p>Hi ${firstName},</p><p>Your TopSqill sign-in code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;">${code}</p><p>This code expires in ${EXPIRY_MINUTES} minutes.</p>`,
      });
      await client.close();
    } catch (smtpError) {
      console.error('Sign-in OTP SMTP send failed:', smtpError);
      await supabase
        .from('mfa_codes')
        .delete()
        .eq('user_id', profile.id)
        .eq('method', 'signin_otp')
        .is('verified_at', null);
      return {
        success: false,
        error: 'Could not send sign-in email. Please check SMTP settings and try again.',
      };
    }

    return {
      success: true,
      email,
      expiryMinutes: EXPIRY_MINUTES,
      message: `We sent a 6-digit sign-in code to ${email}.`,
    };
  } catch (error) {
    console.error('requestSigninOtp error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send sign-in code',
    };
  }
}
