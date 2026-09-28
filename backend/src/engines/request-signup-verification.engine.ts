// @ts-nocheck
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';

function buildOrgDomain(orgName: string, email: string): string {
  const fromName = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = fromName || email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'org';
  const suffix = randomBytes(4).toString('hex');
  return `${base}-${suffix}`;
}

function encryptPassword(plain: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Match WebCrypto packing used by the Deno edge function: iv || ciphertext || tag
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

export function decryptPasswordNode(payload: string, secret: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(12, raw.length - 16);
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function loadDefaultSmtp(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1);
  if (data?.[0]) return data[0];
  const { data: anyActive } = await supabase
    .from('smtp_configs')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1);
  return anyActive?.[0] || null;
}

export async function requestSignupVerification(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const serviceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const firstName = String(body.first_name || '').trim();
    const lastName = String(body.last_name || '').trim();
    const organizationName = String(body.organization_name || '').trim();
    const origin = String(ctx.getHeader('origin') || body.origin || 'https://topsqill.com');

    if (!email || !password || !firstName || !organizationName) {
      return { success: false, error: 'Email, password, name, and organization are required.' };
    }

    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile) {
      return {
        success: false,
        error: `An account already exists for ${email}. Sign in or use Forgot Password.`,
      };
    }

    const smtpConfig = await loadDefaultSmtp(supabase);
    if (!smtpConfig) {
      return {
        success: false,
        error: 'No active SMTP configuration found. Add a default SMTP config in Email settings, then try again.',
      };
    }

    const organizationDomain = buildOrgDomain(organizationName, email);
    const passwordEncrypted = encryptPassword(password, serviceKey);
    const verificationToken = crypto.randomUUID();
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase.from('pending_signups').delete().ilike('email', email).is('verified_at', null);

    const { error: insertError } = await supabase.from('pending_signups').insert({
      email,
      password_encrypted: passwordEncrypted,
      first_name: firstName,
      last_name: lastName || firstName,
      organization_name: organizationName,
      organization_domain: organizationDomain,
      verification_token: verificationToken,
      otp_code: otpCode,
      otp_attempts: 0,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('pending_signups insert failed:', insertError);
      const missingTable =
        String(insertError.message || '').includes('pending_signups') ||
        String(insertError.code || '') === '42P01';
      return {
        success: false,
        error: missingTable
          ? 'Signup verification is not set up yet (pending_signups migration missing). Please contact support.'
          : 'Could not start signup. Please try again.',
      };
    }

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
        subject: `${otpCode} is your TopSqill verification code`,
        content: `Hi ${firstName},\n\nYour TopSqill verification code for ${organizationName} is: ${otpCode}\n\nEnter this code in the app to create your account. It expires in 30 minutes.\n`,
        html: `<p>Hi ${firstName},</p><p>Your verification code for <strong>${organizationName}</strong> is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;">${otpCode}</p><p>This code expires in 30 minutes.</p>`,
      });
      await client.close();
    } catch (smtpError) {
      console.error('Signup verification SMTP send failed:', smtpError);
      await supabase.from('pending_signups').delete().eq('verification_token', verificationToken);
      return {
        success: false,
        error: 'Could not send verification email. Please check SMTP settings and try again.',
      };
    }

    return {
      success: true,
      needsEmailVerification: true,
      email,
      message: `We sent a 6-digit verification code to ${email}. Enter it to create your account.`,
    };
  } catch (error) {
    console.error('requestSignupVerification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signup verification failed',
    };
  }
}
