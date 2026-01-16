import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  userId: string;
  code: string;
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

    const { userId, code }: VerifyRequest = await req.json();

    if (!userId || !code) {
      return new Response(
        JSON.stringify({ error: 'User ID and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the active MFA code for this user
    const { data: mfaCode, error: fetchError } = await supabase
      .from('mfa_codes')
      .select('*')
      .eq('user_id', userId)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching MFA code:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mfaCode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid verification code found. Please request a new code.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts exceeded
    if (mfaCode.attempts >= mfaCode.max_attempts) {
      // Invalidate the code
      await supabase
        .from('mfa_codes')
        .delete()
        .eq('id', mfaCode.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Maximum attempts exceeded. Please request a new code.',
          attemptsExceeded: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment attempt counter
    await supabase
      .from('mfa_codes')
      .update({ attempts: mfaCode.attempts + 1 })
      .eq('id', mfaCode.id);

    // Check if code matches
    if (mfaCode.code !== code) {
      const remainingAttempts = mfaCode.max_attempts - (mfaCode.attempts + 1);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
          remainingAttempts
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as verified
    await supabase
      .from('mfa_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', mfaCode.id);

    console.log(`MFA code verified successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in verify-mfa-code:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
