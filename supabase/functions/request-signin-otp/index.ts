import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

async function loadSmtp(
  supabase: ReturnType<typeof createClient>,
  organizationId?: string | null,
) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'A valid email is required.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, organization_id, first_name, status')
      .ilike('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `No account found for ${email}. Please sign up first.`,
          code: 'ACCOUNT_NOT_FOUND',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (profile.status && profile.status !== 'active') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This account is not active. Contact your administrator.',
          code: 'ACCOUNT_INACTIVE',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const smtpConfig = await loadSmtp(supabase, profile.organization_id);
    if (!smtpConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active SMTP configuration found. Configure SMTP in Email settings first.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      return new Response(
        JSON.stringify({ success: false, error: 'Could not create sign-in code. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const firstName = profile.first_name || 'there';
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your sign-in code</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
    <tr><td style="padding:32px;background:#1a1a2e;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Your TopSqill sign-in code</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="color:#333;font-size:16px;">Hi ${firstName},</p>
      <p style="color:#555;font-size:15px;line-height:1.5;">
        Use this one-time code to sign in to TopSqill:
      </p>
      <p style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;letter-spacing:6px;font-size:32px;font-weight:700;color:#1a1a2e;background:#f4f4f4;padding:16px 24px;border-radius:8px;">${code}</span>
      </p>
      <p style="color:#999;font-size:12px;">This code expires in ${EXPIRY_MINUTES} minutes. If you did not request it, ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>`;

    try {
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

      await client.send({
        from: smtpConfig.from_name
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
          : smtpConfig.from_email,
        to: email,
        subject: `${code} is your TopSqill sign-in code`,
        content: `Hi ${firstName},\n\nYour TopSqill sign-in code is: ${code}\n\nIt expires in ${EXPIRY_MINUTES} minutes.\n`,
        html,
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not send sign-in email. Please check SMTP settings and try again.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email,
        expiryMinutes: EXPIRY_MINUTES,
        message: `We sent a 6-digit sign-in code to ${email}.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('request-signin-otp error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send sign-in code',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
