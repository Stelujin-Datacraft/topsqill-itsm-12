import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { SupabaseService } from './supabase/supabase.service';
import { parseSupabaseApiKeyRole } from './supabase/supabase-key-role';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Safe (no secrets) diagnostics for the shared Nest → Supabase CRUD path.
   * When every module fails create/delete on a VM, hit this first.
   */
  @Public()
  @SkipThrottle()
  @Get('crud')
  crudPath() {
    const environment = (
      this.configService.get<string>('ENVIRONMENT')
      || this.configService.get<string>('NODE_ENV')
      || 'unknown'
    ).toLowerCase();

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    let supabaseHost = '';
    try {
      supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
    } catch {
      supabaseHost = '(invalid SUPABASE_URL)';
    }

    const anonConfigured = Boolean(
      this.configService.get<string>('SUPABASE_ANON_KEY')?.trim(),
    );
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const serviceRole = parseSupabaseApiKeyRole(serviceKey || '');
    const serviceRoleOk =
      this.supabaseService.isServiceRoleKeyValid()
      && (serviceRole.role === 'service_role' || !serviceRole.isJwt);

    const ready = Boolean(supabaseHost) && anonConfigured && serviceRoleOk;

    return {
      status: ready ? 'ok' : 'misconfigured',
      timestamp: new Date().toISOString(),
      environment,
      supabaseHost,
      anonKeyConfigured: anonConfigured,
      serviceRoleJwtRole: serviceRole.role,
      serviceRoleKeyOk: serviceRoleOk,
      /**
       * All UI modules (Forms, Workflows, Reports, Dashboards, Access Control,
       * IT Assets, …) share Nest POST /database/{insert,update,delete,upsert}
       * with the signed-in user JWT. Fix env + deploy before chasing per-module bugs.
       */
      sharedMutationPath: '/api/database/{insert,update,delete,upsert}',
      hints: ready
        ? [
            'Nest env looks coherent. If create/delete still fail everywhere: (1) Dev — apply repairs 01–10; (2) confirm frontend VITE_SUPABASE_URL host matches supabaseHost; (3) confirm the user has org/project membership.',
          ]
        : [
            !supabaseHost ? 'Set SUPABASE_URL to this environment’s Supabase project.' : null,
            !anonConfigured
              ? 'Set SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY in compose) — required for user-scoped PostgREST.'
              : null,
            !serviceRoleOk
              ? 'SUPABASE_SERVICE_ROLE_KEY must be the service_role secret (not anon). See docs/dev-schema-repair/VM_CRUD_ENV_FIX.md.'
              : null,
          ].filter(Boolean),
    };
  }
}
