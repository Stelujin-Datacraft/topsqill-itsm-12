import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildOrgDomain(orgName: string, email: string): string {
  const fromName = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = fromName || email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'org';
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `${base}-${suffix}`;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt']);
}

async function encryptPassword(plain: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const packed = new Uint8Array(iv.length + new Uint8Array(cipher).byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  let binary = '';
  packed.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

async function loadDefaultSmtp(supabase: ReturnType<typeof createClient>) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const firstName = String(body.first_name || '').trim();
    const lastName = String(body.last_name || '').trim();
    const organizationName = String(body.organization_name || '').trim();
    const origin = req.headers.get('origin') || String(body.origin || 'https://topsqill.com');

    if (!email || !password || !firstName || !organizationName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email, password, name, and organization are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 8 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Block if an account/profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `An account already exists for ${email}. Sign in or use Forgot Password.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const smtpConfig = await loadDefaultSmtp(supabase);
    if (!smtpConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active SMTP configuration found. Add a default SMTP config in Email settings, then try again.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const organizationDomain = buildOrgDomain(organizationName, email);
    const passwordEncrypted = await encryptPassword(password, serviceKey);
    const verificationToken = crypto.randomUUID();
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    // OTP expires in 30 minutes (pending row kept up to 24h for cleanup)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Replace any prior pending signup for this email
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
      return new Response(
        JSON.stringify({
          success: false,
          error: missingTable
            ? 'Signup verification is not set up yet (pending_signups migration missing). Please contact support.'
            : 'Could not start signup. Please try again.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        tls: smtpConfig.use_tls,
        auth: {
          username: smtpConfig.username,
          password: smtpConfig.password,
        },
      },
    });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your verification code</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr><td style="padding:32px;background:#1a1a2e;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Your TopSqill verification code</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="color:#333;font-size:16px;">Hi ${firstName},</p>
      <p style="color:#555;font-size:15px;line-height:1.5;">
        Thanks for signing up for <strong>${organizationName}</strong>. Enter this one-time code in the app to verify your email and create your account:
      </p>
      <p style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;letter-spacing:6px;font-size:32px;font-weight:700;color:#1a1a2e;background:#f4f4f4;padding:16px 24px;border-radius:8px;">${otpCode}</span>
      </p>
      <p style="color:#999;font-size:12px;">This code expires in 30 minutes. If you did not sign up, ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await client.send({
        from: smtpConfig.from_name
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
          : smtpConfig.from_email,
        to: email,
        subject: `${otpCode} is your TopSqill verification code`,
        content: `Hi ${firstName},\n\nYour TopSqill verification code for ${organizationName} is: ${otpCode}\n\nEnter this code in the app to create your account. It expires in 30 minutes.\n`,
        html,
      });
      await client.close();
    } catch (smtpError) {
      console.error('Signup verification SMTP send failed:', smtpError);
      await supabase.from('pending_signups').delete().eq('verification_token', verificationToken);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not send verification email. Please check SMTP settings and try again.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        needsEmailVerification: true,
        email,
        message: `We sent a 6-digit verification code to ${email}. Enter it to create your account.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('request-signup-verification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Signup verification failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
