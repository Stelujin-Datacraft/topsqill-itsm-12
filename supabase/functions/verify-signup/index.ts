import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function deriveKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['decrypt']);
}

async function decryptPassword(payload: string, secret: string): Promise<string> {
  const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

async function bootstrapOrg(
  supabase: ReturnType<typeof createClient>,
  args: {
    userId: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    preferredDomain?: string | null;
  },
) {
  let orgId: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const domain =
      attempt === 0 && args.preferredDomain
        ? args.preferredDomain
        : `${args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'org'}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: args.name,
        domain,
        description: null,
        admin_email: args.email,
        status: 'active',
      })
      .select('id')
      .single();

    if (!error && data) {
      orgId = data.id;
      break;
    }
    lastError = error;
    const msg = String((error as { message?: string })?.message || '');
    if (!/duplicate|unique|already exists/i.test(msg)) break;
  }

  if (!orgId) throw lastError || new Error('Failed to create organization');

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: args.userId,
    email: args.email,
    first_name: args.firstName,
    last_name: args.lastName,
    organization_id: orgId,
    role: 'admin',
    status: 'active',
  });
  if (profileError) throw profileError;

  await supabase.from('user_organizations').upsert({
    user_id: args.userId,
    organization_id: orgId,
    role: 'admin',
  }, { onConflict: 'user_id,organization_id' });

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: args.name,
      description: 'Default project',
      organization_id: orgId,
      created_by: args.userId,
      status: 'active',
    })
    .select('id')
    .single();

  if (!projectError && project) {
    await supabase.from('project_users').insert({
      project_id: project.id,
      user_id: args.userId,
      role: 'admin',
      assigned_by: args.userId,
    });
  }

  return orgId;
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
    const url = new URL(req.url);
    const token = String(body.token || url.searchParams.get('token') || '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification token is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: pending, error: pendingError } = await supabase
      .from('pending_signups')
      .select('*')
      .eq('verification_token', token)
      .is('verified_at', null)
      .maybeSingle();

    if (pendingError || !pending) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This verification link is invalid or has already been used.',
          code: 'INVALID_TOKEN',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This verification link has expired. Please sign up again.',
          code: 'EXPIRED',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const password = await decryptPassword(pending.password_encrypted, serviceKey);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: pending.email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: pending.first_name,
        last_name: pending.last_name,
        role: 'admin',
        organization_name: pending.organization_name,
        organization_domain: pending.organization_domain,
      },
    });

    if (authError || !authData.user) {
      const msg = authError?.message || 'Failed to create account';
      if (/already|registered|exists/i.test(msg)) {
        await supabase
          .from('pending_signups')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', pending.id);
        return new Response(
          JSON.stringify({
            success: true,
            alreadyExists: true,
            email: pending.email,
            message: 'Your email is verified. Please sign in with your password.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    try {
      await bootstrapOrg(supabase, {
        userId: authData.user.id,
        email: pending.email,
        name: pending.organization_name,
        firstName: pending.first_name,
        lastName: pending.last_name,
        preferredDomain: pending.organization_domain,
      });
    } catch (bootstrapError) {
      console.error('Org bootstrap failed after verify:', bootstrapError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: bootstrapError instanceof Error
            ? bootstrapError.message
            : 'Account creation failed during organization setup.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase
      .from('pending_signups')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', pending.id);

    return new Response(
      JSON.stringify({
        success: true,
        email: pending.email,
        message: 'Email verified. Your account is ready — please sign in.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('verify-signup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
