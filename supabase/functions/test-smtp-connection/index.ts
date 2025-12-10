import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  configId: string;
  testEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { configId, testEmail }: TestRequest = await req.json();

    if (!testEmail || !testEmail.includes('@')) {
      throw new Error('Valid test email address is required');
    }

    console.log('🧪 Testing SMTP connection for config:', configId, 'to:', testEmail);

    // Get SMTP configuration
    const { data: smtpConfig, error: configError } = await supabaseClient
      .from('smtp_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !smtpConfig) {
      throw new Error('SMTP configuration not found');
    }

    console.log('📧 Using SMTP config:', {
      name: smtpConfig.name,
      host: smtpConfig.host,
      port: smtpConfig.port,
      use_tls: smtpConfig.use_tls,
    });

    // Initialize SMTP client with actual configuration
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

    try {
      // Send test email using actual SMTP
      await client.send({
        from: smtpConfig.from_name 
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
          : smtpConfig.from_email,
        to: testEmail,
        subject: `SMTP Test - ${smtpConfig.name}`,
        content: `
SMTP Configuration Test

This is a test email to verify your SMTP configuration is working correctly.

Configuration Details:
- Name: ${smtpConfig.name}
- Host: ${smtpConfig.host}
- Port: ${smtpConfig.port}
- TLS: ${smtpConfig.use_tls ? 'Enabled' : 'Disabled'}
- Test Time: ${new Date().toISOString()}

If you received this email, your SMTP configuration is working properly!
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #4F46E5; }
    .success { background: #10b981; color: white; padding: 10px; border-radius: 4px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>SMTP Configuration Test</h2>
    </div>
    <div class="content">
      <p>This is a test email to verify your SMTP configuration is working correctly.</p>
      
      <h3>Configuration Details:</h3>
      <div class="detail-row"><span class="label">Name:</span> ${smtpConfig.name}</div>
      <div class="detail-row"><span class="label">Host:</span> ${smtpConfig.host}</div>
      <div class="detail-row"><span class="label">Port:</span> ${smtpConfig.port}</div>
      <div class="detail-row"><span class="label">TLS:</span> ${smtpConfig.use_tls ? 'Enabled' : 'Disabled'}</div>
      <div class="detail-row"><span class="label">Test Time:</span> ${new Date().toISOString()}</div>
      
      <div class="success">
        ✅ Your SMTP configuration is working properly!
      </div>
    </div>
  </div>
</body>
</html>
        `,
      });

      await client.close();

      console.log('✅ SMTP test successful - email sent to:', testEmail);

      return new Response(JSON.stringify({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        details: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          tls: smtpConfig.use_tls,
          recipient: testEmail,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: any) {
      console.error('❌ SMTP test failed:', error);
      
      await client.close().catch(() => {});
      
      return new Response(JSON.stringify({
        success: false,
        message: `SMTP connection test failed: ${error.message}`,
        details: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          tls: smtpConfig.use_tls,
          error: error.message,
        },
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('❌ Error in test-smtp-connection function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);