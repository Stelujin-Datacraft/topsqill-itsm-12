import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async sendCode(email: string, userId: string) {
    const supabase = this.supabaseService.getServiceClient();

    const { data: securityParams } = await supabase
      .from('user_security_parameters')
      .select('mfa_pin_expiry_minutes, mfa_max_attempts, organization_id')
      .eq('user_id', userId)
      .maybeSingle();

    const expiryMinutes = securityParams?.mfa_pin_expiry_minutes || 5;
    const maxAttempts = securityParams?.mfa_max_attempts || 3;
    const organizationId = securityParams?.organization_id;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    await supabase
      .from('mfa_codes')
      .delete()
      .eq('user_id', userId)
      .is('verified_at', null);

    const { error: insertError } = await supabase.from('mfa_codes').insert({
      user_id: userId,
      code,
      method: 'email',
      max_attempts: maxAttempts,
      expires_at: expiresAt,
    });

    if (insertError) {
      throw new Error('Failed to generate MFA code');
    }

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verification Code</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;"><tr><td style="padding:40px 30px;text-align:center;background-color:#1a1a2e;"><h1 style="color:#ffffff;margin:0;font-size:24px;">Security Verification</h1></td></tr><tr><td style="padding:40px 30px;"><h2 style="color:#333333;margin:0 0 20px;">Your Verification Code</h2><p style="color:#666666;font-size:16px;line-height:1.5;margin:0 0 30px;">Use the following code to complete your login:</p><div style="background-color:#f8f9fa;padding:25px;border-radius:8px;text-align:center;margin:0 0 30px;"><span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1a1a2e;">${code}</span></div><p style="color:#666666;font-size:14px;margin:0 0 10px;"><strong>This code will expire in ${expiryMinutes} minutes.</strong></p><p style="color:#999999;font-size:14px;margin:0;">If you didn't request this code, please ignore this email or contact support if you have concerns.</p></td></tr><tr><td style="padding:30px;background-color:#f8f9fa;text-align:center;border-top:1px solid #eeeeee;"><p style="color:#999999;font-size:12px;margin:0;">This is an automated message from TopSqill Security.<br>Please do not reply to this email.</p></td></tr></table></body></html>`;

    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Your Verification Code - TopSqill Security',
      text: `Your verification code is: ${code}\n\nThis code will expire in ${expiryMinutes} minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: htmlContent,
      organizationId,
    });

    return { success: true, expiresAt, expiryMinutes, maxAttempts, emailSent };
  }

  async verifyCode(userId: string, code: string) {
    const supabase = this.supabaseService.getServiceClient();

    const { data: mfaCode, error: fetchError } = await supabase
      .from('mfa_codes')
      .select('*')
      .eq('user_id', userId)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new Error('Failed to verify code');

    if (!mfaCode) {
      return { success: false, error: 'No valid verification code found. Please request a new code.' };
    }

    if (mfaCode.attempts >= mfaCode.max_attempts) {
      await supabase.from('mfa_codes').delete().eq('id', mfaCode.id);
      return { success: false, error: 'Maximum attempts exceeded. Please request a new code.', attemptsExceeded: true };
    }

    await supabase
      .from('mfa_codes')
      .update({ attempts: mfaCode.attempts + 1 })
      .eq('id', mfaCode.id);

    if (mfaCode.code !== code) {
      const remainingAttempts = mfaCode.max_attempts - (mfaCode.attempts + 1);
      return {
        success: false,
        error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        remainingAttempts,
      };
    }

    await supabase
      .from('mfa_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', mfaCode.id);

    return { success: true };
  }
}
