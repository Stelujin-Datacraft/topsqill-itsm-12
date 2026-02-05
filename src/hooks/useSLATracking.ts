 import { useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 
 interface SLAConfig {
   enableSlaTracking?: boolean;
   slaTemplateId?: string;
   escalationChainId?: string;
   slaTrackedStages?: string[];
 }
 
 interface CreateSLAInstanceParams {
   submissionId: string;
   fieldId: string;
   formId: string;
   currentStage: string;
   config: SLAConfig;
   priority?: string;
   assignedTo?: string;
 }
 
 export function useSLATracking() {
   
   /**
    * Create or update SLA instance when a lifecycle stage changes
    */
   const handleStageChange = useCallback(async (params: CreateSLAInstanceParams) => {
     const { submissionId, fieldId, formId, currentStage, config, priority = 'medium', assignedTo } = params;
     
     if (!config.enableSlaTracking || !config.slaTemplateId) {
       console.log('[SLA Tracking] SLA not enabled for this field');
       return null;
     }
 
     // Check if this stage should be tracked
     const trackedStages = config.slaTrackedStages || [];
     if (trackedStages.length > 0 && !trackedStages.includes(currentStage)) {
       console.log('[SLA Tracking] Stage not in tracked list:', currentStage);
       // Complete any existing SLA instance since we moved to a non-tracked stage
       await completeExistingSLAInstance(submissionId, fieldId);
       return null;
     }
 
     try {
       // Fetch the SLA template to calculate warning/breach times
       const { data: template, error: templateError } = await supabase
         .from('sla_templates')
         .select('*')
         .eq('id', config.slaTemplateId)
         .single();
 
       if (templateError || !template) {
         console.error('[SLA Tracking] Template not found:', templateError);
         return null;
       }
 
       // Calculate warning and breach times based on template and priority
       const now = new Date();
       const priorityMultipliers = template.priority_multipliers as Record<string, number> || { high: 0.5, medium: 1, low: 1.5 };
       const multiplier = priorityMultipliers[priority] || 1;
       
       const warningHours = template.warning_hours * multiplier;
       const breachHours = template.breach_hours * multiplier;
       
       const warningAt = new Date(now.getTime() + warningHours * 60 * 60 * 1000);
       const breachAt = new Date(now.getTime() + breachHours * 60 * 60 * 1000);
 
       // Check for existing SLA instance for this submission/field
       const { data: existing } = await supabase
         .from('sla_instances')
         .select('id, status')
         .eq('submission_id', submissionId)
         .eq('field_id', fieldId)
         .in('status', ['on_track', 'warning', 'paused'])
         .single();
 
       if (existing) {
         // Update existing instance with new stage
         const { error: updateError } = await supabase
           .from('sla_instances')
           .update({
             current_stage: currentStage,
             started_at: now.toISOString(),
             warning_at: warningAt.toISOString(),
             breach_at: breachAt.toISOString(),
             status: 'on_track',
             updated_at: now.toISOString()
           })
           .eq('id', existing.id);
 
         if (updateError) {
           console.error('[SLA Tracking] Error updating SLA instance:', updateError);
           return null;
         }
 
         console.log('[SLA Tracking] Updated SLA instance:', existing.id);
         return existing.id;
       } else {
         // Create new SLA instance
         const { data: newInstance, error: insertError } = await supabase
           .from('sla_instances')
           .insert({
             submission_id: submissionId,
             field_id: fieldId,
             form_id: formId,
             template_id: config.slaTemplateId,
             chain_id: config.escalationChainId || null,
             current_stage: currentStage,
             status: 'on_track',
             priority,
             started_at: now.toISOString(),
             warning_at: warningAt.toISOString(),
             breach_at: breachAt.toISOString(),
             assigned_to: assignedTo || null
           })
           .select('id')
           .single();
 
         if (insertError) {
           console.error('[SLA Tracking] Error creating SLA instance:', insertError);
           return null;
         }
 
         console.log('[SLA Tracking] Created SLA instance:', newInstance.id);
         return newInstance.id;
       }
     } catch (err) {
       console.error('[SLA Tracking] Unexpected error:', err);
       return null;
     }
   }, []);
 
   /**
    * Complete an existing SLA instance (when record moves to final stage)
    */
   const completeExistingSLAInstance = async (submissionId: string, fieldId: string) => {
     try {
       const { error } = await supabase
         .from('sla_instances')
         .update({
           status: 'completed',
           completed_at: new Date().toISOString()
         })
         .eq('submission_id', submissionId)
         .eq('field_id', fieldId)
         .in('status', ['on_track', 'warning', 'paused']);
 
       if (error) {
         console.error('[SLA Tracking] Error completing SLA instance:', error);
       }
     } catch (err) {
       console.error('[SLA Tracking] Error completing SLA instance:', err);
     }
   };
 
   /**
    * Pause an SLA instance
    */
   const pauseSLAInstance = useCallback(async (submissionId: string, fieldId: string) => {
     try {
       const { error } = await supabase
         .from('sla_instances')
         .update({
           status: 'paused',
           paused_at: new Date().toISOString()
         })
         .eq('submission_id', submissionId)
         .eq('field_id', fieldId)
         .in('status', ['on_track', 'warning']);
 
       if (error) {
         console.error('[SLA Tracking] Error pausing SLA instance:', error);
       }
     } catch (err) {
       console.error('[SLA Tracking] Error pausing SLA instance:', err);
     }
   }, []);
 
   /**
    * Resume a paused SLA instance
    */
   const resumeSLAInstance = useCallback(async (submissionId: string, fieldId: string) => {
     try {
       // Get the paused instance
       const { data: instance } = await supabase
         .from('sla_instances')
         .select('*')
         .eq('submission_id', submissionId)
         .eq('field_id', fieldId)
         .eq('status', 'paused')
         .single();
 
       if (!instance || !instance.paused_at) return;
 
       const pausedAt = new Date(instance.paused_at);
       const now = new Date();
       const pausedMinutes = Math.floor((now.getTime() - pausedAt.getTime()) / (60 * 1000));
       const totalPausedMinutes = (instance.total_paused_minutes || 0) + pausedMinutes;
 
       const { error } = await supabase
         .from('sla_instances')
         .update({
           status: 'on_track',
           paused_at: null,
           total_paused_minutes: totalPausedMinutes
         })
         .eq('id', instance.id);
 
       if (error) {
         console.error('[SLA Tracking] Error resuming SLA instance:', error);
       }
     } catch (err) {
       console.error('[SLA Tracking] Error resuming SLA instance:', err);
     }
   }, []);
 
   /**
    * Get SLA status for a submission
    */
   const getSLAStatus = useCallback(async (submissionId: string) => {
     try {
       const { data, error } = await supabase
         .from('sla_instances')
         .select('*, template:sla_templates(name)')
         .eq('submission_id', submissionId)
         .order('created_at', { ascending: false })
         .limit(1)
         .single();
 
       if (error) return null;
       return data;
     } catch {
       return null;
     }
   }, []);
 
   return {
     handleStageChange,
     pauseSLAInstance,
     resumeSLAInstance,
     getSLAStatus
   };
 }