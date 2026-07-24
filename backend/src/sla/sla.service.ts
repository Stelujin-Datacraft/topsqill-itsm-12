import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SlaService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async predictBreach() {
    const supabase = this.supabaseService.getServiceClient();

    const { data: instances } = await supabase
      .from('sla_instances')
      .select('*, sla_templates(*)')
      .in('status', ['active', 'at_risk'])
      .limit(100);

    const predictions = (instances || []).map((instance) => {
      const dueAt = new Date(instance.due_at).getTime();
      const now = Date.now();
      const remaining = dueAt - now;
      const breachProbability = remaining < 0 ? 1 : Math.max(0, 1 - remaining / (24 * 60 * 60 * 1000));

      return {
        instance_id: instance.id,
        submission_id: instance.submission_id,
        breach_probability: breachProbability,
        at_risk: breachProbability > 0.5,
        hours_remaining: Math.max(0, remaining / (1000 * 60 * 60)),
      };
    });

    for (const pred of predictions.filter((p) => p.at_risk)) {
      await supabase.from('performance_predictions').upsert({
        entity_type: 'sla_instance',
        entity_id: pred.instance_id,
        prediction_type: 'breach_risk',
        probability: pred.breach_probability,
        predicted_at: new Date().toISOString(),
      }, { onConflict: 'entity_type,entity_id,prediction_type' });
    }

    return { success: true, predictions, at_risk_count: predictions.filter((p) => p.at_risk).length };
  }

  async processEscalations() {
    const supabase = this.supabaseService.getServiceClient();

    const { data: atRisk } = await supabase
      .from('sla_instances')
      .select('*')
      .eq('status', 'at_risk')
      .limit(50);

    const escalated: string[] = [];
    for (const instance of atRisk || []) {
      await supabase.from('escalation_events').insert({
        sla_instance_id: instance.id,
        escalation_level: 1,
        triggered_at: new Date().toISOString(),
      });
      escalated.push(instance.id);
    }

    return { success: true, escalated: escalated.length };
  }
}
