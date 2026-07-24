// @ts-nocheck
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineContext } from './shared/engine-context';
import { SMTPClient } from './shared/smtp-client';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DelegationEmailRequest {
  type: 'delegation_created' | 'delegation_ended';
  recipientUserId: string;
  organizationId: string;
  delegatorName?: string;
  scope?: 'all' | 'form' | 'project';
  scopeSummary?: string;
  endsAt?: string;
  reason?: string | null;
  includeApprovals?: boolean;
}

function renderHtml(p: DelegationEmailRequest & { recipientName: string }) {
  const year = new Date().getFullYear();
  const appUrl = 'https://bpm.topsqill.com';
  const link = `${appUrl}/record-delegations`;
  const isCreated = p.type === 'delegation_created';
  const accent = isCreated ? '#3b82f6' : '#ef4444';
  const title = isCreated ? 'You have been delegated access' : 'A delegation has ended';
  const subtitle = isCreated ? `${p.delegatorName || 'A user'} delegated access to you` : `${p.delegatorName || 'A user'} ended a delegation`;

  const detailsRows = isCreated ? `
    <tr><td style="padding:6px 0;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Delegator</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${p.delegatorName || '—'}</p></td></tr>
    <tr><td style="padding:6px 0;border-top:1px dashed #bfdbfe;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Scope</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${p.scopeSummary || (p.scope === 'all' ? 'All their records' : p.scope)}</p></td></tr>
    ${p.endsAt ? `<tr><td style="padding:6px 0;border-top:1px dashed #bfdbfe;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Active Until</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${new Date(p.endsAt).toLocaleString()}</p></td></tr>` : ''}
    <tr><td style="padding:6px 0;border-top:1px dashed #bfdbfe;"><span style="color:#1d4ed8;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Approvals Included</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${p.includeApprovals ? 'Yes' : 'No'}</p></td></tr>
  ` : `
    <tr><td style="padding:6px 0;"><span style="color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Delegator</span><p style="margin:4px 0 0;color:#1e293b;font-size:14px;font-weight:600;">${p.delegatorName || '—'}</p></td></tr>
    <tr><td style="padding:6px 0;border-top:1px dashed #fecaca;"><span style="color:#991b1b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Status</span><p style="margin:4px 0 0;color:#ef4444;font-size:14px;font-weight:700;text-transform:uppercase;">Ended</p></td></tr>
  `;

  const body = `
    <p style="margin:0 0 15px;color:#333;font-size:15px;line-height:1.6;">Hi <strong>${p.recipientName}</strong>,</p>
    <p style="margin:0 0 15px;color:#555;font-size:14px;line-height:1.6;">${isCreated ? 'You have been granted delegated access to act on records on behalf of another user.' : 'A previously granted delegation has been revoked. You no longer have delegated access for it.'}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="background-color:${isCreated ? '#eff6ff' : '#fef2f2'};border:1px solid ${isCreated ? '#bfdbfe' : '#fecaca'};border-radius:8px;padding:20px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;">${detailsRows}</table>
      </td></tr>
    </table>
    ${p.reason ? `<div style="background:#f8f9fc;border-left:3px solid ${accent};border-radius:0 6px 6px 0;padding:12px 15px;margin:15px 0;"><p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Reason</p><p style="margin:4px 0 0;color:#334155;font-size:14px;">${p.reason}</p></div>` : ''}
  `;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,sans-serif;background:#f4f7fa;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 0;"><table role="presentation" style="width:600px;max-width:100%;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);"><tr><td style="background:linear-gradient(135deg,${accent} 0%,${accent}dd 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">${title}</h1><p style="margin:8px 0 0;color:rgba(255,255,255,.9);font-size:14px;">${subtitle}</p></td></tr><tr><td style="padding:30px;">${body}<table role="presentation" style="width:100%;margin:25px 0 15px;"><tr><td align="center"><a href="${link}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 30px;border-radius:6px;font-size:14px;font-weight:600;">View Delegations</a></td></tr></table><p style="margin:15px 0 0;color:#333;font-size:14px;">Best regards,<br><strong>TopSqill</strong></p></td></tr><tr><td style="background:#f8f9fc;padding:12px 20px;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:11px;">TopSqill | &copy; ${year}</p></td></tr></table></td></tr></table></body></html>`;
}



export async function sendDelegationEmail(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  ctx: EngineContext,
): Promise<Record<string, unknown>> {

  try {
    const body = body as any;
    const supabaseAdmin = supabase;

    const { data: recipient } = await supabaseAdmin
      .from('user_profiles').select('id,email,first_name,last_name').eq('id', body.recipientUserId).single();
    if (!recipient?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Recipient not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    const { data: smtpConfigs } = await supabaseAdmin
      .from('smtp_configs').select('*').eq('organization_id', body.organizationId).eq('is_active', true).order('is_default', { ascending: false });
    if (!smtpConfigs?.length) {
      return new Response(JSON.stringify({ success: false, error: 'No SMTP configuration found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const recipientName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || recipient.email;
    const html = renderHtml({ ...body, recipientName });
    const subject = body.type === 'delegation_created'
      ? `You have been delegated access${body.delegatorName ? ` by ${body.delegatorName}` : ''}`
      : `A delegation has ended${body.delegatorName ? ` (${body.delegatorName})` : ''}`;

    let lastError: any = null;
    for (const config of smtpConfigs) {
      try {
        const client = new SMTPClient({
          connection: { hostname: config.host, port: config.port, tls: config.use_tls, auth: { username: config.username, password: config.password } },
        });
        await client.send({
          from: config.from_name ? `${config.from_name} <${config.from_email}>` : config.from_email,
          to: recipient.email, subject, content: 'auto', html,
        });
        await client.close();
        console.log('✅ Delegation email sent:', body.type, '→', recipient.email);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } catch (err: any) {
        console.warn(`⚠️ SMTP ${config.host} failed:`, err.message);
        lastError = err;
      }
    }
    return new Response(JSON.stringify({ success: false, error: lastError?.message || 'All SMTP configs failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  } catch (e: any) {
    console.error('❌ send-delegation-email error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
}
