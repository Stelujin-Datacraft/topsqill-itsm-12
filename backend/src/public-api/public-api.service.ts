import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PublicApiService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async validateApiKey(apiKey: string) {
    const supabase = this.supabaseService.getServiceClient();
    const keyHash = this.hashApiKey(apiKey);
    const { data, error } = await supabase.rpc('validate_api_key', { key_hash_param: keyHash });
    if (error || !data?.length) return null;
    return data[0];
  }

  async listForms(keyInfo: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase
      .from('forms')
      .select('id, name, reference_id, status, created_at')
      .eq('organization_id', keyInfo.organization_id)
      .limit(100);
    return { data };
  }

  async getForm(keyInfo: Record<string, unknown>, formId: string) {
    const supabase = this.supabaseService.getServiceClient();
    const isUuid = /^[0-9a-f-]{36}$/i.test(formId);
    const query = supabase.from('forms').select('*').eq('organization_id', keyInfo.organization_id);
    const { data } = await (isUuid ? query.eq('id', formId) : query.eq('reference_id', formId)).single();
    return { data };
  }

  async listSubmissions(keyInfo: Record<string, unknown>, formId?: string) {
    const supabase = this.supabaseService.getServiceClient();
    let query = supabase
      .from('form_submissions')
      .select('id, form_id, submission_data, submission_ref_id, created_at')
      .eq('organization_id', keyInfo.organization_id)
      .limit(100);
    if (formId) query = query.eq('form_id', formId);
    const { data } = await query;
    return { data };
  }

  async createSubmission(keyInfo: Record<string, unknown>, body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        form_id: body.form_id,
        submission_data: body.submission_data,
        organization_id: keyInfo.organization_id,
        submitted_by: keyInfo.created_by,
      })
      .select()
      .single();
    return { data, error: error?.message };
  }

  async listWorkflows(keyInfo: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase
      .from('workflows')
      .select('id, name, reference_id, status')
      .eq('organization_id', keyInfo.organization_id)
      .limit(100);
    return { data };
  }

  async listReports(keyInfo: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { data } = await supabase
      .from('reports')
      .select('id, name, reference_id, status')
      .eq('organization_id', keyInfo.organization_id)
      .limit(100);
    return { data };
  }
}
