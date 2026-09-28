import type { SupabaseClient } from '@supabase/supabase-js';

export async function resolveSignInAccount(
  supabase: SupabaseClient,
  email: string,
): Promise<{
  id: string;
  email: string;
  organization_id?: string | null;
  first_name?: string | null;
  status?: string | null;
} | null> {
  const normalized = email.trim().toLowerCase();

  const { data: exact } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, first_name, status')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();
  if (exact?.id) return exact as any;

  const { data: fuzzy, error: fuzzyError } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, first_name, status')
    .ilike('email', normalized)
    .limit(1);
  if (!fuzzyError && Array.isArray(fuzzy) && fuzzy[0]?.id) return fuzzy[0] as any;

  let authUserId: string | null = null;

  const { data: rpcId, error: rpcError } = await supabase.rpc('get_auth_user_id_by_email', {
    p_email: normalized,
  });
  if (!rpcError && rpcId) {
    authUserId = String(rpcId);
  } else {
    // Fallback before/without migration: admin generateLink resolves existing users without sending mail.
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

  if (!authUserId) return null;

  await supabase.from('user_profiles').upsert(
    {
      id: authUserId,
      email: normalized,
      status: 'active',
      role: 'admin',
    },
    { onConflict: 'id' },
  );

  const { data: ensured } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, first_name, status')
    .eq('id', authUserId)
    .maybeSingle();

  if (ensured?.id) return ensured as any;

  return {
    id: authUserId,
    email: normalized,
    organization_id: null,
    first_name: null,
    status: 'active',
  };
}
