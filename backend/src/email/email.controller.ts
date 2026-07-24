import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('test-smtp-connection')
  async testSmtpConnection(@Body() body: { configId: string }) {
    const supabase = this.supabaseService.getServiceClient();
    const { data: config, error } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('id', body.configId)
      .single();

    if (error || !config) {
      return { success: false, error: 'SMTP configuration not found' };
    }

    const sent = await this.emailService.sendEmail({
      to: config.from_email,
      subject: 'SMTP Test - TopSqill',
      text: 'This is a test email to verify your SMTP configuration.',
      html: '<p>This is a test email to verify your SMTP configuration.</p>',
      smtpConfig: config,
    });

    return { success: sent, message: sent ? 'Test email sent successfully' : 'Failed to send test email' };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-template')
  async sendTemplateEmail(@Body() body: Record<string, unknown>) {
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
      const sent = await this.emailService.sendEmail({
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

  @UseGuards(SupabaseAuthGuard)
  @Post('send-delegation')
  async sendDelegationEmail(@Body() body: Record<string, unknown>) {
    const { recipientEmail, delegatorName, delegateName, formName, action, organizationId } = body as {
      recipientEmail: string;
      delegatorName: string;
      delegateName: string;
      formName: string;
      action: string;
      organizationId?: string;
    };

    const subject = action === 'revoked'
      ? `Delegation Revoked - ${formName}`
      : `New Delegation - ${formName}`;

    const text = action === 'revoked'
      ? `${delegatorName} has revoked your delegation access for ${formName}.`
      : `${delegatorName} has delegated access to ${formName} to ${delegateName}.`;

    const sent = await this.emailService.sendEmail({
      to: recipientEmail,
      subject,
      text,
      organizationId,
    });

    return { success: sent };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('send-kb-notification')
  async sendKbNotification(@Body() body: Record<string, unknown>) {
    const { recipientEmail, subject, message, organizationId } = body as {
      recipientEmail: string;
      subject: string;
      message: string;
      organizationId?: string;
    };

    const sent = await this.emailService.sendEmail({
      to: recipientEmail,
      subject,
      text: message,
      organizationId,
    });

    return { success: sent };
  }
}
