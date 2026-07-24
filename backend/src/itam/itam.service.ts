import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ItamService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async handleAgentReport(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { action, agentId, apiKey, hostname, hardware, software } = body as Record<string, unknown>;

    switch (action) {
      case 'register': {
        const { data: agent, error } = await supabase
          .from('asset_agents')
          .insert({
            hostname: hostname || 'unknown',
            api_key: apiKey || crypto.randomUUID(),
            status: 'active',
            last_seen_at: new Date().toISOString(),
          })
          .select()
          .single();
        return { success: !error, agent, error: error?.message };
      }
      case 'heartbeat': {
        await supabase
          .from('asset_agents')
          .update({ last_seen_at: new Date().toISOString(), status: 'active' })
          .eq('id', agentId);
        return { success: true };
      }
      case 'report': {
        if (hardware) {
          await supabase.from('asset_hardware_info').upsert({
            agent_id: agentId,
            ...(hardware as Record<string, unknown>),
            updated_at: new Date().toISOString(),
          });
        }
        if (software && Array.isArray(software)) {
          for (const item of software) {
            await supabase.from('asset_software').upsert({
              agent_id: agentId,
              ...(item as Record<string, unknown>),
            });
          }
        }
        return { success: true };
      }
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }
}
