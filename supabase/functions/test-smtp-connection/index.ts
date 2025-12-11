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

    let client: SMTPClient | null = null;
    
    try {
      // Initialize SMTP client with actual configuration
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

      // Send test email using actual SMTP
      await client.send({
        from: smtpConfig.from_name 
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
          : smtpConfig.from_email,
        to: testEmail,
        subject: `SMTP Test - ${smtpConfig.name}`,
        content: `SMTP Configuration Test\n\nThis is a test email to verify your SMTP configuration is working correctly.\n\nConfiguration: ${smtpConfig.name}\nHost: ${smtpConfig.host}\nPort: ${smtpConfig.port}\nTest Time: ${new Date().toISOString()}\n\nIf you received this email, your SMTP configuration is working properly!`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#4F46E5;">SMTP Test - ${smtpConfig.name}</h2><p>Your SMTP configuration is working correctly.</p><p><strong>Host:</strong> ${smtpConfig.host}<br><strong>Port:</strong> ${smtpConfig.port}<br><strong>Time:</strong> ${new Date().toISOString()}</p><p style="background:#10b981;color:white;padding:10px;border-radius:4px;text-align:center;">✅ Configuration verified!</p></body></html>`,
      });

      await client.close();
      client = null;

      console.log('✅ SMTP test successful - email sent to:', testEmail);

      return new Response(JSON.stringify({
        success: true,
        message: `Test email sent successfully to ${testEmail}. Please check your inbox (and spam folder).`,
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
      
      // Safely close client if it exists
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.error('Error closing SMTP client:', closeError);
        }
      }
      
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