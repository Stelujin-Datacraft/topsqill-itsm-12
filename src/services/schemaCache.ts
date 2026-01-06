
import { supabase } from '@/integrations/supabase/client';

export interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: any[];
  customConfig?: {
    weightage?: number;
    [key: string]: any;
  };
}

export interface SystemColumnDefinition {
  id: string;
  label: string;
  type: string;
  description?: string;
}

export interface FormDefinition {
  id: string;
  name: string;
  fields: Record<string, FieldDefinition>;
  systemColumns: Record<string, SystemColumnDefinition>;
}

export interface SchemaCache {
  forms: Record<string, FormDefinition>;
  lastUpdated: number;
}

class SchemaCacheService {
  private cache: SchemaCache = {
    forms: {},
    lastUpdated: 0
  };
  
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // System columns available for all forms
  private getSystemColumns(): Record<string, SystemColumnDefinition> {
    return {
      'submission_id': {
        id: 'submission_id',
        label: 'Submission ID',
        type: 'text',
        description: 'Unique identifier for the submission'
      },
      'submitted_by': {
        id: 'submitted_by',
        label: 'Submitted By',
        type: 'text',
        description: 'User who submitted the form'
      },
      'submitted_at': {
        id: 'submitted_at',
        label: 'Submitted At',
        type: 'datetime',
        description: 'Date and time of submission'
      },
      'approval_status': {
        id: 'approval_status',
        label: 'Approval Status',
        type: 'text',
        description: 'Current approval status'
      },
      'approved_by': {
        id: 'approved_by',
        label: 'Approved By',
        type: 'text',
        description: 'User who approved the submission'
      },
      'approved_at': {
        id: 'approved_at',
        label: 'Approved At',
        type: 'datetime',
        description: 'Date and time of approval'
      },
      'form_id': {
        id: 'form_id',
        label: 'Form ID',
        type: 'text',
        description: 'ID of the form'
      }
    };
  }

  async getCache(): Promise<SchemaCache> {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (now - this.cache.lastUpdated < this.cacheTimeout && Object.keys(this.cache.forms).length > 0) {
      return this.cache;
    }
    
    // Refresh cache
    await this.refreshCache();
    return this.cache;
  }

  async refreshCache(): Promise<void> {
    try {
      // Fetch all forms with their fields (exclude deleted forms)
      const { data: forms, error: formsError } = await supabase
        .from('forms')
        .select(`
          id, 
          name, 
          description,
          status,
          form_fields (
            id,
            label,
            field_type,
            required,
            options,
            custom_config
          )
        `)
        .neq('status', 'deleted');
      
      if (formsError) {
        return;
      }
      
      const newCache: SchemaCache = {
        forms: {},
        lastUpdated: Date.now()
      };
      
      // Process each form
      for (const form of forms || []) {
        const fields: Record<string, FieldDefinition> = {};
        
        // Process form fields from the database
        if (form.form_fields && Array.isArray(form.form_fields)) {
          for (const field of form.form_fields) {
            // Parse customConfig if it's present
            let customConfig: any = { weightage: 1 };
            if (field.custom_config) {
              if (typeof field.custom_config === 'object' && !Array.isArray(field.custom_config)) {
                customConfig = field.custom_config;
              } else if (typeof field.custom_config === 'string') {
                try {
                  customConfig = JSON.parse(field.custom_config);
                } catch {
                  customConfig = { weightage: 1 };
                }
              }
            }
            
            fields[field.id] = {
              id: field.id,
              label: field.label || 'Untitled Field',
              type: field.field_type || 'text',
              required: field.required || false,
              options: Array.isArray(field.options) ? field.options : [],
              customConfig: customConfig
            };
          }
        }
        
        newCache.forms[form.id] = {
          id: form.id,
          name: form.name || 'Unnamed Form',
          fields,
          systemColumns: this.getSystemColumns()
        };
      }
      
      this.cache = newCache;
      
    } catch (error) {
      // Error refreshing schema cache
    }
  }

  async getFormDefinition(formId: string): Promise<FormDefinition | null> {
    const cache = await this.getCache();
    return cache.forms[formId] || null;
  }

  async getFieldDefinition(formId: string, fieldId: string): Promise<FieldDefinition | null> {
    const form = await this.getFormDefinition(formId);
    return form?.fields[fieldId] || null;
  }

  invalidateCache(): void {
    this.cache = {
      forms: {},
      lastUpdated: 0
    };
  }
}

export const schemaCache = new SchemaCacheService();
