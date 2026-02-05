 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { useToast } from '@/hooks/use-toast';
 
 export interface SLATemplate {
   id: string;
   organization_id: string;
   project_id: string | null;
   name: string;
   description: string | null;
   warning_hours: number;
   breach_hours: number;
   use_business_hours: boolean;
   business_start_time: string;
   business_end_time: string;
   business_days: string[];
   exclude_holidays: boolean;
   priority_multipliers: { high: number; medium: number; low: number };
   is_active: boolean;
   created_by: string;
   created_at: string;
   updated_at: string;
 }
 
 export interface EscalationChain {
   id: string;
   organization_id: string;
   project_id: string | null;
   name: string;
   description: string | null;
   is_active: boolean;
   created_by: string;
   created_at: string;
   updated_at: string;
   levels?: EscalationLevel[];
 }
 
 export interface EscalationLevel {
   id: string;
   chain_id: string;
   level: 'L1' | 'L2' | 'L3' | 'L4';
   level_order: number;
   escalate_to_user_id: string | null;
   escalate_to_group_id: string | null;
   escalate_to_role: string | null;
   hours_after_breach: number;
   send_email: boolean;
   send_notification: boolean;
   send_sms: boolean;
   custom_message: string | null;
   auto_reassign: boolean;
   change_priority: boolean;
   new_priority: string | null;
 }
 
 export interface SLAInstance {
   id: string;
   submission_id: string;
   field_id: string;
   form_id: string;
   template_id: string | null;
   chain_id: string | null;
   current_stage: string;
   status: 'on_track' | 'warning' | 'breached' | 'completed' | 'paused';
   priority: string;
   started_at: string;
   warning_at: string | null;
   breach_at: string | null;
   completed_at: string | null;
   paused_at: string | null;
   total_paused_minutes: number;
   current_escalation_level: string | null;
   last_escalation_at: string | null;
   escalation_count: number;
   assigned_to: string | null;
 }
 
 export function useSLATemplates(projectId?: string) {
   const [templates, setTemplates] = useState<SLATemplate[]>([]);
   const [loading, setLoading] = useState(true);
   const { userProfile } = useAuth();
   const { toast } = useToast();
 
   const fetchTemplates = useCallback(async () => {
     if (!userProfile?.organization_id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('sla_templates')
         .select('*')
         .eq('organization_id', userProfile.organization_id)
         .order('name');
 
       if (error) throw error;
       setTemplates((data as any[]) || []);
     } catch (err: any) {
       console.error('Error fetching SLA templates:', err);
       toast({ title: 'Error', description: 'Failed to load SLA templates', variant: 'destructive' });
     } finally {
       setLoading(false);
     }
   }, [userProfile?.organization_id, projectId, toast]);
 
   useEffect(() => {
     fetchTemplates();
   }, [fetchTemplates]);
 
   const createTemplate = async (data: Partial<SLATemplate>) => {
     if (!userProfile) return null;
     try {
       const insertData = {
         ...data,
         organization_id: userProfile.organization_id,
         created_by: userProfile.id
       };
       const { data: created, error } = await supabase
         .from('sla_templates')
         .insert(insertData as any)
         .select()
         .single();
       if (error) throw error;
       await fetchTemplates();
       toast({ title: 'Success', description: 'SLA template created' });
       return created;
     } catch (err: any) {
       console.error('Error creating SLA template:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
       return null;
     }
   };
 
   const updateTemplate = async (id: string, data: Partial<SLATemplate>) => {
     try {
       const { error } = await supabase
         .from('sla_templates')
         .update(data)
         .eq('id', id);
       if (error) throw error;
       await fetchTemplates();
       toast({ title: 'Success', description: 'SLA template updated' });
     } catch (err: any) {
       console.error('Error updating SLA template:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     }
   };
 
   const deleteTemplate = async (id: string) => {
     try {
       const { error } = await supabase
         .from('sla_templates')
         .delete()
         .eq('id', id);
       if (error) throw error;
       await fetchTemplates();
       toast({ title: 'Success', description: 'SLA template deleted' });
     } catch (err: any) {
       console.error('Error deleting SLA template:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     }
   };
 
   return { templates, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate };
 }
 
 export function useEscalationChains(projectId?: string) {
   const [chains, setChains] = useState<EscalationChain[]>([]);
   const [loading, setLoading] = useState(true);
   const { userProfile } = useAuth();
   const { toast } = useToast();
 
   const fetchChains = useCallback(async () => {
     if (!userProfile?.organization_id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('escalation_chains')
         .select('*, levels:escalation_levels(*)')
         .eq('organization_id', userProfile.organization_id)
         .order('name');
 
       if (error) throw error;
       setChains((data as any[]) || []);
     } catch (err: any) {
       console.error('Error fetching escalation chains:', err);
       toast({ title: 'Error', description: 'Failed to load escalation chains', variant: 'destructive' });
     } finally {
       setLoading(false);
     }
   }, [userProfile?.organization_id, projectId, toast]);
 
   useEffect(() => {
     fetchChains();
   }, [fetchChains]);
 
   const createChain = async (data: Partial<EscalationChain>) => {
     if (!userProfile) return null;
     try {
       const insertData = {
         ...data,
         organization_id: userProfile.organization_id,
         created_by: userProfile.id
       };
       const { data: created, error } = await supabase
         .from('escalation_chains')
         .insert(insertData as any)
         .select()
         .single();
       if (error) throw error;
       await fetchChains();
       toast({ title: 'Success', description: 'Escalation chain created' });
       return created;
     } catch (err: any) {
       console.error('Error creating escalation chain:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
       return null;
     }
   };
 
   const deleteChain = async (id: string) => {
     try {
       const { error } = await supabase
         .from('escalation_chains')
         .delete()
         .eq('id', id);
       if (error) throw error;
       await fetchChains();
       toast({ title: 'Success', description: 'Escalation chain deleted' });
     } catch (err: any) {
       console.error('Error deleting escalation chain:', err);
       toast({ title: 'Error', description: err.message, variant: 'destructive' });
     }
   };
 
   return { chains, loading, fetchChains, createChain, deleteChain };
 }
 
 export function useSLAInstances(formId?: string) {
   const [instances, setInstances] = useState<SLAInstance[]>([]);
   const [loading, setLoading] = useState(true);
   const { toast } = useToast();
 
   const fetchInstances = useCallback(async () => {
     if (!formId) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('sla_instances')
         .select('*')
         .eq('form_id', formId)
         .order('created_at', { ascending: false });
       if (error) throw error;
       setInstances((data as any[]) || []);
     } catch (err: any) {
       console.error('Error fetching SLA instances:', err);
     } finally {
       setLoading(false);
     }
   }, [formId]);
 
   useEffect(() => {
     fetchInstances();
   }, [fetchInstances]);
 
   return { instances, loading, fetchInstances };
 }
 
 export function useSLADashboardStats() {
   const [stats, setStats] = useState({
     total: 0,
     onTrack: 0,
     warning: 0,
     breached: 0,
     completed: 0,
     complianceRate: 0
   });
   const [loading, setLoading] = useState(true);
   const { userProfile } = useAuth();
 
   useEffect(() => {
     const fetchStats = async () => {
       if (!userProfile?.organization_id) return;
       setLoading(true);
       try {
         const { data, error } = await supabase
           .from('sla_instances')
           .select('status, form_id, forms!inner(organization_id)')
           .eq('forms.organization_id', userProfile.organization_id);
 
         if (error) throw error;
 
         const total = data?.length || 0;
         const onTrack = data?.filter(d => d.status === 'on_track').length || 0;
         const warning = data?.filter(d => d.status === 'warning').length || 0;
         const breached = data?.filter(d => d.status === 'breached').length || 0;
         const completed = data?.filter(d => d.status === 'completed').length || 0;
         
         const complianceRate = total > 0 
           ? Math.round(((completed + onTrack) / total) * 100) 
           : 100;
 
         setStats({ total, onTrack, warning, breached, completed, complianceRate });
       } catch (err) {
         console.error('Error fetching SLA stats:', err);
       } finally {
         setLoading(false);
       }
     };
 
     fetchStats();
   }, [userProfile?.organization_id]);
 
   return { stats, loading };
 }