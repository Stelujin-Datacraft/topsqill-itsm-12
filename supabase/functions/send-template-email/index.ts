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
  type: 'static' | 'parameter' | 'dynamic';
  value: string;
  label?: string;
  formId?: string;
  fieldId?: string;
}

interface TemplateRecipients {
  to?: RecipientConfig[];
  cc?: RecipientConfig[];
  bcc?: RecipientConfig[];
  permanent_recipients?: string[];
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

    const { templateId, recipients: passedRecipients, templateData, smtpConfigId, triggerContext }: EmailRequest = await req.json();

    console.log('📧 Email Request Details:', {
      templateId,
      passedRecipients,
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

    // Resolve all recipients from template configuration AND passed recipients
    const allRecipients = new Set<string>();
    
    // Add passed recipients (from workflow)
    if (passedRecipients && Array.isArray(passedRecipients)) {
      passedRecipients.forEach(r => {
        if (r && typeof r === 'string' && r.includes('@')) {
          allRecipients.add(r.trim().toLowerCase());
        }
      });
    }
    
    // Extract recipients from template configuration
    const templateRecipients = template.recipients as TemplateRecipients | null;
    if (templateRecipients) {
      console.log('📧 Processing template recipients configuration...');
      
      // Process "to" recipients
      if (templateRecipients.to && Array.isArray(templateRecipients.to)) {
        for (const recipient of templateRecipients.to) {
          if (recipient.type === 'static' && recipient.value) {
            // Static can have multiple comma-separated emails
            const staticEmails = recipient.value.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
            for (const email of staticEmails) {
              console.log('📧 Adding static TO recipient:', email);
              allRecipients.add(email);
            }
          } else if (recipient.type === 'parameter' && templateData) {
            // Parameter can be either a fieldId (new format) or a {{variable}} (legacy format)
            const extractedEmails: string[] = [];
            
            if (recipient.fieldId) {
              // New format: use fieldId to lookup value from templateData
              const fieldValue = templateData[recipient.fieldId];
              
              if (fieldValue) {
                // Handle different field value formats
                if (typeof fieldValue === 'string') {
                  // Simple string value (text, email, dropdown, radio, select)
                  const email = fieldValue.trim().toLowerCase();
                  if (email.includes('@')) {
                    extractedEmails.push(email);
                  }
                } else if (Array.isArray(fieldValue)) {
                  // Array of values (multi-select with multiple emails)
                  for (const item of fieldValue) {
                    if (typeof item === 'string') {
                      const email = item.trim().toLowerCase();
                      if (email.includes('@')) {
                        extractedEmails.push(email);
                      }
                    }
                  }
                } else if (typeof fieldValue === 'object' && fieldValue !== null) {
                  // Submission-access field format: { users: string[], groups: string[] }
                  // For users, we need to fetch their emails from user_profiles
                  if (fieldValue.users && Array.isArray(fieldValue.users)) {
                    console.log('📧 Submission-access field detected, fetching user emails for:', fieldValue.users);
                    // Note: User IDs need to be resolved to emails - this is handled by the workflow
                    // that should pass resolved emails in templateData
                    for (const userId of fieldValue.users) {
                      if (typeof userId === 'string' && userId.includes('@')) {
                        // Already an email
                        extractedEmails.push(userId.trim().toLowerCase());
                      }
                    }
                  }
                  // For groups, emails should be pre-resolved by the workflow
                  if (fieldValue.emails && Array.isArray(fieldValue.emails)) {
                    for (const email of fieldValue.emails) {
                      if (typeof email === 'string' && email.includes('@')) {
                        extractedEmails.push(email.trim().toLowerCase());
                      }
                    }
                  }
                }
              }
            } else if (recipient.value) {
              // Legacy format: extract variable name from {{variable}}
              const varMatch = recipient.value.match(/\{\{\s*(\w+)\s*\}\}/);
              if (varMatch && templateData[varMatch[1]]) {
                const val = templateData[varMatch[1]];
                if (typeof val === 'string') {
                  const email = val.trim().toLowerCase();
                  if (email.includes('@')) {
                    extractedEmails.push(email);
                  }
                } else if (Array.isArray(val)) {
                  for (const item of val) {
                    if (typeof item === 'string') {
                      const email = item.trim().toLowerCase();
                      if (email.includes('@')) {
                        extractedEmails.push(email);
                      }
                    }
                  }
                }
              }
            }
            
            // Add all extracted emails
            for (const email of extractedEmails) {
              console.log('📧 Adding parameter TO recipient:', email);
              allRecipients.add(email);
            }
          } else if (recipient.type === 'dynamic' && recipient.value) {
            // Dynamic can have multiple comma-separated emails (from multi-user selection)
            const dynamicEmails = recipient.value.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
            for (const email of dynamicEmails) {
              console.log('📧 Adding dynamic TO recipient:', email);
              allRecipients.add(email);
            }
          }
        }
      }
      
      // Process permanent recipients
      if (templateRecipients.permanent_recipients && Array.isArray(templateRecipients.permanent_recipients)) {
        for (const email of templateRecipients.permanent_recipients) {
          if (email && typeof email === 'string' && email.includes('@')) {
            console.log('📧 Adding permanent recipient:', email);
            allRecipients.add(email.trim().toLowerCase());
          }
        }
      }
    }
    
    // Convert Set to Array
    const finalRecipients = Array.from(allRecipients);
    console.log('📮 Final recipients list:', finalRecipients);
    
    if (finalRecipients.length === 0) {
      console.error('❌ No recipients to send email to');
      throw new Error('No recipients found - please configure recipients in the email template or pass them in the request');
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
      // Get default SMTP config - prioritize most recently updated active config
      const { data, error } = await supabaseClient
        .from('smtp_configs')
        .select('*')
        .eq('organization_id', project.organization_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) {
        console.error('❌ SMTP config not found:', error);
        throw new Error('No active SMTP configuration found');
      }
      smtpConfig = data;
      console.log('📌 Selected SMTP config:', smtpConfig.name, '-', smtpConfig.host);
    }
    
    console.log('✅ SMTP config found:', smtpConfig.from_email);

    // Get field mappings from custom_params (maps field labels to field IDs)
    const fieldMappings = (template.custom_params as Record<string, any>)?.fieldMappings || {};
    console.log('📋 Field mappings:', fieldMappings);

    // Process template variables
    const processTemplate = (text: string, data: Record<string, any>): string => {
      let processed = text;
      
      // First, replace field labels with their values using the mapping
      Object.entries(fieldMappings).forEach(([label, fieldId]) => {
        const labelRegex = new RegExp(`{{\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
        const value = data[fieldId as string];
        if (value !== undefined) {
          processed = processed.replace(labelRegex, String(value || ''));
        }
      });
      
      // Then, replace any remaining variables by key (fieldId or custom variables)
      Object.keys(data).forEach(key => {
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
    
    // Send to each recipient with a fresh SMTP connection to avoid "nested MAIL command" error
    for (const recipient of finalRecipients) {
      console.log(`📧 Sending to: ${recipient}`);
      
      // Create a new SMTP client for each email to avoid connection state issues
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

        // Close connection after successful send
        await smtpClient.close();

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
        
        // Ensure connection is closed even on error
        await smtpClient.close().catch(() => {});
        
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
