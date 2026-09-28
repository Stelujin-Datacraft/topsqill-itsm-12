import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const otp = String(body.otp || body.code || '').trim();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email and OTP code are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Enter the 6-digit code from your email.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();

    if (!profile?.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email or code.', code: 'INVALID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid sign-in code found. Please request a new code.',
          code: 'NOT_FOUND',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (mfaCode.expires_at && new Date(mfaCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This sign-in code has expired. Please request a new one.',
          code: 'EXPIRED',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (mfaCode.attempts >= mfaCode.max_attempts) {
      await supabase.from('mfa_codes').delete().eq('id', mfaCode.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many incorrect attempts. Please request a new code.',
          code: 'TOO_MANY_ATTEMPTS',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (String(mfaCode.code) !== otp) {
      await supabase
        .from('mfa_codes')
        .update({ attempts: mfaCode.attempts + 1 })
        .eq('id', mfaCode.id);
      const remaining = mfaCode.max_attempts - (mfaCode.attempts + 1);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
          code: 'INVALID_OTP',
          remainingAttempts: remaining,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      return new Response(
        JSON.stringify({ success: false, error: 'Could not create sign-in session. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('audit_logs').insert({
      user_id: profile.id,
      event_type: 'otp_signin_success',
      event_category: 'authentication',
      description: `OTP sign-in successful for ${email}`,
      metadata: { email, method: 'signin_otp' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        email,
        userId: profile.id,
        verification: {
          actionLink: linkData.properties?.action_link,
          hashedToken: (linkData.properties as { hashed_token?: string } | undefined)?.hashed_token,
        },
        message: 'Sign-in code verified.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('verify-signin-otp error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Sign-in verification failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
