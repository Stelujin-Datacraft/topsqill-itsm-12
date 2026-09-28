import type { SupabaseClient } from '@supabase/supabase-js';

type AccountRow = {
  id: string;
  email: string;
  organization_id?: string | null;
  first_name?: string | null;
  status?: string | null;
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

/** Attach/create the solo signup organization for a user missing organization_id. */
export async function ensureSoloOrganization(
  supabase: SupabaseClient,
  args: {
    userId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    organizationName?: string | null;
    organizationDomain?: string | null;
  },
): Promise<string | null> {
  const email = args.email.trim().toLowerCase();
  const firstName = (args.firstName || email.split('@')[0] || 'User').trim();
  const lastName = (args.lastName || firstName).trim();

  // Already linked?
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id, organization_id')
    .eq('id', args.userId)
    .maybeSingle();
  if (existingProfile?.organization_id) return existingProfile.organization_id;

  // Reuse org created for this admin email (solo signup).
  const { data: ownedOrgs } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('admin_email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  let orgId = ownedOrgs?.[0]?.id as string | undefined;

  // Pending signup row may still have the org name after verification.
  let orgName = (args.organizationName || '').trim();
  let orgDomain = (args.organizationDomain || '').trim() || null;
  if (!orgName) {
    const { data: pending } = await supabase
      .from('pending_signups')
      .select('organization_name, organization_domain, first_name, last_name')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending?.organization_name) {
      orgName = String(pending.organization_name);
      orgDomain = (pending.organization_domain as string) || orgDomain;
    }
  }

  if (!orgId) {
    // Auth metadata from OTP signup.
    if (!orgName) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(args.userId);
        const meta = authUser?.user?.user_metadata || {};
        orgName = String(meta.organization_name || '').trim();
        orgDomain = String(meta.organization_domain || '').trim() || orgDomain;
      } catch {
        // ignore
      }
    }

    if (!orgName) {
      orgName = `${firstName}'s Organization`;
    }

    const domain = orgDomain || buildOrgDomain(orgName, email);
    const { data: created, error: createError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        domain,
        description: null,
        admin_email: email,
        status: 'active',
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      // Domain collision — retry with fresh suffix once.
      const { data: retry, error: retryError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          domain: buildOrgDomain(orgName, email),
          description: null,
          admin_email: email,
          status: 'active',
        })
        .select('id')
        .single();
      if (retryError || !retry?.id) {
        console.error('ensureSoloOrganization create org failed:', createError || retryError);
        return null;
      }
      orgId = retry.id;
    } else {
      orgId = created.id;
    }
  }

  const { error: profileError } = await supabase.from('user_profiles').upsert(
    {
      id: args.userId,
      email,
      first_name: firstName,
      last_name: lastName,
      organization_id: orgId,
      role: 'admin',
      status: 'active',
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    console.error('ensureSoloOrganization profile upsert failed:', profileError);
    return null;
  }

  await supabase.from('user_organizations').upsert(
    { user_id: args.userId, organization_id: orgId, role: 'admin' },
    { onConflict: 'user_id,organization_id' },
  );

  return orgId;
}

export async function resolveSignInAccount(
  supabase: SupabaseClient,
  email: string,
): Promise<AccountRow | null> {
  const normalized = email.trim().toLowerCase();

  const { data: exact } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, first_name, status')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();

  let account = (exact?.id ? exact : null) as AccountRow | null;

  if (!account) {
    const { data: fuzzy, error: fuzzyError } = await supabase
      .from('user_profiles')
      .select('id, email, organization_id, first_name, status')
      .ilike('email', normalized)
      .limit(1);
    if (!fuzzyError && Array.isArray(fuzzy) && fuzzy[0]?.id) {
      account = fuzzy[0] as AccountRow;
    }
  }

  let authUserId = account?.id || null;
  if (!authUserId) {
    const { data: rpcId, error: rpcError } = await supabase.rpc('get_auth_user_id_by_email', {
      p_email: normalized,
    });
    if (!rpcError && rpcId) {
      authUserId = String(rpcId);
    } else {
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalized,
        });
        if (linkData?.user?.id) authUserId = linkData.user.id;
      } catch {
        // ignore
      }
    }
  }

  if (!authUserId) return null;

  // Always ensure solo signup org is attached before returning.
  if (!account?.organization_id) {
    await ensureSoloOrganization(supabase, {
      userId: authUserId,
      email: normalized,
      firstName: account?.first_name,
    });
  }

  const { data: ensured } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, first_name, status')
    .eq('id', authUserId)
    .maybeSingle();

  return (ensured as AccountRow) || account || {
    id: authUserId,
    email: normalized,
    organization_id: null,
    first_name: null,
    status: 'active',
  };
}
