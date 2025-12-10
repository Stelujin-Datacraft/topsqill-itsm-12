import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  templateId: string;
  recipients?: string[];
  templateData: Record<string, any>;
  smtpConfigId?: string;
  triggerContext?: Record<string, any>;
}

interface RecipientConfig {
  type: 'static' | 'dynamic' | 'parameter';
  value: string;
  label?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 send-template-email function invoked');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { templateId, recipients: providedRecipients, templateData, smtpConfigId, triggerContext }: EmailRequest = await req.json();

    console.log('📧 Email Request Details:', {
      templateId,
      providedRecipients,
      templateDataKeys: Object.keys(templateData || {}),
      smtpConfigId,
      triggerContext
    });

    // Get the email template
    console.log('📝 Fetching email template:', templateId);
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('❌ Template fetch error:', templateError);
      throw new Error('Email template not found or inactive');
    }
    
    console.log('✅ Template found:', template.name);
    console.log('📋 Template recipients config:', JSON.stringify(template.recipients));

    // Build recipients list from template configuration if not provided
    let finalRecipients: string[] = [];
    
    if (providedRecipients && providedRecipients.length > 0) {
      // Use provided recipients
      finalRecipients = providedRecipients;
      console.log('📧 Using provided recipients:', finalRecipients);
    } else if (template.recipients) {
      // Extract recipients from template configuration
      const recipientsConfig = template.recipients as {
        to?: RecipientConfig[];
        cc?: RecipientConfig[];
        bcc?: RecipientConfig[];
        permanent_recipients?: RecipientConfig[];
      };

      console.log('📋 Processing template recipient config:', recipientsConfig);

      const processRecipientConfig = (configs: RecipientConfig[]): string[] => {
        const emails: string[] = [];
        
        for (const config of configs) {
          if (config.type === 'static' && config.value) {
            // Static email address
            emails.push(config.value);
          } else if (config.type === 'dynamic' && config.value) {
            // Dynamic email from template data
            emails.push(config.value);
          } else if (config.type === 'parameter' && config.value) {
            // Parameter template variable - replace with actual value
            const paramName = config.value.replace(/\{\{|\}\}/g, '').trim();
            const resolvedValue = templateData?.[paramName];
            if (resolvedValue && typeof resolvedValue === 'string' && resolvedValue.includes('@')) {
              emails.push(resolvedValue);
            }
          }
        }
        
        return emails;
      };

      // Process all recipient types
      if (recipientsConfig.to) {
        finalRecipients.push(...processRecipientConfig(recipientsConfig.to));
      }
      if (recipientsConfig.cc) {
        finalRecipients.push(...processRecipientConfig(recipientsConfig.cc));
      }
      if (recipientsConfig.bcc) {
        finalRecipients.push(...processRecipientConfig(recipientsConfig.bcc));
      }
      if (recipientsConfig.permanent_recipients) {
        finalRecipients.push(...processRecipientConfig(recipientsConfig.permanent_recipients));
      }

      console.log('📧 Recipients from template:', finalRecipients);
    }

    // Remove duplicates and filter valid emails
    finalRecipients = [...new Set(finalRecipients)].filter(email => 
      email && typeof email === 'string' && email.includes('@')
    );

    console.log('📧 Final recipients to send:', finalRecipients);

    if (finalRecipients.length === 0) {
      throw new Error('No valid recipients found. Check template recipient configuration.');
    }

    // Get organization ID from template project
    console.log('🏢 Fetching project for organization:', template.project_id);
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('organization_id')
      .eq('id', template.project_id)
      .single();

    if (projectError || !project) {
      console.error('❌ Project fetch error:', projectError);
      throw new Error('Project not found');
    }
    
    console.log('✅ Project found, organization:', project.organization_id);

    // Get SMTP configuration
    console.log('⚙️ Fetching SMTP configuration...');
    let smtpConfig;
    if (smtpConfigId) {
      console.log('📌 Using specific SMTP config:', smtpConfigId);
      const { data, error } = await supabaseClient
        .from('smtp_configs')
        .select('*')
        .eq('id', smtpConfigId)
        .eq('organization_id', project.organization_id)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.error('❌ SMTP config fetch error:', error);
        throw new Error('SMTP configuration not found');
      }
      smtpConfig = data;
    } else {
      console.log('📌 Using default SMTP config');
      // Get default SMTP config (order by created_at to get most recent if multiple exist)
      const { data, error } = await supabaseClient
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', project.organization_id)
        .eq('is_default', true)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) {
        console.error('❌ Default SMTP config not found:', error);
        throw new Error('No default SMTP configuration found');
      }
      smtpConfig = data;
    }
    
    console.log('✅ SMTP config found:', smtpConfig.name, '-', smtpConfig.from_email);

    // Process template variables
    const processTemplate = (text: string, data: Record<string, any>): string => {
      let processed = text;
      
      // Replace template variables
      Object.keys(data || {}).forEach(key => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processed = processed.replace(regex, String(data[key] || ''));
      });

      return processed;
    };

    const processedSubject = processTemplate(template.subject, templateData || {});
    const processedHtmlContent = processTemplate(template.html_content, templateData || {});
    const processedTextContent = template.text_content 
      ? processTemplate(template.text_content, templateData || {}) 
      : undefined;

    // Send emails to all recipients
    console.log(`📮 Processing ${finalRecipients.length} recipient(s)`);
    const emailResults = [];
    
    // Initialize SMTP client
    console.log(`🔌 Connecting to SMTP: ${smtpConfig.host}:${smtpConfig.port} (TLS: ${smtpConfig.use_tls})`);
    const smtpClient = new SMTPClient({
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
    
    for (const recipient of finalRecipients) {
      console.log(`📧 Sending to: ${recipient}`);
      try {
        // Send email using SMTP
        await smtpClient.send({
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
            : smtpConfig.from_email,
          to: recipient,
          subject: processedSubject,
          content: processedTextContent || processedHtmlContent.replace(/<[^>]*>/g, ''),
          html: processedHtmlContent,
        });

        console.log(`✅ Email sent successfully to ${recipient}`);
        
        // Log successful email
        await supabaseClient.from('email_logs').insert({
          organization_id: project.organization_id,
          project_id: template.project_id,
          template_id: templateId,
          smtp_config_id: smtpConfig.id,
          to_email: recipient,
          from_email: smtpConfig.from_email,
          subject: processedSubject,
          content: processedHtmlContent,
          status: 'sent',
          sent_at: new Date().toISOString(),
          trigger_context: triggerContext || {},
        });

        emailResults.push({
          recipient,
          status: 'sent',
        });
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipient}:`, error);
        
        // Log failed email
        await supabaseClient.from('email_logs').insert({
          organization_id: project.organization_id,
          project_id: template.project_id,
          template_id: templateId,
          smtp_config_id: smtpConfig.id,
          to_email: recipient,
          from_email: smtpConfig.from_email,
          subject: processedSubject,
          content: processedHtmlContent,
          status: 'failed',
          error_message: error.message,
          trigger_context: triggerContext || {},
        });

        emailResults.push({
          recipient,
          status: 'failed',
          error: error.message,
        });
      }
    }

    // Close SMTP connection
    await smtpClient.close();

    console.log('✅ Email sending completed:', emailResults);

    return new Response(JSON.stringify({
      success: true,
      results: emailResults,
      sentCount: emailResults.filter(r => r.status === 'sent').length,
      failedCount: emailResults.filter(r => r.status === 'failed').length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in send-template-email function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
