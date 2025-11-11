import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  templateId: string;
  recipients: string[];
  templateData: Record<string, any>;
  smtpConfigId?: string;
  triggerContext?: Record<string, any>;
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

    const { templateId, recipients, templateData, smtpConfigId, triggerContext }: EmailRequest = await req.json();

    console.log('📧 Email Request Details:', {
      templateId,
      recipients,
      templateDataKeys: Object.keys(templateData),
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
    
    console.log('✅ SMTP config found:', smtpConfig.from_email);

    // Process template variables
    const processTemplate = (text: string, data: Record<string, any>): string => {
      let processed = text;
      
      // Replace template variables
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processed = processed.replace(regex, String(data[key] || ''));
      });

      return processed;
    };

    const processedSubject = processTemplate(template.subject, templateData);
    const processedHtmlContent = processTemplate(template.html_content, templateData);
    const processedTextContent = template.text_content 
      ? processTemplate(template.text_content, templateData) 
      : undefined;

    // Send emails to all recipients
    console.log(`📮 Processing ${recipients.length} recipient(s)`);
    const emailResults = [];
    
    for (const recipient of recipients) {
      console.log(`📧 Sending to: ${recipient}`);
      try {
        // Create email transport
        const emailData = {
          from: smtpConfig.from_name 
            ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
            : smtpConfig.from_email,
          to: recipient,
          subject: processedSubject,
          html: processedHtmlContent,
          text: processedTextContent,
        };

        // Here you would integrate with your preferred email service
        // For now, we'll use nodemailer-like structure
        const response = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': Deno.env.get('POSTMARK_API_KEY') || '',
          },
          body: JSON.stringify({
            From: emailData.from,
            To: emailData.to,
            Subject: emailData.subject,
            HtmlBody: emailData.html,
            TextBody: emailData.text,
          }),
        });

        const result = await response.json();
        
        if (response.ok) {
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
            messageId: result.MessageID,
          });
        } else {
          throw new Error(result.Message || 'Failed to send email');
        }
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