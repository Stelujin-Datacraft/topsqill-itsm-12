import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PoliciesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreview(policyId: string) {
    const supabase = this.supabaseService.getServiceClient();

    const { data: policy } = await supabase
      .from('policies')
      .select('*, policy_versions(*)')
      .eq('id', policyId)
      .single();

    if (!policy) throw new NotFoundException('Policy not found');

    const latestVersion = policy.policy_versions?.sort(
      (a: { version_number: number }, b: { version_number: number }) => b.version_number - a.version_number,
    )?.[0];

    return {
      policy,
      version: latestVersion,
      previewUrl: latestVersion?.document_url || null,
    };
  }

  async sendReviewReminders() {
    const supabase = this.supabaseService.getServiceClient();
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: policies } = await supabase
      .from('policies')
      .select('*')
      .lte('next_review_date', weekFromNow.toISOString())
      .eq('status', 'published');

    const reminded: string[] = [];
    for (const policy of policies || []) {
      if (policy.owner_id) {
        await supabase.from('notifications').insert({
          user_id: policy.owner_id,
          type: 'policy_review_due',
          title: 'Policy Review Due',
          message: `Policy "${policy.title}" is due for review.`,
          data: { policy_id: policy.id },
        });
        reminded.push(policy.id);
      }
    }

    return { success: true, reminded: reminded.length };
  }
}
