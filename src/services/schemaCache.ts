
import { supabase } from '@/integrations/supabase/client';

export interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: any[];
}

export interface FormDefinition {
  id: string;
  name: string;
  fields: Record<string, FieldDefinition>;
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
      console.log('Refreshing schema cache...');
      
      // Fetch all forms - using existing columns
      const { data: forms, error: formsError } = await supabase
        .from('forms')
        .select('id, name, description');
      
      if (formsError) {
        console.error('Error fetching forms:', formsError);
        return;
      }
      
      const newCache: SchemaCache = {
        forms: {},
        lastUpdated: Date.now()
      };
      
      // Process each form
      for (const form of forms || []) {
        const fields: Record<string, FieldDefinition> = {};
        
        // For now, we'll create some basic field definitions
        // This should be replaced with actual form field data when available
        fields['submission_id'] = {
          id: 'submission_id',
          label: 'Submission ID',
          type: 'text',
          required: false
        };
        
        fields['submitted_at'] = {
          id: 'submitted_at',
          label: 'Submitted At',
          type: 'datetime',
          required: false
        };
        
        fields['submitted_by'] = {
          id: 'submitted_by',
          label: 'Submitted By',
          type: 'text',
          required: false
        };
        
        fields['approval_status'] = {
          id: 'approval_status',
          label: 'Approval Status',
          type: 'text',
          required: false
        };
        
        newCache.forms[form.id] = {
          id: form.id,
          name: form.name || 'Unnamed Form',
          fields
        };
      }
      
      this.cache = newCache;
      console.log(`Schema cache refreshed with ${Object.keys(newCache.forms).length} forms`);
      
    } catch (error) {
      console.error('Error refreshing schema cache:', error);
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
