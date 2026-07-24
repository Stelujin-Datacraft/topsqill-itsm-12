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
}
