// @ts-nocheck
/**
 * Admin creates a user in their organization (auth + user_profiles) and optionally
 * emails temporary credentials. Ported from Edge — must return plain objects for Nest.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';

function generateWelcomeEmailHtml(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
  loginUrl: string;
}) {
  const { firstName, lastName, email, password, organizationName, loginUrl } = params;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to ${organizationName}</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fa;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Welcome to ${organizationName}!</h1><p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Your account has been created successfully</p></td></tr><tr><td style="padding:30px;"><p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.5;">Hi <strong>${firstName} ${lastName}</strong>,</p><p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.5;">We're excited to have you on board! Below are your login credentials:</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td style="background-color:#f8f9fc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 0;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${email}</p></td></tr><tr><td style="padding:12px 0 6px;border-top:1px dashed #e2e8f0;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</span><p style="margin:4px 0 0;"><code style="background-color:#fef3c7;color:#92400e;padding:6px 12px;border-radius:4px;font-size:14px;font-weight:600;display:inline-block;">${password}</code></p></td></tr></table></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:15px 0;"><tr><td style="background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:0 6px 6px 0;padding:10px 15px;"><p style="margin:0;color:#991b1b;font-size:13px;"><strong>Security:</strong> Please change your password after first login.</p></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td align="center"><a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:600;">Login to Your Account</a></td></tr></table><p style="margin:15px 0 0;color:#333;font-size:14px;">Best regards,<br><strong>The ${organizationName} Team</strong></p></td></tr><tr><td style="background-color:#f8f9fc;padding:12px 20px;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.4;">${organizationName} | &copy; ${year} All rights reserved</p></td></tr></table></td></tr></table></body></html>`;
}

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < 16; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

/** user_profiles.password was dropped — never write it. Auth password stays in auth.users only. */
function buildProfileFields(input: {
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  role?: string;
  status?: string;
  nationality?: string;
  mobile?: string;
  gender?: string;
  timezone?: string;
}) {
  const row: Record<string, unknown> = {
    email: String(input.email).trim().toLowerCase(),
    first_name: input.firstName,
    last_name: input.lastName,
    organization_id: input.organizationId,
    role: input.role || 'user',
    status: input.status || 'active',
  };
  if (input.nationality) row.nationality = input.nationality;
  if (input.mobile) row.mobile = input.mobile;
  if (input.gender) row.gender = input.gender;
  if (input.timezone) row.timezone = input.timezone;
  return row;
}

async function findAuthUserByEmail(supabaseAdmin: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  // Prefer dedicated API when available
  try {
    if (typeof (supabaseAdmin.auth.admin as any).getUserByEmail === 'function') {
      const { data, error } = await (supabaseAdmin.auth.admin as any).getUserByEmail(normalized);
      if (!error && data?.user) return data.user;
    }
  } catch {
    // fall through
  }
  // Fallback: scan pages (admin create is rare; keep bounded)
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to check existing users: ${error.message}`);
    const found = data?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

export async function sendWelcomeEmail(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {
  try {
    const requestBody = body as any;
    const {
      email,
      firstName,
      lastName,
      organizationName,
      organizationId: requestedOrgId,
      role,
      nationality,
      password,
      mobile,
      gender,
      timezone,
      securityTemplateId,
      status,
      _actorId,
      actorId,
    } = requestBody;

    if (!email || !firstName || !lastName) {
      return {
        success: false,
        error: 'Missing required fields: email, firstName, lastName',
        emailSent: false,
      };
    }

    const supabaseAdmin = supabase;
    const callerId = _actorId || actorId || null;

    // Admin-only + force caller organization (client cannot create users in another org)
    let organizationId = requestedOrgId as string | undefined;
    if (callerId) {
      const { data: actor, error: actorErr } = await supabaseAdmin
        .from('user_profiles')
        .select('id, role, organization_id')
        .eq('id', callerId)
        .maybeSingle();
      if (actorErr) {
        return { success: false, error: `Failed to verify admin: ${actorErr.message}`, emailSent: false };
      }
      if (!actor || actor.role !== 'admin') {
        return { success: false, error: 'Only organization administrators can create users', emailSent: false };
      }
      if (!actor.organization_id) {
        return { success: false, error: 'Administrator has no organization', emailSent: false };
      }
      organizationId = actor.organization_id;
    }

    if (!organizationId) {
      return { success: false, error: 'Missing required field: organizationId', emailSent: false };
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Already in this org?
    const { data: existingInOrg } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, organization_id')
      .ilike('email', normalizedEmail)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (existingInOrg) {
      return {
        success: false,
        error: `A user with email ${normalizedEmail} already exists in this organization.`,
        emailSent: false,
      };
    }

    const profileFields = buildProfileFields({
      firstName,
      lastName,
      email: normalizedEmail,
      organizationId,
      role,
      status,
      nationality,
      mobile,
      gender,
      timezone,
    });

    const existingAuth = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
    let userId: string;

    if (existingAuth?.id) {
      userId = existingAuth.id;
      const { data: profileData, error: profileCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, organization_id')
        .eq('id', userId)
        .maybeSingle();
      if (profileCheckError) {
        return {
          success: false,
          error: `Failed to check user profile: ${profileCheckError.message}`,
          emailSent: false,
        };
      }
      if (profileData) {
        // Profile in another org — do not steal
        if (profileData.organization_id && profileData.organization_id !== organizationId) {
          return {
            success: false,
            error: 'A user with this email already exists in another organization.',
            emailSent: false,
          };
        }
        const { error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ ...profileFields, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (updateError) {
          return {
            success: false,
            error: `Failed to update user profile: ${updateError.message}`,
            emailSent: false,
          };
        }
      } else {
        const { error: insertError } = await supabaseAdmin.from('user_profiles').insert({
          id: userId,
          ...profileFields,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (insertError) {
          return {
            success: false,
            error: `Failed to create user profile: ${insertError.message}`,
            emailSent: false,
          };
        }
      }

      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: String(password) });
      }

      return {
        success: true,
        message: 'User profile linked to existing auth account',
        userId,
        emailSent: false,
      };
    }

    const tempPassword = password ? String(password) : generatePassword();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        organization_id: organizationId,
        role: role || 'user',
      },
    });

    if (authError || !authUser?.user?.id) {
      return {
        success: false,
        error: `Failed to create user account: ${authError?.message || 'no user id'}`,
        emailSent: false,
      };
    }

    userId = authUser.user.id;

    const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
      id: userId,
      ...profileFields,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Failed to create user profile: ${profileError.message}`,
        emailSent: false,
      };
    }

    // Optional security params — never fail the create
    try {
      const securityParamsData: Record<string, unknown> = {
        user_id: userId,
        organization_id: organizationId,
      };
      if (securityTemplateId) {
        securityParamsData.security_template_id = securityTemplateId;
        securityParamsData.use_template_settings = true;
      }
      await supabaseAdmin.from('user_security_parameters').insert(securityParamsData);
    } catch (e) {
      console.warn('user_security_parameters insert skipped:', e);
    }

    // Welcome email in background (Nest-safe defer — not EdgeRuntime)
    ctx.defer(
      (async () => {
        try {
          const { data: smtpConfigs } = await supabaseAdmin
            .from('smtp_configs')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('is_default', { ascending: false });

          let smtpConfig = null;
          if (smtpConfigs?.length) {
            smtpConfig =
              smtpConfigs.find(
                (config) =>
                  config.host?.toLowerCase().includes('hostinger') ||
                  config.from_email?.toLowerCase().includes('topsqill.tech'),
              ) ||
              smtpConfigs.find((config) => !config.host?.toLowerCase().includes('sendgrid'));
          }
          if (!smtpConfig) return;

          const loginUrl = ctx.getEnv('APP_PUBLIC_URL') || 'https://bpm.topsqill.com';
          const emailHtml = generateWelcomeEmailHtml({
            firstName,
            lastName,
            email: normalizedEmail,
            password: tempPassword,
            organizationName: organizationName || 'TOPSQILL',
            loginUrl,
          });

          const client = new SMTPClient({
            connection: {
              hostname: smtpConfig.host,
              port: smtpConfig.port,
              tls: smtpConfig.use_tls,
              auth: {
                username: smtpConfig.username,
                password: smtpConfig.password,
              },
            },
          });

          await client.send({
            from: smtpConfig.from_name
              ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
              : smtpConfig.from_email,
            to: normalizedEmail,
            subject: `Welcome to ${organizationName || 'TOPSQILL'} - Your Account Details`,
            content: 'auto',
            html: emailHtml,
          });
          await client.close();
        } catch (err) {
          console.error('Welcome email background send failed:', err);
        }
      })(),
    );

    return {
      success: true,
      message: 'User created successfully. Welcome email will be sent shortly.',
      userId,
      emailSent: false,
      organizationId,
    };
  } catch (error: any) {
    console.error('sendWelcomeEmail error:', error);
    return {
      success: false,
      error: error?.message || 'Internal server error',
      emailSent: false,
    };
  }
}
