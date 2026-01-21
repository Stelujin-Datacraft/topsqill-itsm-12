import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
  organizationName: string;
  organizationId: string;
  inviterName: string;
  securityTemplateId?: string;
  mobile?: string;
  gender?: string;
  nationality?: string;
  timezone?: string;
}

function generateInvitationEmailHtml(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  expiresAt: string;
}) {
  const { firstName, lastName, email, password, role, organizationName, inviterName, acceptUrl, expiresAt } = params;
  const year = new Date().getFullYear();
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>You're Invited to ${organizationName}</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fa;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎉 You're Invited!</h1><p style="margin:12px 0 0;color:rgba(255,255,255,0.9);font-size:16px;">Join ${organizationName} on Topsqill</p></td></tr><tr><td style="padding:30px;"><p style="margin:0 0 15px;color:#333;font-size:16px;line-height:1.6;">Hi <strong>${firstName} ${lastName}</strong>,</p><p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;"><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong style="color:#667eea;">${role}</strong>.</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:25px 0;"><tr><td style="background:linear-gradient(135deg,#f8f9fc 0%,#e8ebf4 100%);border:1px solid #e2e8f0;border-radius:12px;padding:25px;"><h3 style="margin:0 0 15px;color:#1e293b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Login Credentials</h3><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</span><p style="margin:4px 0 0;color:#1e293b;font-size:15px;font-weight:600;">${email}</p></td></tr><tr><td style="padding:12px 0 8px;border-top:1px dashed #cbd5e1;"><span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Password</span><p style="margin:4px 0 0;"><code style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);color:#92400e;padding:8px 16px;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;letter-spacing:0.5px;">${password}</code></p></td></tr></table></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:25px 0;"><tr><td align="center"><a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:700;box-shadow:0 4px 14px rgba(34,197,94,0.4);letter-spacing:0.5px;">✓ Accept Invitation</a></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:12px 16px;"><p style="margin:0;color:#991b1b;font-size:13px;"><strong>🔐 Security Notice:</strong> Please change your password after your first login.</p></td></tr></table><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;"><p style="margin:0;color:#92400e;font-size:13px;"><strong>⏰ Expires:</strong> This invitation will expire on ${expiryDate}.</p></td></tr></table><p style="margin:25px 0 0;color:#333;font-size:14px;line-height:1.6;">If you didn't expect this invitation, you can safely ignore this email.</p><p style="margin:20px 0 0;color:#333;font-size:14px;">Best regards,<br><strong>The ${organizationName} Team</strong></p></td></tr><tr><td style="background-color:#f8f9fc;padding:16px 20px;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">Topsqill ITSM Platform | ${organizationName}<br>&copy; ${year} All rights reserved</p></td></tr></table></td></tr></table></body></html>`;
}

serve(async (req) => {
  console.log('🚀 Send User Invitation - Started');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody: InvitationRequest = await req.json();
    console.log('📋 Request data:', JSON.stringify({ ...requestBody, password: '[REDACTED]' }, null, 2));

    const { 
      email, firstName, lastName, role, password, 
      organizationName, organizationId, inviterName,
      securityTemplateId, mobile, gender, nationality, timezone 
    } = requestBody;

    // Validate required fields
    if (!email || !firstName || !lastName || !password || !organizationId) {
      throw new Error('Missing required fields: email, firstName, lastName, password, organizationId');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already exists
    const { data: existingProfile } = await supabaseClient
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A user with this email already exists in the organization.',
          emailSent: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check for existing invitation (any status) and delete it to allow re-inviting
    const { data: existingInvitations } = await supabaseClient
      .from('organization_requests')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('email', email.toLowerCase());

    if (existingInvitations && existingInvitations.length > 0) {
      for (const inv of existingInvitations) {
        await supabaseClient
          .from('organization_requests')
          .delete()
          .eq('id', inv.id);
        console.log(`🗑️ Deleted existing invitation (${inv.status}):`, inv.id);
      }
    }

    // Calculate expiry date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation record in organization_requests
    const { data: invitation, error: invitationError } = await supabaseClient
      .from('organization_requests')
      .insert({
        organization_id: organizationId,
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        role: role || 'user',
        password_hash: password, // Store temporarily for account creation
        security_template_id: securityTemplateId || null,
        mobile: mobile || null,
        gender: gender || null,
        nationality: nationality || null,
        timezone: timezone || null,
        invitation_type: 'admin_invite',
        status: 'pending',
        message: `Invited as ${role || 'user'} by ${inviterName}`,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, invitation_token')
      .single();

    if (invitationError) {
      console.error('❌ Error creating invitation:', invitationError);
      throw new Error(`Failed to create invitation: ${invitationError.message}`);
    }

    console.log('✅ Invitation created:', invitation.id);

    // Get SMTP configuration
    const { data: smtpConfigs } = await supabaseClient
      .from('smtp_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    let smtpConfig = null;
    if (smtpConfigs && smtpConfigs.length > 0) {
      smtpConfig = smtpConfigs.find(config => 
        config.host?.toLowerCase().includes('hostinger') ||
        config.from_email?.toLowerCase().includes('topsqill.tech')
      ) || smtpConfigs.find(config => 
        !config.host?.toLowerCase().includes('sendgrid')
      );
    }

    if (!smtpConfig) {
      console.warn('⚠️ No SMTP config found, invitation created but email not sent');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invitation created but email could not be sent (no SMTP configured)',
          invitationId: invitation.id,
          emailSent: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build accept URL - use the app's actual URL
    const appUrl = 'https://topsqill-itsm-12.lovable.app';
    const acceptUrl = `${appUrl}/accept-invitation?token=${invitation.invitation_token}`;

    // Generate email HTML
    const emailHtml = generateInvitationEmailHtml({
      firstName,
      lastName,
      email,
      password,
      role: role || 'user',
      organizationName: organizationName || 'TOPSQILL',
      inviterName,
      acceptUrl,
      expiresAt: expiresAt.toISOString(),
    });

    // Send email
    console.log('📧 Sending invitation email to:', email);
    
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
      to: email,
      subject: `🎉 You're Invited to Join ${organizationName || 'TOPSQILL'}`,
      content: `Hi ${firstName}, you've been invited to join ${organizationName} as a ${role}. Please check your email for the HTML version with your login credentials and accept button.`,
      html: emailHtml,
    });

    await client.close();
    console.log('✅ Invitation email sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully',
        invitationId: invitation.id,
        emailSent: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('💥 Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        emailSent: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
