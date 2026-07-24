import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async deleteUser(userId: string) {
    const supabaseAdmin = this.supabaseService.getServiceClient();

    const [profileResult, securityResult] = await Promise.all([
      supabaseAdmin.from('user_profiles').delete().eq('id', userId),
      supabaseAdmin.from('user_security_parameters').delete().eq('user_id', userId),
    ]);

    if (profileResult.error) console.error('Error deleting profile:', profileResult.error);
    if (securityResult.error) console.error('Error deleting security params:', securityResult.error);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Failed to delete user: ${authError.message}`);

    return { success: true, message: 'User deleted successfully' };
  }

  async adminChangePassword(userId: string, newPassword: string) {
    const supabaseAdmin = this.supabaseService.getServiceClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  }

  async sendPasswordReset(email: string, redirectUrl?: string, origin?: string) {
    const supabase = this.supabaseService.getServiceClient();

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, first_name, organization_id')
      .eq('email', email)
      .maybeSingle();

    if (!userProfile) {
      return { success: true, message: 'If your email exists, you will receive a reset link' };
    }

    const fallbackOrigin = 'https://topsqill-itsm-12.lovable.app';
    const baseRedirectUrl = redirectUrl || `${fallbackOrigin}/change-password`;
    const parsedRedirectUrl = new URL(baseRedirectUrl, origin || fallbackOrigin);
    parsedRedirectUrl.pathname = '/change-password';
    parsedRedirectUrl.searchParams.set('mode', 'reset');
    const finalRedirectUrl = parsedRedirectUrl.toString();

    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: finalRedirectUrl },
    });

    if (resetError) throw new Error('Failed to generate reset link');

    const resetLink = resetData?.properties?.action_link;
    if (!resetLink) throw new Error('Failed to generate reset link');

    const userName = userProfile.first_name || 'User';
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Password Reset</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;"><tr><td style="padding:40px 30px;text-align:center;background-color:#1a1a2e;"><h1 style="color:#ffffff;margin:0;font-size:24px;">Password Reset Request</h1></td></tr><tr><td style="padding:40px 30px;"><h2 style="color:#333333;margin:0 0 20px;">Hello ${userName},</h2><p style="color:#666666;font-size:16px;line-height:1.5;margin:0 0 20px;">We received a request to reset your password. Use the reset code below:</p><div style="text-align:center;margin:0 0 20px;background-color:#f4f4f4;padding:20px;border-radius:8px;"><code style="font-size:18px;word-break:break-all;color:#1a1a2e;">${resetLink}</code></div><p style="color:#666666;font-size:14px;"><strong>This code will expire in 24 hours.</strong></p></td></tr></table></body></html>`;

    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Reset Your Password - TopSqill',
      text: `Hello ${userName},\n\nUse this reset link:\n\n${resetLink}\n\nThis code will expire in 24 hours.`,
      html: htmlContent,
      organizationId: userProfile.organization_id,
    });

    await supabase.from('audit_logs').insert({
      user_id: userProfile.id,
      event_type: 'password_reset_requested',
      event_category: 'security',
      description: `Password reset email ${emailSent ? 'sent' : 'requested but email failed'}`,
    });

    return { success: true, message: 'If your email exists, you will receive a reset link', emailSent };
  }
}
