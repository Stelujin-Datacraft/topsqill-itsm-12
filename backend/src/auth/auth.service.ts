import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async acceptInvitation(token: string) {
    const supabaseAdmin = this.supabaseService.getServiceClient();

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('organization_requests')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return { success: false, error: 'Invitation not found, already used, or expired', code: 'INVITATION_NOT_FOUND' };
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: 'This invitation has expired.', code: 'INVITATION_EXPIRED' };
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === invitation.email.toLowerCase(),
    );

    if (existingUser) {
      await supabaseAdmin.from('organization_requests').delete().eq('id', invitation.id);
      return { success: true, message: 'Your account already exists. Please log in.', email: invitation.email, alreadyExists: true };
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password: invitation.temp_password || `Temp${Math.random().toString(36).slice(2)}!`,
      email_confirm: true,
      user_metadata: {
        first_name: invitation.first_name,
        last_name: invitation.last_name,
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    await supabaseAdmin.from('user_profiles').insert({
      id: authUser.user.id,
      email: invitation.email,
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      organization_id: invitation.organization_id,
      role: invitation.role || 'user',
      status: 'active',
    });

    await supabaseAdmin
      .from('organization_requests')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return { success: true, email: invitation.email, message: 'Account created successfully. You can now log in.' };
  }

  async sendWelcomeEmail(body: Record<string, unknown>) {
    const {
      email, firstName, lastName, organizationName, organizationId,
      role, password, mobile, gender, timezone, nationality, status,
    } = body as Record<string, string>;

    if (!email || !firstName || !lastName || !organizationId) {
      throw new Error('Missing required fields: email, firstName, lastName, organizationId');
    }

    const supabaseAdmin = this.supabaseService.getServiceClient();
    const generatedPassword = password || `Temp${Math.random().toString(36).slice(2, 10)}!`;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError) throw new Error(authError.message);

    await supabaseAdmin.from('user_profiles').insert({
      id: authUser.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      role: role || 'user',
      status: status || 'active',
      mobile,
      gender,
      timezone,
      nationality,
    });

    const loginUrl = 'https://topsqill-itsm-12.lovable.app/auth';
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: `Welcome to ${organizationName || 'TopSqill'}!`,
      text: `Hi ${firstName},\n\nYour account has been created.\nEmail: ${email}\nPassword: ${generatedPassword}\n\nLogin: ${loginUrl}`,
      organizationId,
    });

    return { success: true, userId: authUser.user.id, emailSent, password: generatedPassword };
  }

  async sendUserInvitation(body: Record<string, unknown>) {
    const supabaseAdmin = this.supabaseService.getServiceClient();
    const {
      email, firstName, lastName, organizationId, organizationName, role, invitedBy,
    } = body as Record<string, string>;

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin.from('organization_requests').insert({
      email,
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      role: role || 'user',
      invitation_token: token,
      status: 'pending',
      expires_at: expiresAt,
      invited_by: invitedBy,
    });

    if (error) throw new Error(error.message);

    const inviteUrl = `https://topsqill-itsm-12.lovable.app/accept-invitation?token=${token}`;
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: `Invitation to join ${organizationName || 'TopSqill'}`,
      text: `Hi ${firstName},\n\nYou've been invited to join ${organizationName}.\n\nAccept your invitation: ${inviteUrl}`,
      organizationId,
    });

    return { success: true, token, emailSent };
  }
}
