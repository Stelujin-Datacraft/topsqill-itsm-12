import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FormApiService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listForms() {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase.from('forms').select('id, name, reference_id, status').limit(100);
    return { data };
  }

  async getForm(formId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase.from('forms').select('*').eq('id', formId).single();
    if (error) throw new NotFoundException('Form not found');
    return { data };
  }

  async getFormFields(formId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('display_order')
      .limit(500);
    return { data };
  }

  async getFormSchema(formId: string) {
    const [form, fields] = await Promise.all([
      this.getForm(formId),
      this.getFormFields(formId),
    ]);
    return { form: form.data, fields: fields.data };
  }

  async listRecords(formId: string, limit = 50, offset = 0) {
    const supabase = this.supabaseService.getServiceClient();
    const safeLimit = Math.min(1000, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);
    const { data, count } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact' })
      .eq('form_id', formId)
      .range(safeOffset, safeOffset + safeLimit - 1);
    return { data, count };
  }

  async getRecord(formId: string, recordId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .eq('id', recordId)
      .single();
    if (error) throw new NotFoundException('Record not found');
    return { data };
  }

  async createRecord(formId: string, body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({ form_id: formId, submission_data: body })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data };
  }

  async updateRecord(formId: string, recordId: string, body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .update({ submission_data: body })
      .eq('form_id', formId)
      .eq('id', recordId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { data };
  }

  async deleteRecord(formId: string, recordId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const { error } = await supabase
      .from('form_submissions')
      .delete()
      .eq('form_id', formId)
      .eq('id', recordId);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
