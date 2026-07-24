// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';

   
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 

export async function processSlaEscalations(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

   
 
   try {
     const supabaseUrl = ctx.getEnv('SUPABASE_URL')!;
     const supabaseKey = ctx.getEnv('SUPABASE_SERVICE_ROLE_KEY')!;
     
 
     console.log('[SLA Processor] Starting SLA escalation check...');
 
     const now = new Date();
 
     // Fetch active SLA instances that need checking
     const { data: slaInstances, error: fetchError } = await supabase
       .from('sla_instances')
       .select(`
         *,
         template:sla_templates(*),
         chain:escalation_chains(
           *,
           levels:escalation_levels(*)
         )
       `)
       .in('status', ['on_track', 'warning'])
       .order('breach_at', { ascending: true })
       .limit(100);
 
     if (fetchError) {
       console.error('[SLA Processor] Error fetching SLA instances:', fetchError);
       throw fetchError;
     }
 
     console.log(`[SLA Processor] Found ${slaInstances?.length || 0} active SLA instances to check`);
 
     const results = {
       checked: 0,
       warnings: 0,
       breaches: 0,
       escalations: 0,
       errors: 0
     };
 
     for (const instance of slaInstances || []) {
       results.checked++;
       
       try {
         const startedAt = new Date(instance.started_at);
         const warningAt = instance.warning_at ? new Date(instance.warning_at) : null;
         const breachAt = instance.breach_at ? new Date(instance.breach_at) : null;
         
         // Calculate effective time (subtract paused time)
         const pausedMinutes = instance.total_paused_minutes || 0;
         const effectiveNow = new Date(now.getTime() - pausedMinutes * 60 * 1000);
 
         // Check for warning
         if (instance.status === 'on_track' && warningAt && effectiveNow >= warningAt) {
           console.log(`[SLA Processor] Warning triggered for instance ${instance.id}`);
           
           await supabase
             .from('sla_instances')
             .update({ status: 'warning', updated_at: now.toISOString() })
             .eq('id', instance.id);
 
           // Create warning event
           await supabase.from('escalation_events').insert({
             sla_instance_id: instance.id,
             escalation_level: 'L1',
             event_type: 'warning',
             message: `SLA warning: Record has been in "${instance.current_stage}" stage for ${instance.template?.warning_hours || 0} hours`
           });
 
           // Send notifications
           await sendNotifications(supabase, instance, 'warning', instance.template);
           
           results.warnings++;
         }
 
         // Check for breach
         if ((instance.status === 'on_track' || instance.status === 'warning') && breachAt && effectiveNow >= breachAt) {
           console.log(`[SLA Processor] Breach triggered for instance ${instance.id}`);
           
           await supabase
             .from('sla_instances')
             .update({ 
               status: 'breached', 
               current_escalation_level: 'L1',
               last_escalation_at: now.toISOString(),
               escalation_count: (instance.escalation_count || 0) + 1,
               updated_at: now.toISOString() 
             })
             .eq('id', instance.id);
 
           // Create breach event
           await supabase.from('escalation_events').insert({
             sla_instance_id: instance.id,
             escalation_level: 'L1',
             event_type: 'breach',
             message: `SLA breached: Record exceeded ${instance.template?.breach_hours || 0} hours in "${instance.current_stage}" stage`
           });
 
           // Process escalation chain
           if (instance.chain) {
             await processEscalation(supabase, instance, 'L1');
           }
           
           results.breaches++;
         }
 
         // Check for further escalations (L2, L3, L4)
         if (instance.status === 'breached' && instance.chain?.levels) {
           const currentLevelIndex = ['L1', 'L2', 'L3', 'L4'].indexOf(instance.current_escalation_level || 'L1');
           const sortedLevels = instance.chain.levels.sort((a: any, b: any) => a.level_order - b.level_order);
           
           for (const level of sortedLevels) {
             const levelIndex = ['L1', 'L2', 'L3', 'L4'].indexOf(level.level);
             if (levelIndex > currentLevelIndex) {
               const hoursAfterBreach = level.hours_after_breach || 0;
               const escalationTime = new Date(breachAt!.getTime() + hoursAfterBreach * 60 * 60 * 1000);
               
               if (effectiveNow >= escalationTime) {
                 console.log(`[SLA Processor] Escalating to ${level.level} for instance ${instance.id}`);
                 
                 await supabase
                   .from('sla_instances')
                   .update({
                     current_escalation_level: level.level,
                     last_escalation_at: now.toISOString(),
                     escalation_count: (instance.escalation_count || 0) + 1
                   })
                   .eq('id', instance.id);
 
                 await processEscalation(supabase, instance, level.level, level);
                 results.escalations++;
                 break; // Only one escalation per check
               }
             }
           }
         }
       } catch (instanceError) {
         console.error(`[SLA Processor] Error processing instance ${instance.id}:`, instanceError);
         results.errors++;
       }
     }
 
     console.log('[SLA Processor] Completed:', results);
 
     return new Response(JSON.stringify({ success: true, results }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
 
   } catch (error) {
     console.error('[SLA Processor] Fatal error:', error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     });
   }
}
