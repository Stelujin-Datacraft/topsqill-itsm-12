/**
 * TopSqill Form API tenant diagnostic — never logs secret values.
 * Does NOT bypass RLS. Classifies READ_ONLY_TEST vs WRITABLE.
 */
import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PilotEnvironmentName, TopSqillApiConfig } from './pilot-env';
import { redactUrl } from './pilot-env';

export type TopSqillWriteCapability = 'WRITABLE' | 'READ_ONLY_TEST' | 'UNREACHABLE' | 'MISCONFIGURED';

export interface TopSqillDiagnosticReport {
  startedAt: string;
  finishedAt?: string;
  environment: PilotEnvironmentName;
  authenticationIdentity: {
    keyEnvVar: string;
    jwtRole: string | null;
    keyFingerprint: string | null;
    expectedRoleForWrites: 'service_role';
    roleMatchesServiceRole: boolean;
    anonSameAsServiceEnv: boolean | null;
    authUserPresent: boolean;
    authUserId: string | null;
  };
  tenantContext: {
    supabaseHost: string | null;
    organizationsVisible: number;
    organizationNamesSample: string[];
    configuredOrganizationId?: string;
    configuredTenantId?: string;
  };
  applicationContext: {
    formsVisible: number;
    formsExactCount: number | null;
    configuredFormId?: string;
    configuredFormName?: string;
  };
  environmentContext: {
    pilotEnv: PilotEnvironmentName;
    baseUrlRedacted: string;
  };
  requiredPermissions: string[];
  requiredRoles: string[];
  requiredApiScopes: string[];
  rlsRequirements: string[];
  endpoints: Array<{
    name: string;
    method: string;
    tableOrPath: string;
    httpStatus: number | null;
    ok: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
  writeCapability: TopSqillWriteCapability;
  blockers: string[];
  prerequisitesToUnlockWrites: string[];
}

function jwtRoleAndFingerprint(key: string | undefined): { role: string | null; fingerprint: string | null } {
  if (!key) return { role: null, fingerprint: null };
  const fingerprint = createHash('sha256').update(key).digest('hex').slice(0, 12);
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return { role: payload.role || null, fingerprint };
  } catch {
    return { role: null, fingerprint };
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function endpoint(
  name: string,
  method: string,
  tableOrPath: string,
  run: () => Promise<{ status?: number | null; error?: { message?: string; code?: string } | null; ok: boolean }>,
) {
  try {
    const r = await run();
    return {
      name,
      method,
      tableOrPath,
      httpStatus: r.status ?? null,
      ok: r.ok,
      errorCode: r.error?.code || null,
      errorMessage: r.error?.message || null,
    };
  } catch (e: any) {
    return {
      name,
      method,
      tableOrPath,
      httpStatus: null,
      ok: false,
      errorCode: 'EXCEPTION',
      errorMessage: e?.message || String(e),
    };
  }
}

export async function diagnoseTopSqillTenant(opts: {
  config: TopSqillApiConfig;
  environment: PilotEnvironmentName;
}): Promise<TopSqillDiagnosticReport> {
  const startedAt = new Date().toISOString();
  const serviceKey = process.env[opts.config.credentialReferences.serviceRoleKeyEnv];
  const anonKey = process.env[opts.config.credentialReferences.anonKeyEnv];
  const url = opts.config.supabaseUrl || process.env.SUPABASE_URL || '';
  const meta = jwtRoleAndFingerprint(serviceKey);
  const anonMeta = jwtRoleAndFingerprint(anonKey);

  const report: TopSqillDiagnosticReport = {
    startedAt,
    environment: opts.environment,
    authenticationIdentity: {
      keyEnvVar: opts.config.credentialReferences.serviceRoleKeyEnv,
      jwtRole: meta.role,
      keyFingerprint: meta.fingerprint,
      expectedRoleForWrites: 'service_role',
      roleMatchesServiceRole: meta.role === 'service_role',
      anonSameAsServiceEnv: serviceKey && anonKey ? serviceKey === anonKey : null,
      authUserPresent: false,
      authUserId: null,
    },
    tenantContext: {
      supabaseHost: hostOf(url),
      organizationsVisible: 0,
      organizationNamesSample: [],
      configuredOrganizationId: opts.config.organizationId,
      configuredTenantId: opts.config.tenantId,
    },
    applicationContext: {
      formsVisible: 0,
      formsExactCount: null,
      configuredFormId: opts.config.formId,
      configuredFormName: opts.config.formName,
    },
    environmentContext: {
      pilotEnv: opts.environment,
      baseUrlRedacted: redactUrl(opts.config.baseUrl || url || ''),
    },
    requiredPermissions: [
      'SELECT on public.forms (org/project scoped or service_role)',
      'INSERT on public.forms for bootstrap of VIS Integration Test Form (admin/service_role)',
      'INSERT/UPDATE/SELECT on public.form_submissions for test form records',
      'SELECT on public.form_fields for schema discovery',
    ],
    requiredRoles: [
      'JWT role service_role for platform FormApiService (bypasses RLS)',
      'OR authenticated user with org admin / project member roles satisfying forms_insert / submission policies',
    ],
    requiredApiScopes: opts.config.apiScopes,
    rlsRequirements: [
      'Do NOT disable RLS',
      'forms_insert requires auth.uid() in user_profiles org or project_users — anon without user fails',
      'service_role JWT bypasses RLS when correctly configured in Supabase',
      'Authenticated org member can create forms/submissions within their organization',
    ],
    endpoints: [],
    writeCapability: 'MISCONFIGURED',
    blockers: [],
    prerequisitesToUnlockWrites: [],
  };

  if (!url || !serviceKey) {
    report.writeCapability = 'UNREACHABLE';
    report.blockers.push('SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY missing');
    report.prerequisitesToUnlockWrites.push(
      'Provide SUPABASE_URL and a true service_role key (JWT role claim must be service_role)',
    );
    report.finishedAt = new Date().toISOString();
    return report;
  }

  if (meta.role !== 'service_role') {
    report.blockers.push(
      `SUPABASE_SERVICE_ROLE_KEY JWT role is "${meta.role || 'unknown'}" — expected "service_role". `
      + 'Current env appears to use the anon key (writes subject to RLS; auth.uid() is null).',
    );
    report.prerequisitesToUnlockWrites.push(
      'From Supabase Dashboard → Project Settings → API, copy the service_role secret into SUPABASE_SERVICE_ROLE_KEY (never commit it)',
      'Keep SUPABASE_ANON_KEY as the anon/publishable key',
      'Restart backend after rotating env',
    );
  }

  const sb: SupabaseClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data } = await sb.auth.getUser();
    report.authenticationIdentity.authUserPresent = Boolean(data?.user);
    report.authenticationIdentity.authUserId = data?.user?.id || null;
  } catch {
    /* no session expected for service key */
  }

  const orgsEp = await endpoint('list_organizations', 'GET', 'organizations', async () => {
    const r = await sb.from('organizations').select('id,name').limit(10);
    report.tenantContext.organizationsVisible = r.data?.length ?? 0;
    report.tenantContext.organizationNamesSample = (r.data || []).map((o: any) => o.name).slice(0, 5);
    return { status: (r as any).status ?? (r.error ? 400 : 200), error: r.error, ok: !r.error };
  });
  report.endpoints.push(orgsEp);

  const formsEp = await endpoint('list_forms', 'GET', 'forms', async () => {
    const r = await sb.from('forms').select('id,name,status,organization_id').limit(20);
    report.applicationContext.formsVisible = r.data?.length ?? 0;
    return { status: (r as any).status ?? (r.error ? 400 : 200), error: r.error, ok: !r.error };
  });
  report.endpoints.push(formsEp);

  const countEp = await endpoint('count_forms', 'HEAD', 'forms', async () => {
    const r = await sb.from('forms').select('id', { count: 'exact', head: true });
    report.applicationContext.formsExactCount = r.count ?? null;
    return { status: (r as any).status ?? (r.error ? 400 : 200), error: r.error, ok: !r.error };
  });
  report.endpoints.push(countEp);

  const orgId =
    opts.config.organizationId
    || (report.tenantContext.organizationsVisible > 0
      ? (await sb.from('organizations').select('id').limit(1)).data?.[0]?.id
      : null);

  const insertEp = await endpoint('probe_form_insert', 'POST', 'forms', async () => {
    if (!orgId) {
      return {
        status: null,
        ok: false,
        error: { message: 'No organization_id available for insert probe', code: 'NO_ORG' },
      };
    }
    const r = await sb
      .from('forms')
      .insert({
        name: 'VIS-PILOT-DIAG-PROBE-DELETE-ME',
        organization_id: orgId,
        status: 'draft',
      })
      .select('id')
      .single();
    if (r.data?.id) {
      await sb.from('forms').delete().eq('id', r.data.id);
    }
    return { status: (r as any).status ?? (r.error ? 403 : 201), error: r.error, ok: !r.error };
  });
  report.endpoints.push(insertEp);

  if (report.applicationContext.formsExactCount === 0) {
    report.blockers.push('forms table has 0 rows visible to this identity — no target form exists for pilot');
    report.prerequisitesToUnlockWrites.push(
      'Create dedicated form "VIS Integration Test Form" in a non-production TEST/UAT org',
      'Fields: externalId, title, description, severity, owner, sourceSystem, sourceEnvironment, lastSyncedAt',
      'Set VIS_PILOT_TOPSQILL_FORM_ID and VIS_PILOT_TOPSQILL_ORG_ID',
    );
  }

  if (!insertEp.ok) {
    report.blockers.push(`Form insert blocked: ${insertEp.errorMessage || insertEp.errorCode || 'unknown'}`);
  }

  if (meta.role === 'service_role' && insertEp.ok) {
    report.writeCapability = 'WRITABLE';
  } else if (formsEp.ok) {
    report.writeCapability = 'READ_ONLY_TEST';
  } else {
    report.writeCapability = 'UNREACHABLE';
  }

  report.finishedAt = new Date().toISOString();
  return report;
}
