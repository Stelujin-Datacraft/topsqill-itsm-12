 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
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
 });
 
 async function sendNotifications(supabase: any, instance: any, type: string, template: any) {
   try {
     // Get users to notify
     const usersToNotify: string[] = [];
     
     if (instance.assigned_to) {
       usersToNotify.push(instance.assigned_to);
     }
 
     // Get form creator
     const { data: form } = await supabase
       .from('forms')
       .select('created_by')
       .eq('id', instance.form_id)
       .single();
     
     if (form?.created_by && !usersToNotify.includes(form.created_by)) {
       usersToNotify.push(form.created_by);
     }
 
     // Create notifications
     for (const userId of usersToNotify) {
       await supabase.from('notifications').insert({
         user_id: userId,
         type: type === 'warning' ? 'sla_warning' : 'sla_breach',
         title: type === 'warning' ? 'SLA Warning' : 'SLA Breached',
         message: type === 'warning' 
           ? `Record approaching SLA deadline in "${instance.current_stage}" stage`
           : `SLA breached for record in "${instance.current_stage}" stage`,
         data: {
           slaInstanceId: instance.id,
           submissionId: instance.submission_id,
           fieldId: instance.field_id,
           formId: instance.form_id,
           currentStage: instance.current_stage
         }
       });
     }
 
     console.log(`[SLA Processor] Sent ${type} notifications to ${usersToNotify.length} users`);
   } catch (err) {
     console.error('[SLA Processor] Error sending notifications:', err);
   }
 }
 
 async function processEscalation(supabase: any, instance: any, level: string, levelConfig?: any) {
   try {
     const notifiedUsers: string[] = [];
     const notifiedGroups: string[] = [];
     const actionsTaken: any[] = [];
 
     // Find level config if not provided
     if (!levelConfig && instance.chain?.levels) {
       levelConfig = instance.chain.levels.find((l: any) => l.level === level);
     }
 
     if (!levelConfig) {
       console.log(`[SLA Processor] No config found for level ${level}`);
       return;
     }
 
     // Notify specific user
     if (levelConfig.escalate_to_user_id) {
       notifiedUsers.push(levelConfig.escalate_to_user_id);
       
       if (levelConfig.send_notification) {
         await supabase.from('notifications').insert({
           user_id: levelConfig.escalate_to_user_id,
           type: 'sla_escalation',
           title: `SLA Escalation - Level ${level}`,
           message: levelConfig.custom_message || `Task escalated to you due to SLA breach in "${instance.current_stage}" stage`,
           data: {
             slaInstanceId: instance.id,
             submissionId: instance.submission_id,
             level
           }
         });
         actionsTaken.push({ type: 'notification', userId: levelConfig.escalate_to_user_id });
       }
     }
 
     // Notify group members
     if (levelConfig.escalate_to_group_id) {
       notifiedGroups.push(levelConfig.escalate_to_group_id);
       
       const { data: members } = await supabase
         .from('group_memberships')
         .select('member_id')
         .eq('group_id', levelConfig.escalate_to_group_id)
         .eq('member_type', 'user');
 
       if (members && levelConfig.send_notification) {
         for (const member of members) {
           await supabase.from('notifications').insert({
             user_id: member.member_id,
             type: 'sla_escalation',
             title: `SLA Escalation - Level ${level}`,
             message: levelConfig.custom_message || `Task escalated to your group due to SLA breach`,
             data: {
               slaInstanceId: instance.id,
               submissionId: instance.submission_id,
               level
             }
           });
           notifiedUsers.push(member.member_id);
         }
         actionsTaken.push({ type: 'group_notification', groupId: levelConfig.escalate_to_group_id });
       }
     }
 
     // Auto-reassign if configured
     if (levelConfig.auto_reassign && levelConfig.escalate_to_user_id) {
       await supabase
         .from('sla_instances')
         .update({ assigned_to: levelConfig.escalate_to_user_id })
         .eq('id', instance.id);
       actionsTaken.push({ type: 'reassign', userId: levelConfig.escalate_to_user_id });
     }
 
     // Change priority if configured
     if (levelConfig.change_priority && levelConfig.new_priority) {
       await supabase
         .from('sla_instances')
         .update({ priority: levelConfig.new_priority })
         .eq('id', instance.id);
       actionsTaken.push({ type: 'priority_change', newPriority: levelConfig.new_priority });
     }
 
     // Log escalation event
     await supabase.from('escalation_events').insert({
       sla_instance_id: instance.id,
       escalation_level: level,
       event_type: 'escalated',
       notified_users: notifiedUsers,
       notified_groups: notifiedGroups,
       actions_taken: actionsTaken,
       message: `Escalated to ${level}${levelConfig.custom_message ? `: ${levelConfig.custom_message}` : ''}`
     });
 
     console.log(`[SLA Processor] Escalation to ${level} completed with ${actionsTaken.length} actions`);
   } catch (err) {
     console.error('[SLA Processor] Error processing escalation:', err);
   }
 }