// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { decryptPasswordNode } from './request-signup-verification.engine';

async function bootstrapOrg(
  supabase: SupabaseClient,
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
    const msg = String(error?.message || '');
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

  await supabase.from('user_organizations').upsert(
    { user_id: args.userId, organization_id: orgId, role: 'admin' },
    { onConflict: 'user_id,organization_id' },
  );

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

export async function verifySignup(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const serviceKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = String(body.token || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || body.code || '').trim();

    let pending: any = null;

    if (email && otp) {
      if (!/^\d{6}$/.test(otp)) {
        return { success: false, error: 'Enter the 6-digit code from your email.' };
      }

      const { data, error: pendingError } = await supabase
        .from('pending_signups')
        .select('*')
        .ilike('email', email)
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError || !data) {
        return {
          success: false,
          error: 'No pending signup found for this email. Please sign up again.',
          code: 'NOT_FOUND',
        };
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return {
          success: false,
          error: 'This verification code has expired. Please sign up again.',
          code: 'EXPIRED',
        };
      }

      const attempts = Number(data.otp_attempts || 0);
      if (attempts >= 5) {
        return {
          success: false,
          error: 'Too many incorrect attempts. Please sign up again to get a new code.',
          code: 'TOO_MANY_ATTEMPTS',
        };
      }

      if (String(data.otp_code) !== otp) {
        await supabase
          .from('pending_signups')
          .update({ otp_attempts: attempts + 1 })
          .eq('id', data.id);
        return {
          success: false,
          error: 'Incorrect verification code. Please try again.',
          code: 'INVALID_OTP',
        };
      }

      pending = data;
    } else if (token) {
      const { data, error: pendingError } = await supabase
        .from('pending_signups')
        .select('*')
        .eq('verification_token', token)
        .is('verified_at', null)
        .maybeSingle();

      if (pendingError || !data) {
        return {
          success: false,
          error: 'This verification link is invalid or has already been used.',
          code: 'INVALID_TOKEN',
        };
      }
      pending = data;
    } else {
      return { success: false, error: 'Email and OTP code are required.' };
    }

    if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
      return {
        success: false,
        error: 'This verification code has expired. Please sign up again.',
        code: 'EXPIRED',
      };
    }

    const password = decryptPasswordNode(pending.password_encrypted, serviceKey);

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
        return {
          success: true,
          alreadyExists: true,
          email: pending.email,
          message: 'Your email is verified. Please sign in with your password.',
        };
      }
      return { success: false, error: msg };
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
      return {
        success: false,
        error: bootstrapError instanceof Error
          ? bootstrapError.message
          : 'Account creation failed during organization setup.',
      };
    }

    await supabase
      .from('pending_signups')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', pending.id);

    return {
      success: true,
      email: pending.email,
      message: 'Email verified. Your account is ready — please sign in.',
    };
  } catch (error) {
    console.error('verifySignup error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}
