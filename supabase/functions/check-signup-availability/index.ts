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
    const organizationName = String(body.organization_name || body.organizationName || '').trim();

    if (!email && !organizationName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Provide an email and/or organization name to check.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let emailAvailable = true;
    let emailError: string | null = null;
    let organizationAvailable = true;
    let organizationError: string | null = null;

    if (email) {
      if (!email.includes('@')) {
        emailAvailable = false;
        emailError = 'Enter a valid email address.';
      } else {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

        if (existingProfile) {
          emailAvailable = false;
          emailError = `An account already exists for ${email}. Sign in or use Forgot Password.`;
        }
      }
    }

    if (organizationName) {
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id, name')
        .ilike('name', organizationName)
        .maybeSingle();

      if (existingOrg) {
        organizationAvailable = false;
        organizationError = `Organization "${organizationName}" already exists. Choose a different name.`;
      }
    }

    const available = emailAvailable && organizationAvailable;
    return new Response(
      JSON.stringify({
        success: true,
        available,
        email,
        organization_name: organizationName,
        emailAvailable,
        organizationAvailable,
        emailError,
        organizationError,
        error: available
          ? null
          : [emailError, organizationError].filter(Boolean).join(' '),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('check-signup-availability error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Availability check failed',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
