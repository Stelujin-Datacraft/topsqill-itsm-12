import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EntitlementsService, isMissingSchemaError } from './entitlements.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import {
  parseApplyPlan,
  parsePlan,
  parseSetEntitlement,
  requireModule,
  requireReason,
  requireUuid,
} from './platform-validation';

@Controller('entitlements')
export class EntitlementsController {
  constructor(@Inject(EntitlementsService) private readonly entitlements: EntitlementsService) {}

  /** What the signed-in user's organisation may use; drives sidebar locks and module pages. */
  @Get('me')
  async me(@Req() req: any) {
    const userId: string = req.user.id;
    const [organizationId, isPlatformAdmin] = await Promise.all([
      this.entitlements.getOrgIdForUser(userId),
      this.entitlements.isPlatformAdmin(userId),
    ]);
    if (!organizationId) throw new ForbiddenException('Your account is not linked to an organisation');
    const [access, usage] = await Promise.all([
      this.entitlements.getOrgAccess(organizationId),
      this.entitlements.usageThisMonth(organizationId),
    ]);
    return { ...access, usage, isPlatformAdmin };
  }
}

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
  ) {}

  private db() {
    return this.supabase.getServiceClient();
  }

  private static check<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
    if (result.error) {
      if (isMissingSchemaError(result.error)) {
        throw new ForbiddenException('Subscriptions are not set up yet. Apply the module entitlements migration.');
      }
      throw new ForbiddenException(result.error.message);
    }
    return result.data;
  }

  @Get('overview')
  async overview() {
    const db = this.db();
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    const [modules, plans, orgs, subscriptions, entitlements, usage] = await Promise.all([
      db.from('platform_modules').select('*').order('sort_order'),
      db.from('platform_plans').select('*').order('sort_order'),
      db.from('organizations').select('id, name, status, created_at').order('name'),
      db.from('org_subscriptions').select('*'),
      db.from('org_entitlements').select('*'),
      db.from('module_usage_counters').select('*').eq('period_start', periodStart.toISOString().slice(0, 10)),
    ]);
    return {
      modules: PlatformController.check(modules),
      plans: PlatformController.check(plans),
      organizations: PlatformController.check(orgs),
      subscriptions: PlatformController.check(subscriptions),
      entitlements: PlatformController.check(entitlements),
      usage: PlatformController.check(usage),
    };
  }

  @Put('plans/:key')
  async upsertPlan(@Req() req: any, @Param('key') key: string, @Body() body: Record<string, unknown>) {
    const plan = parsePlan(key, body || {});
    const applied = PlatformController.check(
      await this.db().rpc('platform_upsert_plan', {
        _key: plan.key,
        _name: plan.name,
        _description: plan.description,
        _modules: plan.modules,
        _limits: plan.limits,
        _active: plan.active,
        _apply_to_subscribers: plan.applyToSubscribers,
        _actor: req.user.id,
        _actor_source: 'console',
        _reason: plan.reason,
      }),
    );
    this.entitlements.invalidate();
    return { ok: true, organizationsUpdated: applied ?? 0 };
  }

  @Post('orgs/:orgId/plan')
  async applyPlan(@Req() req: any, @Param('orgId') orgId: string, @Body() body: Record<string, unknown>) {
    const organizationId = requireUuid(orgId, 'orgId');
    const input = parseApplyPlan(body || {});
    PlatformController.check(
      await this.db().rpc('platform_apply_plan', {
        _org_id: organizationId,
        _plan_key: input.planKey,
        _status: input.status,
        _period_end: input.periodEnd,
        _grace_days: input.graceDays,
        _actor: req.user.id,
        _source: 'console',
        _reason: input.reason,
      }),
    );
    this.entitlements.invalidate(organizationId);
    return { ok: true };
  }

  @Put('orgs/:orgId/modules/:module')
  async setEntitlement(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('module') module: string,
    @Body() body: Record<string, unknown>,
  ) {
    const organizationId = requireUuid(orgId, 'orgId');
    const moduleKey = requireModule(module);
    const input = parseSetEntitlement(body || {});
    PlatformController.check(
      await this.db().rpc('platform_set_entitlement', {
        _org_id: organizationId,
        _module: moduleKey,
        _source: input.source,
        _status: input.status,
        _ends_at: input.endsAt,
        _grace_days: input.graceDays,
        _limits: input.limits,
        _actor: req.user.id,
        _actor_source: 'console',
        _reason: input.reason,
      }),
    );
    this.entitlements.invalidate(organizationId);
    return { ok: true };
  }

  @Delete('orgs/:orgId/modules/:module')
  async removeEntitlement(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('module') module: string,
    @Query('reason') reason: string,
  ) {
    const organizationId = requireUuid(orgId, 'orgId');
    PlatformController.check(
      await this.db().rpc('platform_remove_entitlement', {
        _org_id: organizationId,
        _module: requireModule(module),
        _actor: req.user.id,
        _actor_source: 'console',
        _reason: requireReason(reason),
      }),
    );
    this.entitlements.invalidate(organizationId);
    return { ok: true };
  }

  @Get('audit')
  async audit(@Query('orgId') orgId?: string, @Query('limit') limit?: string) {
    let query = this.db()
      .from('entitlement_audit_log')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 200, 1), 1000));
    if (orgId) query = query.eq('organization_id', requireUuid(orgId, 'orgId'));
    return PlatformController.check(await query);
  }
}
