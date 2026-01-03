import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationRequest {
  email: string
  firstName: string
  lastName: string
  role: string
  organizationName: string
  inviterName: string
  organizationId: string
}

serve(async (req) => {
  console.log('🚀 Send Invitation Email - Started')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestBody: InvitationRequest = await req.json()
    console.log('📋 Request data:', JSON.stringify(requestBody, null, 2))

    const { email, firstName, lastName, role, organizationName, inviterName, organizationId } = requestBody

    // Validate required fields
    if (!email || !firstName || !lastName) {
      throw new Error('Missing required fields: email, firstName, lastName')
    }

    if (!organizationId) {
      throw new Error('Missing required field: organizationId')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get default SMTP configuration for the organization
    console.log('🔍 Fetching SMTP config for organization:', organizationId)
    const { data: smtpConfig, error: configError } = await supabaseClient
      .from('smtp_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (configError || !smtpConfig) {
      // Try to get any active SMTP config if no default
      const { data: anyConfig, error: anyConfigError } = await supabaseClient
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (anyConfigError || !anyConfig) {
        console.error('❌ No SMTP configuration found for organization:', organizationId)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No SMTP configuration found. Please configure SMTP settings in Email Config.',
            emailSent: false 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      
      // Use the non-default config
      Object.assign(smtpConfig || {}, anyConfig);
    }

    console.log('📧 Using SMTP config:', {
      name: smtpConfig.name,
      host: smtpConfig.host,
      port: smtpConfig.port,
      from_email: smtpConfig.from_email,
    });

    // Build the email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
          
          <p style="font-size: 16px;">${inviterName || 'Someone'} has invited you to join <strong>${organizationName || 'their organization'}</strong> as a <strong>${role || 'member'}</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>What happens next?</strong><br>
              Your invitation is pending approval. Once approved, you'll receive another email with your login credentials.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #666;">If you didn't expect this invitation or have any questions, please contact the person who invited you.</p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            This email was sent by ${organizationName || 'DataCraft Pro'}.<br>
            If you believe you received this email in error, please ignore it.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Hi ${firstName},

${inviterName || 'Someone'} has invited you to join ${organizationName || 'their organization'} as a ${role || 'member'}.

What happens next?
Your invitation is pending approval. Once approved, you'll receive another email with your login credentials.

If you didn't expect this invitation or have any questions, please contact the person who invited you.

This email was sent by ${organizationName || 'DataCraft Pro'}.
    `.trim();

    console.log('📤 Sending invitation email to:', email)

    let client: SMTPClient | null = null;

    try {
      // Initialize SMTP client
      client = new SMTPClient({
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

      // Send email using SMTP
      await client.send({
        from: smtpConfig.from_name 
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
          : smtpConfig.from_email,
        to: email,
        subject: `You're invited to join ${organizationName || 'our organization'}`,
        content: emailText,
        html: emailHtml,
      });

      await client.close();
      client = null;

      console.log('✅ Invitation email sent successfully to:', email)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Invitation email sent successfully',
          emailSent: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } catch (smtpError: any) {
      console.error('❌ SMTP error:', smtpError)
      
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.error('Error closing SMTP client:', closeError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send email: ${smtpError.message}`,
          emailSent: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error: any) {
    console.error('💥 Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        emailSent: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
