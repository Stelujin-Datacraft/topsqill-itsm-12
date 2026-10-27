import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { SupabaseService } from '../supabase/supabase.service';
import { isReLeadgenEnabled } from './re-access';

type LeadRow = {
  id: string;
  organization_id: string;
  source?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

@Injectable()
export class ReFollowupService {
  private readonly logger = new Logger(ReFollowupService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  private client() {
    return this.supabaseService.getServiceClient();
  }

  async listRules(organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    const { data, error } = await this.client()
      .from('re_follow_up_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return { rules: data ?? [] };
  }

  async upsertRule(
    organizationId: string,
    body: {
      id?: string;
      enabled?: boolean;
      name?: string;
      delayMinutes?: number;
      subjectTemplate?: string;
      bodyTemplate?: string;
      onlySources?: string[] | null;
    },
  ) {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    const row = {
      organization_id: organizationId,
      enabled: body.enabled ?? true,
      name: body.name || 'First-touch email',
      delay_minutes: body.delayMinutes ?? 15,
      channel: 'email',
      subject_template:
        body.subjectTemplate ||
        'Thanks for your interest, {{contact_name}}',
      body_template:
        body.bodyTemplate ||
        'Hi {{contact_name}},\n\nThanks for reaching out. Our team will contact you shortly.\n\n— {{org_name}}',
      only_sources: body.onlySources ?? null,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { data, error } = await this.client()
        .from('re_follow_up_rules')
        .update(row)
        .eq('id', body.id)
        .eq('organization_id', organizationId)
        .select('*')
        .single();
      if (error) throw new BadRequestException(error.message);
      return { rule: data };
    }

    const { data, error } = await this.client()
      .from('re_follow_up_rules')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { rule: data };
  }

  async scheduleForLead(organizationId: string, lead: LeadRow) {
    if (!isReLeadgenEnabled()) return { scheduled: 0 };
    const { data: rules, error } = await this.client()
      .from('re_follow_up_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('enabled', true);
    if (error || !rules?.length) return { scheduled: 0 };

    let scheduled = 0;
    for (const rule of rules) {
      if (Array.isArray(rule.only_sources) && rule.only_sources.length) {
        if (!rule.only_sources.includes(String(lead.source || ''))) continue;
      }
      if (rule.channel !== 'email') continue;
      if (!lead.contact_email) continue;

      const runAt = new Date(Date.now() + Math.max(0, Number(rule.delay_minutes) || 0) * 60_000);
      const { error: jobErr } = await this.client().from('re_follow_up_jobs').insert({
        organization_id: organizationId,
        lead_id: lead.id,
        rule_id: rule.id,
        channel: 'email',
        run_at: runAt.toISOString(),
        status: 'pending',
        payload: {
          to: lead.contact_email,
          subject_template: rule.subject_template,
          body_template: rule.body_template,
          contact_name: lead.contact_name,
          contact_phone: lead.contact_phone,
          source: lead.source,
        },
      });
      if (!jobErr) scheduled += 1;
    }
    return { scheduled };
  }

  private render(template: string, vars: Record<string, string>) {
    let out = template || '';
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
    return out;
  }

  async processDueJobs(limit = 25) {
    if (!isReLeadgenEnabled()) return { processed: 0, sent: 0, failed: 0 };
    const client = this.client();
    const { data: jobs, error } = await client
      .from('re_follow_up_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error || !jobs?.length) return { processed: 0, sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    for (const job of jobs) {
      try {
        const { data: org } = await client
          .from('organizations')
          .select('name')
          .eq('id', job.organization_id)
          .maybeSingle();
        const payload = (job.payload || {}) as Record<string, string>;
        const vars = {
          contact_name: payload.contact_name || 'there',
          contact_phone: payload.contact_phone || '',
          org_name: org?.name || 'our team',
          source: payload.source || '',
        };
        const to = payload.to;
        if (!to) {
          await client
            .from('re_follow_up_jobs')
            .update({ status: 'skipped', last_error: 'No email', updated_at: new Date().toISOString() })
            .eq('id', job.id);
          continue;
        }
        const subject = this.render(payload.subject_template || 'Following up', vars);
        const text = this.render(payload.body_template || '', vars);
        const ok = await this.emailService.sendEmail({
          to,
          subject,
          text,
          html: text.replace(/\n/g, '<br/>'),
          organizationId: job.organization_id,
        });
        if (!ok) {
          failed += 1;
          await client
            .from('re_follow_up_jobs')
            .update({
              status: 'failed',
              attempt_count: (job.attempt_count || 0) + 1,
              last_error: 'SMTP send failed or no SMTP config',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
          continue;
        }
        sent += 1;
        await client
          .from('re_follow_up_jobs')
          .update({
            status: 'sent',
            attempt_count: (job.attempt_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        await client.from('re_lead_activities').insert({
          organization_id: job.organization_id,
          lead_id: job.lead_id,
          activity_type: 'email',
          body: `Follow-up email sent: ${subject}`,
          metadata: { job_id: job.id, channel: 'email' },
        });
      } catch (err) {
        failed += 1;
        this.logger.error(`Follow-up job ${job.id} failed`, err);
        await client
          .from('re_follow_up_jobs')
          .update({
            status: 'failed',
            attempt_count: (job.attempt_count || 0) + 1,
            last_error: err instanceof Error ? err.message : 'unknown',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }
    return { processed: jobs.length, sent, failed };
  }

  async listJobs(organizationId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { data, error } = await this.client()
      .from('re_follow_up_jobs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new BadRequestException(error.message);
    return { jobs: data ?? [] };
  }
}
