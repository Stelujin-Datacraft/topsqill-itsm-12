import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SupabaseService } from '../supabase/supabase.service';

export interface SmtpConfig {
  host: string;
  port: number;
  use_tls: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name?: string;
  name?: string;
}

@Injectable()
export class EmailService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getSmtpConfig(organizationId?: string): Promise<SmtpConfig | null> {
    const supabase = this.supabaseService.getServiceClient();

    if (organizationId) {
      const { data: configs } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (configs && configs.length > 0) {
        return configs.find((c) => c.host.includes('hostinger')) || configs[0];
      }
    }

    const { data: defaultConfigs } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('is_active', true)
      .eq('is_default', true)
      .limit(1);

    return defaultConfigs?.[0] || null;
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    organizationId?: string;
    smtpConfig?: SmtpConfig;
  }): Promise<boolean> {
    const smtpConfig = options.smtpConfig || await this.getSmtpConfig(options.organizationId);
    if (!smtpConfig) {
      console.log('No active SMTP configuration found');
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.use_tls,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password,
        },
      });

      await transporter.sendMail({
        from: smtpConfig.from_name
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
          : smtpConfig.from_email,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return true;
    } catch (error) {
      console.error('Error sending email via SMTP:', error);
      return false;
    }
  }

  async sendTemplateEmail(body: Record<string, unknown>) {
    const supabase = this.supabaseService.getServiceClient();
    const { templateId, data, recipients, organizationId } = body as {
      templateId: string;
      data: Record<string, unknown>;
      recipients: string[];
      organizationId?: string;
    };

    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      return { success: false, error: 'Template not found' };
    }

    let subject = template.subject || 'Notification';
    let bodyHtml = template.body_html || template.body || '';
    let bodyText = template.body_text || template.body || '';

    for (const [key, value] of Object.entries(data || {})) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(placeholder, String(value));
      bodyHtml = bodyHtml.replace(placeholder, String(value));
      bodyText = bodyText.replace(placeholder, String(value));
    }

    const results: { recipient: string; sent: boolean }[] = [];
    for (const recipient of recipients || []) {
      const sent = await this.sendEmail({
        to: recipient,
        subject,
        text: bodyText,
        html: bodyHtml,
        organizationId,
      });
      results.push({ recipient, sent });
    }

    return { success: true, results };
  }
}
