import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface KBNotificationRequest {
  type: 'approval_request' | 'review_request' | 'approval_response' | 'review_response';
  recipientUserId: string;
  policyName: string;
  policyNumber?: string;
  policyId: string;
  version?: number;
  organizationId: string;
  senderName?: string;
  reviewType?: 'pre' | 'post';
  comment?: string;
  responseStatus?: 'approved' | 'rejected';
}

function generateKBNotificationHtml(params: KBNotificationRequest & { recipientName: string; recipientEmail: string }) {
  const year = new Date().getFullYear();
  const appUrl = 'https://bpm.topsqill.com';
  const policyLink = `${appUrl}/policy/${params.policyId}`;

  let title = '';
  let subtitle = '';
  let bodyContent = '';
  let ctaText = 'View Document';
  let accentColor = '#667eea';

  switch (params.type) {
    case 'approval_request':
      title = 'Approval Required';
      subtitle = 'A document requires your approval';
      accentColor = '#f59e0b';
      bodyContent = `
        <p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${params.recipientName}</strong>,</p>
        <p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">You have been assigned as an approver for the following document:</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;"><span style="color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document</span><p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:700;">${params.policyName}</p></td></tr>
              ${params.policyNumber ? `<tr><td style="padding:6px 0;border-top:1px dashed #fde68a;"><span style="color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document Number</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${params.policyNumber}</p></td></tr>` : ''}
              ${params.version ? `<tr><td style="padding:6px 0;border-top:1px dashed #fde68a;"><span style="color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Version</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">v${params.version}</p></td></tr>` : ''}
              ${params.senderName ? `<tr><td style="padding:6px 0;border-top:1px dashed #fde68a;"><span style="color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Requested By</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${params.senderName}</p></td></tr>` : ''}
            </table>
          </td></tr>
        </table>
        ${params.comment ? `<div style="background:#f8f9fc;border-left:3px solid #667eea;border-radius:0 6px 6px 0;padding:12px 15px;margin:15px 0;"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Comment</p><p style="margin:4px 0 0;color:#334155;font-size:14px;">${params.comment}</p></div>` : ''}
        <p style="margin:15px 0 0;color:#555;font-size:14px;line-height:1.6;">Please review and provide your approval or rejection at your earliest convenience.</p>`;
      ctaText = 'Review & Approve';
      break;

    case 'review_request':
      title = `${params.reviewType === 'pre' ? 'Pre-Review' : 'Post-Review'} Requested`;
      subtitle = 'A document requires your review';
      accentColor = '#3b82f6';
      bodyContent = `
        <p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${params.recipientName}</strong>,</p>
        <p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">You have been assigned as a ${params.reviewType === 'pre' ? 'pre-reviewer' : 'post-reviewer'} for the following document:</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document</span><p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:700;">${params.policyName}</p></td></tr>
              ${params.policyNumber ? `<tr><td style="padding:6px 0;border-top:1px dashed #bfdbfe;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document Number</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${params.policyNumber}</p></td></tr>` : ''}
              ${params.senderName ? `<tr><td style="padding:6px 0;border-top:1px dashed #bfdbfe;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Requested By</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${params.senderName}</p></td></tr>` : ''}
            </table>
          </td></tr>
        </table>
        ${params.comment ? `<div style="background:#f8f9fc;border-left:3px solid #3b82f6;border-radius:0 6px 6px 0;padding:12px 15px;margin:15px 0;"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Comment</p><p style="margin:4px 0 0;color:#334155;font-size:14px;">${params.comment}</p></div>` : ''}
        <p style="margin:15px 0 0;color:#555;font-size:14px;line-height:1.6;">Please review the document and provide your feedback.</p>`;
      ctaText = 'Review Document';
      break;

    case 'approval_response':
      const isApproved = params.responseStatus === 'approved';
      title = isApproved ? 'Document Approved' : 'Document Rejected';
      subtitle = `Your document has been ${isApproved ? 'approved' : 'rejected'}`;
      accentColor = isApproved ? '#10b981' : '#ef4444';
      bodyContent = `
        <p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${params.recipientName}</strong>,</p>
        <p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">Your document has been <strong style="color:${accentColor};">${isApproved ? 'approved' : 'rejected'}</strong> by ${params.senderName || 'an approver'}.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="background-color:${isApproved ? '#ecfdf5' : '#fef2f2'};border:1px solid ${isApproved ? '#a7f3d0' : '#fecaca'};border-radius:8px;padding:20px;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;"><span style="color:${isApproved ? '#065f46' : '#991b1b'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document</span><p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:700;">${params.policyName}</p></td></tr>
              <tr><td style="padding:6px 0;border-top:1px dashed ${isApproved ? '#a7f3d0' : '#fecaca'};"><span style="color:${isApproved ? '#065f46' : '#991b1b'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Status</span><p style="margin:4px 0 0;color:${accentColor};font-size:14px;font-weight:700;text-transform:uppercase;">${params.responseStatus}</p></td></tr>
            </table>
          </td></tr>
        </table>
        ${params.comment ? `<div style="background:#f8f9fc;border-left:3px solid ${accentColor};border-radius:0 6px 6px 0;padding:12px 15px;margin:15px 0;"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Approver's Comment</p><p style="margin:4px 0 0;color:#334155;font-size:14px;">${params.comment}</p></div>` : ''}`;
      ctaText = 'View Document';
      break;

    case 'review_response':
      const reviewOutcome = params.responseStatus === 'approved' ? 'completed' : 'flagged';
      const reviewLabel = params.reviewType === 'pre' ? 'Pre-Review' : 'Post-Review';
      title = `${reviewLabel} ${reviewOutcome === 'completed' ? 'Completed' : 'Flagged'}`;
      subtitle = `A reviewer has ${reviewOutcome === 'completed' ? 'completed their review' : 'flagged issues'} on your document`;
      accentColor = reviewOutcome === 'completed' ? '#8b5cf6' : '#f59e0b';
      bodyContent = `
        <p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${params.recipientName}</strong>,</p>
        <p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">The <strong>${reviewLabel.toLowerCase()}</strong> for your document has been <strong style="color:${accentColor};">${reviewOutcome}</strong> by ${params.senderName || 'a reviewer'}.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="background-color:${reviewOutcome === 'completed' ? '#f5f3ff' : '#fffbeb'};border:1px solid ${reviewOutcome === 'completed' ? '#ddd6fe' : '#fde68a'};border-radius:8px;padding:20px;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;"><span style="color:${reviewOutcome === 'completed' ? '#5b21b6' : '#92400e'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document</span><p style="margin:4px 0 0;color:#1e293b;font-size:16px;font-weight:700;">${params.policyName}</p></td></tr>
              ${params.policyNumber ? `<tr><td style="padding:6px 0;border-top:1px dashed ${reviewOutcome === 'completed' ? '#ddd6fe' : '#fde68a'};"><span style="color:${reviewOutcome === 'completed' ? '#5b21b6' : '#92400e'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Document Number</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${params.policyNumber}</p></td></tr>` : ''}
              <tr><td style="padding:6px 0;border-top:1px dashed ${reviewOutcome === 'completed' ? '#ddd6fe' : '#fde68a'};"><span style="color:${reviewOutcome === 'completed' ? '#5b21b6' : '#92400e'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Review Type</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${reviewLabel}</p></td></tr>
              <tr><td style="padding:6px 0;border-top:1px dashed ${reviewOutcome === 'completed' ? '#ddd6fe' : '#fde68a'};"><span style="color:${reviewOutcome === 'completed' ? '#5b21b6' : '#92400e'};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Outcome</span><p style="margin:4px 0 0;color:${accentColor};font-size:14px;font-weight:700;text-transform:uppercase;">${reviewOutcome}</p></td></tr>
            </table>
          </td></tr>
        </table>
        ${params.comment ? `<div style="background:#f8f9fc;border-left:3px solid ${accentColor};border-radius:0 6px 6px 0;padding:12px 15px;margin:15px 0;"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reviewer's Findings</p><p style="margin:4px 0 0;color:#334155;font-size:14px;">${params.comment}</p></div>` : ''}`;
      ctaText = 'View Document';
      break;

    default:
      title = 'Document Notification';
      subtitle = 'You have a new notification';
      bodyContent = `<p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${params.recipientName}</strong>,</p><p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">You have a notification regarding "${params.policyName}".</p>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7fa;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" style="width:600px;max-width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,${accentColor} 0%,${accentColor}dd 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${title}</h1><p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${subtitle}</p></td></tr><tr><td style="padding:30px;">${bodyContent}<table role="presentation" style="width:100%;border-collapse:collapse;margin:25px 0 15px;"><tr><td align="center"><a href="${policyLink}" style="display:inline-block;background:linear-gradient(135deg,${accentColor} 0%,${accentColor}dd 100%);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:600;">${ctaText}</a></td></tr></table><p style="margin:15px 0 0;color:#333;font-size:14px;">Best regards,<br><strong>TopSqill BPM</strong></p></td></tr><tr><td style="background-color:#f8f9fc;padding:12px 20px;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.4;">TopSqill BPM | &copy; ${year} All rights reserved</p></td></tr></table></td></tr></table></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: KBNotificationRequest = await req.json();
    console.log('📧 KB notification email request:', body.type, 'for policy:', body.policyName);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get recipient's profile
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, first_name, last_name')
      .eq('id', body.recipientUserId)
      .single();

    if (recipientError || !recipient) {
      console.warn('⚠️ Recipient not found:', body.recipientUserId);
      return new Response(JSON.stringify({ success: false, error: 'Recipient not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Get SMTP config
    const { data: smtpConfigs } = await supabaseAdmin
      .from('smtp_configs')
      .select('*')
      .eq('organization_id', body.organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    let smtpConfig = null;
    if (smtpConfigs && smtpConfigs.length > 0) {
      smtpConfig = smtpConfigs.find((c: any) =>
        c.host?.toLowerCase().includes('hostinger') ||
        c.from_email?.toLowerCase().includes('topsqill.tech')
      ) || smtpConfigs.find((c: any) =>
        !c.host?.toLowerCase().includes('sendgrid')
      );
    }

    if (!smtpConfig) {
      console.warn('⚠️ No SMTP config found for org:', body.organizationId);
      return new Response(JSON.stringify({ success: false, error: 'No SMTP configuration found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const recipientName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || recipient.email;
    const emailHtml = generateKBNotificationHtml({
      ...body,
      recipientName,
      recipientEmail: recipient.email,
    });

    // Determine subject
    let subject = '';
    switch (body.type) {
      case 'approval_request':
        subject = `Approval Required: ${body.policyName}`;
        break;
      case 'review_request':
        subject = `${body.reviewType === 'pre' ? 'Pre-Review' : 'Post-Review'} Requested: ${body.policyName}`;
        break;
      case 'approval_response':
        subject = `Document ${body.responseStatus === 'approved' ? 'Approved' : 'Rejected'}: ${body.policyName}`;
        break;
      default:
        subject = `Document Notification: ${body.policyName}`;
    }

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
      to: recipient.email,
      subject,
      content: 'auto',
      html: emailHtml,
    });

    await client.close();
    console.log('✅ KB notification email sent to:', recipient.email);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Error sending KB notification email:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
