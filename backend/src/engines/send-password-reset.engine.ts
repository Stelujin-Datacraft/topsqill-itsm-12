// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
}



export async function sendPasswordReset(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  // Handle CORS preflight requests
  

  try {
    const supabaseUrl = ctx.getEnv('SUPABASE_URL')!;
    const supabaseServiceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;

    

    const { email, redirectUrl }: PasswordResetRequest = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Password reset requested for: ${email}`);

    // Get user profile to find organization
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, first_name, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (!userProfile) {
      // Don't reveal if user exists or not for security
      console.log(`User not found for email: ${email}`);
      return new Response(
        JSON.stringify({ success: true, message: 'If your email exists, you will receive a reset link' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestOrigin = ctx.getHeader('origin');
    const fallbackOrigin = 'https://topsqill-itsm-12.lovable.app';
    const baseRedirectUrl = redirectUrl || `${fallbackOrigin}/change-password`;
    const parsedRedirectUrl = new URL(baseRedirectUrl, requestOrigin || fallbackOrigin);
    parsedRedirectUrl.pathname = '/change-password';
    parsedRedirectUrl.searchParams.set('mode', 'reset');
    const finalRedirectUrl = parsedRedirectUrl.toString();

    console.log(`Using redirect URL: ${finalRedirectUrl}`);

    // Generate password reset using Supabase Auth
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: finalRedirectUrl,
      },
    });

    if (resetError) {
      console.error('Error generating reset link:', resetError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resetLink = resetData?.properties?.action_link;

    if (!resetLink) {
      console.error('No reset link generated');
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Reset link generated for ${email}`);

    // Get SMTP config - use the default active config first
    let smtpConfig = null;
    let emailSent = false;

    if (userProfile.organization_id) {
      const { data: configs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', userProfile.organization_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (configs && configs.length > 0) {
        // Use the default SMTP config (is_default=true comes first due to ordering)
        smtpConfig = configs[0];
      }
    }

    // Fallback: get any active default config
    if (!smtpConfig) {
      const { data: configs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('is_active', true)
        .eq('is_default', true)
        .limit(1);

      if (configs && configs.length > 0) {
        smtpConfig = configs[0];
      }
    }

    if (smtpConfig) {
      try {
        console.log(`Using SMTP config: ${smtpConfig.name} (${smtpConfig.host})`);
        
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

        const userName = userProfile.first_name || 'User';

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:40px 30px;text-align:center;background-color:#1a1a2e;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;">Password Reset Request</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 30px;">
        <h2 style="color:#333333;margin:0 0 20px;">Hello ${userName},</h2>
        <p style="color:#666666;font-size:16px;line-height:1.5;margin:0 0 20px;">
          We received a request to reset your password. Use the reset code below to create a new password:
        </p>
        <div style="text-align:center;margin:0 0 20px;background-color:#f4f4f4;padding:20px;border-radius:8px;">
          <code style="font-size:18px;word-break:break-all;color:#1a1a2e;">${resetLink}</code>
        </div>
        <p style="color:#666666;font-size:14px;margin:0 0 10px;">
          <strong>Copy the code above and paste it into the password reset page.</strong>
        </p>
        <p style="color:#666666;font-size:14px;margin:0 0 10px;">
          <strong>This code will expire in 24 hours.</strong>
        </p>
        <p style="color:#999999;font-size:14px;margin:0 0 20px;">
          If you didn't request a password reset, please ignore this email or contact support if you have concerns.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:30px;background-color:#f8f9fa;text-align:center;border-top:1px solid #eeeeee;">
        <p style="color:#999999;font-size:12px;margin:0;">
          This is an automated message from Topsqill Security.<br>
          Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

        await client.send({
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
            : smtpConfig.from_email,
          to: email,
          subject: 'Reset Your Password - TopSqill',
          content: `Hello ${userName},\n\nWe received a request to reset your password. Use the reset code below to create a new password:\n\n${resetLink}\n\nCopy the code above and paste it into the password reset page.\n\nThis code will expire in 24 hours.\n\nIf you didn't request a password reset, please ignore this email.\n\n- TopSqill Security Team`,
          html: htmlContent,
        });

        await client.close();
        emailSent = true;
        console.log(`Password reset email sent successfully to ${email}`);
      } catch (smtpError) {
        console.error('Error sending password reset email via SMTP:', smtpError);
      }
    } else {
      console.log('No active SMTP configuration found');
    }

    // Log the event
    await supabase.from('audit_logs').insert({
      user_id: userProfile.id,
      event_type: 'password_reset_requested',
      event_category: 'security',
      description: `Password reset email ${emailSent ? 'sent' : 'requested but email failed'}`,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'If your email exists, you will receive a reset link',
        emailSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-password-reset:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
