/**
 * AI Context Provider Hook
 * 
 * Provides comprehensive system context for AI generation including:
 * - Available forms with fields
 * - Existing workflows
 * - Users and groups
 * - Email templates
 * - SLA templates
 * - Schema definitions
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContext, useEffect, useState } from 'react';
import { generateSchemaPromptContext, AI_SCHEMA_CONTEXT } from './systemSchema';

export interface AIContextForm {
  id: string;
  name: string;
  description: string | null;
  reference_id: string | null;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
}

export interface AIContextWorkflow {
  id: string;
  name: string;
  description: string | null;
  reference_id: string | null;
  status: string;
  nodeCount?: number;
}

export interface AIContextUser {
  id: string;
  email: string;
  name: string;
}

export interface AIContextGroup {
  id: string;
  name: string;
  memberCount?: number;
}

export interface AIContextEmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string;
}

export interface AIContextSLATemplate {
  id: string;
  name: string;
  description: string | null;
  warning_hours: number;
  breach_hours: number;
}

export interface AIContextData {
  forms: AIContextForm[];
  workflows: AIContextWorkflow[];
  users: AIContextUser[];
  groups: AIContextGroup[];
  emailTemplates: AIContextEmailTemplate[];
  slaTemplates: AIContextSLATemplate[];
  schemaContext: string;
  schemaDefinitions: typeof AI_SCHEMA_CONTEXT;
}

export function useAIContext(projectId?: string) {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);
  
  // Fetch forms with their fields
  const { data: forms = [] } = useQuery({
    queryKey: ['ai-context-forms', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select('id, name, description, reference_id, status')
        .eq('project_id', projectId)
        .in('status', ['published', 'active', 'draft']);
      
      if (formsError) {
        console.error('Error fetching forms for AI context:', formsError);
        return [];
      }
      
      // Fetch fields for each form
      const formsWithFields: AIContextForm[] = await Promise.all(
        (formsData || []).map(async (form) => {
          const { data: fields } = await supabase
            .from('form_fields')
            .select('id, label, field_type, required, options')
            .eq('form_id', form.id)
            .order('field_order');
          
          return {
            id: form.id,
            name: form.name,
            description: form.description,
            reference_id: form.reference_id,
            fields: (fields || []).map(f => ({
              id: f.id,
              label: f.label,
              type: f.field_type,
              required: f.required || false,
              options: f.options ? (Array.isArray(f.options) ? f.options : []).map((o: any) => ({
                value: o.value || o.id,
                label: o.label || o.value
              })) : undefined
            }))
          };
        })
      );
      
      return formsWithFields;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Fetch workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ['ai-context-workflows', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, reference_id, status')
        .eq('project_id', projectId);
      
      if (error) {
        console.error('Error fetching workflows for AI context:', error);
        return [];
      }
      
      // Get node counts
      const workflowsWithNodes: AIContextWorkflow[] = await Promise.all(
        (data || []).map(async (wf) => {
          const { count } = await supabase
            .from('workflow_nodes')
            .select('id', { count: 'exact', head: true })
            .eq('workflow_id', wf.id);
          
          return {
            id: wf.id,
            name: wf.name,
            description: wf.description,
            reference_id: wf.reference_id,
            status: wf.status,
            nodeCount: count || 0
          };
        })
      );
      
      return workflowsWithNodes;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000
  });
  
  // Fetch organization users
  const { data: users = [] } = useQuery({
    queryKey: ['ai-context-users', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get user's organization
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();
      
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'active');
      
      if (error) {
        console.error('Error fetching users for AI context:', error);
        return [];
      }
      
      return (data || []).map(u => ({
        id: u.id,
        email: u.email,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
      }));
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
  
  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['ai-context-groups', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();
      
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('organization_id', profile.organization_id);
      
      if (error) {
        console.error('Error fetching groups for AI context:', error);
        return [];
      }
      
      return (data || []).map(g => ({
        id: g.id,
        name: g.name
      }));
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000
  });
  
  // Fetch email templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ['ai-context-email-templates', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, description, subject')
        .eq('project_id', projectId)
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching email templates for AI context:', error);
        return [];
      }
      
      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        subject: t.subject
      }));
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000
  });
  
  // Fetch SLA templates
  const { data: slaTemplates = [] } = useQuery({
    queryKey: ['ai-context-sla-templates', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();
      
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('sla_templates')
        .select('id, name, description, warning_hours, breach_hours')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching SLA templates for AI context:', error);
        return [];
      }
      
      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        warning_hours: t.warning_hours,
        breach_hours: t.breach_hours
      }));
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000
  });
  
  // Build complete context
  const contextData: AIContextData = {
    forms,
    workflows,
    users,
    groups,
    emailTemplates,
    slaTemplates,
    schemaContext: generateSchemaPromptContext(),
    schemaDefinitions: AI_SCHEMA_CONTEXT
  };
  
  /**
   * Get context for a specific form with full field details
   */
  const getFormContext = (formId: string) => {
    return forms.find(f => f.id === formId);
  };
  
  /**
   * Get context for workflow generation
   */
  const getWorkflowGenerationContext = () => {
    return {
      availableForms: forms.map(f => ({
        id: f.id,
        name: f.name,
        description: f.description,
        fieldCount: f.fields.length,
        fields: f.fields.slice(0, 10) // Limit to first 10 fields to avoid prompt bloat
      })),
      existingWorkflows: workflows.map(w => ({
        id: w.id,
        name: w.name,
        status: w.status
      })),
      availableUsers: users.slice(0, 20), // Limit to 20 users
      availableGroups: groups,
      emailTemplates: emailTemplates.map(t => ({
        id: t.id,
        name: t.name
      })),
      schemaContext: generateSchemaPromptContext()
    };
  };
  
  /**
   * Get context for form generation
   */
  const getFormGenerationContext = () => {
    return {
      existingForms: forms.map(f => ({
        name: f.name,
        fieldTypes: [...new Set(f.fields.map(field => field.type))]
      })),
      schemaContext: generateSchemaPromptContext()
    };
  };
  
  /**
   * Get context for email template generation
   */
  const getEmailTemplateContext = (formId?: string) => {
    const form = formId ? forms.find(f => f.id === formId) : null;
    
    return {
      availableForms: forms.map(f => ({
        id: f.id,
        name: f.name,
        fields: f.fields.map(field => ({
          id: field.id,
          label: field.label,
          type: field.type
        }))
      })),
      selectedForm: form ? {
        id: form.id,
        name: form.name,
        fields: form.fields
      } : null,
      existingTemplates: emailTemplates.map(t => ({
        name: t.name,
        subject: t.subject
      }))
    };
  };
  
  /**
   * Get context for report/chart generation
   */
  const getReportContext = (formId?: string) => {
    const form = formId ? forms.find(f => f.id === formId) : null;
    
    return {
      availableForms: forms.map(f => ({
        id: f.id,
        name: f.name,
        fieldCount: f.fields.length
      })),
      selectedForm: form ? {
        id: form.id,
        name: form.name,
        fields: form.fields
      } : null,
      schemaContext: generateSchemaPromptContext()
    };
  };
  
  return {
    contextData,
    getFormContext,
    getWorkflowGenerationContext,
    getFormGenerationContext,
    getEmailTemplateContext,
    getReportContext,
    isLoading: false
  };
}

/**
 * Format context data for AI prompt injection
 */
export function formatContextForPrompt(context: Partial<AIContextData>): string {
  const sections: string[] = [];
  
  if (context.schemaContext) {
    sections.push(context.schemaContext);
  }
  
  if (context.forms && context.forms.length > 0) {
    sections.push(`
=== AVAILABLE FORMS IN THIS PROJECT ===
${context.forms.map(f => `
Form: "${f.name}" (ID: ${f.id})
${f.description ? `Description: ${f.description}` : ''}
Fields:
${f.fields.map(field => `  - ${field.label} (ID: ${field.id}, Type: ${field.type}${field.required ? ', Required' : ''})`).join('\n')}
`).join('\n')}
=== END FORMS ===
`);
  }
  
  if (context.workflows && context.workflows.length > 0) {
    sections.push(`
=== EXISTING WORKFLOWS ===
${context.workflows.map(w => `- "${w.name}" (ID: ${w.id}, Status: ${w.status})`).join('\n')}
=== END WORKFLOWS ===
`);
  }
  
  if (context.users && context.users.length > 0) {
    sections.push(`
=== AVAILABLE USERS ===
${context.users.map(u => `- ${u.name} (${u.email})`).join('\n')}
=== END USERS ===
`);
  }
  
  if (context.groups && context.groups.length > 0) {
    sections.push(`
=== AVAILABLE GROUPS ===
${context.groups.map(g => `- "${g.name}" (ID: ${g.id})`).join('\n')}
=== END GROUPS ===
`);
  }
  
  if (context.emailTemplates && context.emailTemplates.length > 0) {
    sections.push(`
=== EXISTING EMAIL TEMPLATES ===
${context.emailTemplates.map(t => `- "${t.name}": ${t.subject}`).join('\n')}
=== END EMAIL TEMPLATES ===
`);
  }
  
  if (context.slaTemplates && context.slaTemplates.length > 0) {
    sections.push(`
=== EXISTING SLA TEMPLATES ===
${context.slaTemplates.map(t => `- "${t.name}": Warning at ${t.warning_hours}h, Breach at ${t.breach_hours}h`).join('\n')}
=== END SLA TEMPLATES ===
`);
  }
  
  return sections.join('\n\n');
}
