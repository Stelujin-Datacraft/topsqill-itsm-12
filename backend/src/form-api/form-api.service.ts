import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FormApiService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listForms(opts?: { projectId?: string; status?: string; limit?: number }) {
    const supabase = this.supabaseService.getServiceClient();
    const limit = Math.min(500, Math.max(1, opts?.limit || 200));
    let query = supabase
      .from('forms')
      .select('id, name, description, reference_id, status, project_id, organization_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (opts?.projectId) query = query.eq('project_id', opts.projectId);
    if (opts?.status) query = query.eq('status', opts.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { data: data || [] };
  }

  async getForm(formId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let row: any = null;
    if (uuidRegex.test(formId)) {
      const { data, error } = await supabase.from('forms').select('*').eq('id', formId).maybeSingle();
      if (error) throw new Error(error.message);
      row = data;
    }
    if (!row) {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('reference_id', formId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      row = data;
    }
    if (!row) throw new NotFoundException('Form not found');
    return { data: row };
  }

  async getFormFields(formId: string) {
    const form = await this.getForm(formId);
    const resolvedId = form.data.id;
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_fields')
      .select('id, label, field_type, required, options, custom_config, field_order, form_id')
      .eq('form_id', resolvedId)
      .order('field_order', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    // Normalize to Integration Studio schema shape
    const fields = (data || []).map((f: any) => {
      const rawChoices = f.options;
      let choices: Array<{ label: string; value: string }> | undefined;
      if (Array.isArray(rawChoices)) {
        choices = rawChoices.map((c: any) => {
          if (c == null) return { label: '', value: '' };
          if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
            return { label: String(c), value: String(c) };
          }
          return {
            label: String(c.label ?? c.name ?? c.value ?? ''),
            value: String(c.value ?? c.id ?? c.label ?? c.name ?? ''),
          };
        }).filter((c: { label: string; value: string }) => c.label || c.value);
      } else if (rawChoices && typeof rawChoices === 'object' && Array.isArray(rawChoices.choices)) {
        choices = rawChoices.choices.map((c: any) => ({
          label: String(typeof c === 'object' ? (c.label ?? c.value ?? '') : c),
          value: String(typeof c === 'object' ? (c.value ?? c.label ?? '') : c),
        }));
      }
      return {
        id: f.id,
        name: f.label || f.id,
        label: f.label || f.id,
        type: f.field_type || 'text',
        required: Boolean(f.required),
        choices,
        field_order: f.field_order,
      };
    });
    return { data: fields };
  }

  async getFormSchema(formId: string) {
    const [form, fields] = await Promise.all([
      this.getForm(formId),
      this.getFormFields(formId),
    ]);
    return { form: form.data, fields: fields.data };
  }

  async listRecords(formId: string, limit = 50, offset = 0) {
    const form = await this.getForm(formId);
    const supabase = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(1000, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);
    const { data, count, error } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact' })
      .eq('form_id', form.data.id)
      .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw new Error(error.message);
    return { data, count };
  }

  async getRecord(formId: string, recordId: string) {
    const form = await this.getForm(formId);
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', form.data.id)
      .eq('id', recordId)
      .single();
    if (error) throw new NotFoundException('Record not found');
    return { data };
  }

  async createRecord(formId: string, body: Record<string, unknown>) {
    const form = await this.getForm(formId);
    const resolvedId = form.data.id;
    const supabase = this.supabaseService.getServiceClient();
    let payload = (body as any)?.data && typeof (body as any).data === 'object'
      ? { ...(body as any).data }
      : { ...(body || {}) };
    // Drop envelope keys if caller posted the whole body as data
    delete (payload as any).useLabels;
    delete (payload as any).validate;
    delete (payload as any).data;
    delete (payload as any).approval_status;

    // Integration Studio sends label/name keys — map to field IDs (same shape Form Builder stores)
    const useLabels = Boolean((body as any)?.useLabels) || Object.keys(payload).some(
      (k) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k),
    );
    if (useLabels && Object.keys(payload).length) {
      const { data: fields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('id, label')
        .eq('form_id', resolvedId);
      if (fieldsError) throw new Error(`Failed to load form fields: ${fieldsError.message}`);
      const byLabel = new Map<string, string>();
      for (const f of fields || []) {
        byLabel.set(String(f.label || '').toLowerCase(), f.id);
        byLabel.set(String(f.id), f.id);
      }
      const mapped: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload)) {
        const fieldId = byLabel.get(key.toLowerCase()) || byLabel.get(key) || key;
        mapped[fieldId] = value;
      }
      payload = mapped;
    }

    // Match Form Builder insert shape (no approval_status required)
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        form_id: resolvedId,
        submission_data: payload,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      throw new Error(`form_submissions insert failed: ${error.message}`);
    }
    return { data };
  }

  async updateRecord(formId: string, recordId: string, body: Record<string, unknown>) {
    const form = await this.getForm(formId);
    const supabase = this.supabaseService.getServiceClient();
    const payload = (body as any)?.data && typeof (body as any).data === 'object'
      ? (body as any).data
      : body;
    const { data, error } = await supabase
      .from('form_submissions')
      .update({ submission_data: payload })
      .eq('form_id', form.data.id)
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data };
  }

  async deleteRecord(formId: string, recordId: string) {
    const form = await this.getForm(formId);
    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase
      .from('form_submissions')
      .delete()
      .eq('form_id', form.data.id)
      .eq('id', recordId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
