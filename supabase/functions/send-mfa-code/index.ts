import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, userId }: MFARequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: 'Email and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's MFA settings
    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('mfa_pin_expiry_minutes, mfa_max_attempts')
      .eq('user_id', userId)
      .maybeSingle();

    const expiryMinutes = securityParams?.mfa_pin_expiry_minutes || 5;
    const maxAttempts = securityParams?.mfa_max_attempts || 3;

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

    // Send email with code
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const { error: emailError } = await resend.emails.send({
        from: 'Topsqill Security <security@topsqill.com>',
        to: email,
        subject: 'Your Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Your Verification Code</h2>
            <p>Use the following code to complete your login:</p>
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
            </div>
            <p style="color: #666;">This code will expire in ${expiryMinutes} minutes.</p>
            <p style="color: #666;">If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">This is an automated message from Topsqill Security.</p>
          </div>
        `,
      });

      if (emailError) {
        console.error('Error sending MFA email:', emailError);
        // Don't fail the request - code is still valid in database
      }
    } else {
      console.log('RESEND_API_KEY not set, MFA code:', code);
    }

    console.log(`MFA code generated for user ${userId}, expires at ${expiresAt}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expiresAt,
        expiryMinutes,
        maxAttempts 
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
