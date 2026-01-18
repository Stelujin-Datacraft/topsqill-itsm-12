import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MFARequest {
  email: string;
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, userId }: MFARequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: 'Email and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization and MFA settings
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('mfa_pin_expiry_minutes, mfa_max_attempts, organization_id')
      .eq('user_id', userId)
      .maybeSingle();

    const expiryMinutes = securityParams?.mfa_pin_expiry_minutes || 5;
    const maxAttempts = securityParams?.mfa_max_attempts || 3;
    const organizationId = securityParams?.organization_id;

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Invalidate any existing codes for this user
    await supabase
      .from('mfa_codes')
      .delete()
      .eq('user_id', userId)
      .is('verified_at', null);

    // Store the new code
    const { error: insertError } = await supabase
      .from('mfa_codes')
      .insert({
        user_id: userId,
        code,
        method: 'email',
        max_attempts: maxAttempts,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error inserting MFA code:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate MFA code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email with code using SMTP
    let emailSent = false;
    let smtpConfig = null;

    if (organizationId) {
      // Try to get organization's SMTP config - prioritize Hostinger
      const { data: configs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (configs && configs.length > 0) {
        // Prioritize Hostinger SMTP
        smtpConfig = configs.find(c => c.host.includes('hostinger')) || configs[0];
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

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verification Code</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;"><tr><td style="padding:40px 30px;text-align:center;background-color:#1a1a2e;"><h1 style="color:#ffffff;margin:0;font-size:24px;">Security Verification</h1></td></tr><tr><td style="padding:40px 30px;"><h2 style="color:#333333;margin:0 0 20px;">Your Verification Code</h2><p style="color:#666666;font-size:16px;line-height:1.5;margin:0 0 30px;">Use the following code to complete your login:</p><div style="background-color:#f8f9fa;padding:25px;border-radius:8px;text-align:center;margin:0 0 30px;"><span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1a1a2e;">${code}</span></div><p style="color:#666666;font-size:14px;margin:0 0 10px;"><strong>This code will expire in ${expiryMinutes} minutes.</strong></p><p style="color:#999999;font-size:14px;margin:0;">If you didn't request this code, please ignore this email or contact support if you have concerns.</p></td></tr><tr><td style="padding:30px;background-color:#f8f9fa;text-align:center;border-top:1px solid #eeeeee;"><p style="color:#999999;font-size:12px;margin:0;">This is an automated message from Topsqill Security.<br>Please do not reply to this email.</p></td></tr></table></body></html>`;

        await client.send({
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
            : smtpConfig.from_email,
          to: email,
          subject: 'Your Verification Code - Topsqill Security',
          content: `Your verification code is: ${code}\n\nThis code will expire in ${expiryMinutes} minutes.\n\nIf you didn't request this code, please ignore this email.`,
          html: htmlContent,
        });

        await client.close();
        emailSent = true;
        console.log(`MFA code email sent successfully to ${email}`);
      } catch (smtpError) {
        console.error('Error sending MFA email via SMTP:', smtpError);
      }
    } else {
      console.log('No active SMTP configuration found for organization');
    }

    console.log(`MFA code generated for user ${userId}, expires at ${expiresAt}, email sent: ${emailSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiresAt,
        expiryMinutes,
        maxAttempts,
        emailSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-mfa-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
