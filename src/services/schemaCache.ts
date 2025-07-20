
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
      
      // Fetch all forms
      const { data: forms, error: formsError } = await supabase
        .from('forms')
        .select('id, name, form_structure');
      
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
        
        try {
          const formStructure = typeof form.form_structure === 'string' 
            ? JSON.parse(form.form_structure)
            : form.form_structure;
          
          // Extract field definitions from form structure
          if (formStructure && Array.isArray(formStructure.fields)) {
            for (const field of formStructure.fields) {
              fields[field.id] = {
                id: field.id,
                label: field.label || field.id,
                type: field.type || 'text',
                required: field.required || false,
                options: field.options || []
              };
            }
          }
        } catch (parseError) {
          console.warn(`Error parsing form structure for form ${form.id}:`, parseError);
        }
        
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
