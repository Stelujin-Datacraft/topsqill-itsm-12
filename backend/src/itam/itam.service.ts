import { Inject, Injectable } from '@nestjs/common';
import { EngineHostService } from '../engines/engine-host.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SupabaseService } from '../supabase/supabase.service';

type Headers = Record<string, string | string[] | undefined>;

@Injectable()
export class ItamService {
  constructor(
    private readonly engineHost: EngineHostService,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(SupabaseService) private readonly supabase: SupabaseService,
  ) {}

  /** Agents are not signed-in users, so the organisation comes from the report or the registered agent. */
  private async agentOrganizationId(body: Record<string, unknown>, headers?: Headers): Promise<string | null> {
    if (typeof body.organization_id === 'string' && body.organization_id) return body.organization_id;
    const raw = headers?.['x-agent-key'];
    const agentKey = Array.isArray(raw) ? raw[0] : raw;
    if (!agentKey) return null;
    const { data } = await this.supabase
      .getServiceClient()
      .from('asset_agents')
      .select('organization_id')
      .eq('agent_key', agentKey)
      .maybeSingle();
    return (data?.organization_id as string | undefined) ?? null;
  }

  async handleAgentReport(body: Record<string, unknown>, headers?: Headers) {
    const organizationId = await this.agentOrganizationId(body, headers);
    if (organizationId) {
      await this.entitlements.assertModule(organizationId, 'asset-discovery', 'use');
    }
    return this.engineHost.assetAgentReport(body, headers);
  }
}
