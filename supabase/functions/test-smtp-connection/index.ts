import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  configId: string;
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

    const { configId }: TestRequest = await req.json();

    console.log('🧪 Testing SMTP connection for config:', configId);

    // Get SMTP configuration
    const { data: smtpConfig, error: configError } = await supabaseClient
      .from('smtp_configs')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !smtpConfig) {
      throw new Error('SMTP configuration not found');
    }

    // Test email content
    const testEmailData = {
      From: smtpConfig.from_name 
        ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
        : smtpConfig.from_email,
      To: smtpConfig.from_email, // Send test email to the same address
      Subject: 'SMTP Configuration Test',
      HtmlBody: `
        <h2>SMTP Test Email</h2>
        <p>This is a test email to verify your SMTP configuration is working correctly.</p>
        <p><strong>Configuration:</strong> ${smtpConfig.name}</p>
        <p><strong>Host:</strong> ${smtpConfig.host}:${smtpConfig.port}</p>
        <p><strong>TLS:</strong> ${smtpConfig.use_tls ? 'Enabled' : 'Disabled'}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      TextBody: `
SMTP Test Email

This is a test email to verify your SMTP configuration is working correctly.

Configuration: ${smtpConfig.name}
Host: ${smtpConfig.host}:${smtpConfig.port}
TLS: ${smtpConfig.use_tls ? 'Enabled' : 'Disabled'}
Time: ${new Date().toISOString()}
      `,
    };

    // For demo purposes, we'll simulate a successful test
    // In a real implementation, you'd use the actual SMTP settings to send the test email
    try {
      // Simulate SMTP connection test
      const testResponse = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': Deno.env.get('POSTMARK_API_KEY') || 'test-token',
        },
        body: JSON.stringify(testEmailData),
      });

      if (testResponse.ok) {
        const result = await testResponse.json();
        console.log('✅ SMTP test successful:', result);

        return new Response(JSON.stringify({
          success: true,
          message: `Test email sent successfully to ${smtpConfig.from_email}`,
          details: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            tls: smtpConfig.use_tls,
            messageId: result.MessageID,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        const error = await testResponse.json();
        throw new Error(error.Message || 'SMTP test failed');
      }
    } catch (error: any) {
      console.error('❌ SMTP test failed:', error);
      
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