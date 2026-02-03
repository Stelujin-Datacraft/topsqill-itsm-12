import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface AttachmentConfig {
  type: 'static' | 'dynamic';
  name: string;
  url?: string;
  formId?: string;
  fieldId?: string;
  fieldLabel?: string;
}

// Helper function to extract emails from a recipient config
const extractEmailsFromRecipient = (
  recipient: RecipientConfig, 
  templateData: Record<string, any> | null
): string[] => {
  const extractedEmails: string[] = [];
  
  if (recipient.type === 'static' && recipient.value) {
    // Static can have multiple comma-separated emails
    const staticEmails = recipient.value.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
    extractedEmails.push(...staticEmails);
  } else if (recipient.type === 'parameter' && templateData) {
    if (recipient.fieldId) {
      // New format: use fieldId to lookup value from templateData
      const fieldValue = templateData[recipient.fieldId];
      
      if (fieldValue) {
        // Handle different field value formats
        if (typeof fieldValue === 'string') {
          // Could be single email or comma-separated emails
          const emails = fieldValue.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
          extractedEmails.push(...emails);
        } else if (Array.isArray(fieldValue)) {
          // Array of values (multi-select with multiple emails)
          for (const item of fieldValue) {
            if (typeof item === 'string') {
              const emails = item.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
              extractedEmails.push(...emails);
            }
          }
        } else if (typeof fieldValue === 'object' && fieldValue !== null) {
          // Submission-access field format: { users: string[], groups: string[] }
          if (fieldValue.users && Array.isArray(fieldValue.users)) {
            for (const userId of fieldValue.users) {
              if (typeof userId === 'string' && userId.includes('@')) {
                extractedEmails.push(userId.trim().toLowerCase());
              }
            }
          }
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
          const emails = val.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
          extractedEmails.push(...emails);
        } else if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'string') {
              const emails = item.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
              extractedEmails.push(...emails);
            }
          }
        }
      }
    }
  } else if (recipient.type === 'dynamic' && recipient.value) {
    // Dynamic can have multiple comma-separated emails (from multi-user selection)
    const dynamicEmails = recipient.value.split(',').map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
    extractedEmails.push(...dynamicEmails);
  }
  
  return extractedEmails;
};

// Helper function to format value for template replacement
const formatValueForTemplate = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    // Join array values with comma and space
    return value.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        // Handle objects like { label: "Option 1", value: "opt1" }
        return item.label || item.name || item.value || JSON.stringify(item);
      }
      return String(item);
    }).filter(Boolean).join(', ');
  }
  
  if (typeof value === 'object') {
    // Handle special object formats
    if (value.label) return value.label;
    if (value.name) return value.name;
    if (value.value) return String(value.value);
    if (value.users && Array.isArray(value.users)) {
      return value.users.join(', ');
    }
    if (value.emails && Array.isArray(value.emails)) {
      return value.emails.join(', ');
    }
    // Fallback for other objects - try to extract meaningful data
    try {
      const keys = Object.keys(value);
      if (keys.length > 0) {
        // For simple key-value objects, format them nicely
        return keys.map(k => `${k}: ${value[k]}`).join(', ');
      }
    } catch {
      // Ignore
    }
    return '';
  }
  
  return String(value);
};

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
    const toRecipients = new Set<string>();
    const ccRecipients = new Set<string>();
    const bccRecipients = new Set<string>();
    
    // Add passed recipients to TO (from workflow)
    if (passedRecipients && Array.isArray(passedRecipients)) {
      passedRecipients.forEach(r => {
        if (r && typeof r === 'string' && r.includes('@')) {
          toRecipients.add(r.trim().toLowerCase());
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
          const emails = extractEmailsFromRecipient(recipient, templateData);
          for (const email of emails) {
            console.log('📧 Adding TO recipient:', email);
            toRecipients.add(email);
          }
        }
      }
      
      // Process "cc" recipients
      if (templateRecipients.cc && Array.isArray(templateRecipients.cc)) {
        for (const recipient of templateRecipients.cc) {
          const emails = extractEmailsFromRecipient(recipient, templateData);
          for (const email of emails) {
            console.log('📧 Adding CC recipient:', email);
            ccRecipients.add(email);
          }
        }
      }
      
      // Process "bcc" recipients
      if (templateRecipients.bcc && Array.isArray(templateRecipients.bcc)) {
        for (const recipient of templateRecipients.bcc) {
          const emails = extractEmailsFromRecipient(recipient, templateData);
          for (const email of emails) {
            console.log('📧 Adding BCC recipient:', email);
            bccRecipients.add(email);
          }
        }
      }
      
      // Process permanent recipients (add to TO)
      if (templateRecipients.permanent_recipients && Array.isArray(templateRecipients.permanent_recipients)) {
        for (const email of templateRecipients.permanent_recipients) {
          if (email && typeof email === 'string' && email.includes('@')) {
            console.log('📧 Adding permanent recipient:', email);
            toRecipients.add(email.trim().toLowerCase());
          }
        }
      }
    }
    
    // Convert Sets to Arrays
    const finalToRecipients = Array.from(toRecipients);
    const finalCcRecipients = Array.from(ccRecipients);
    const finalBccRecipients = Array.from(bccRecipients);
    
    console.log('📮 Final TO recipients:', finalToRecipients);
    console.log('📮 Final CC recipients:', finalCcRecipients);
    console.log('📮 Final BCC recipients:', finalBccRecipients);
    
    if (finalToRecipients.length === 0 && finalCcRecipients.length === 0 && finalBccRecipients.length === 0) {
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

    // Process template variables with improved value formatting
    const processTemplate = (text: string, data: Record<string, any>): string => {
      let processed = text;
      
      // First, replace field labels with their values using the mapping
      Object.entries(fieldMappings).forEach(([label, fieldId]) => {
        const labelRegex = new RegExp(`{{\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
        const value = data[fieldId as string];
        if (value !== undefined) {
          const formattedValue = formatValueForTemplate(value);
          console.log(`📝 Replacing {{${label}}} with:`, formattedValue);
          processed = processed.replace(labelRegex, formattedValue);
        }
      });
      
      // Then, replace any remaining variables by key (fieldId or custom variables)
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*}}`, 'g');
        const formattedValue = formatValueForTemplate(data[key]);
        processed = processed.replace(regex, formattedValue);
      });

      return processed;
    };

    const processedSubject = processTemplate(template.subject, templateData || {});
    const processedHtmlContent = processTemplate(template.html_content, templateData || {});
    const processedTextContent = template.text_content 
      ? processTemplate(template.text_content, templateData || {}) 
      : undefined;

    console.log('📝 Processed subject:', processedSubject);

    // Process attachments
    const attachments: Array<{ filename: string; content: Uint8Array; contentType?: string }> = [];
    const templateAttachments = (template.custom_params as Record<string, any>)?.attachments || template.attachments || [];
    
    console.log('📎 Processing attachments:', templateAttachments.length);
    
    for (const attachment of templateAttachments as AttachmentConfig[]) {
      try {
        if (attachment.type === 'static' && attachment.url) {
          // Fetch static attachment from URL
          console.log('📎 Fetching static attachment:', attachment.name);
          const response = await fetch(attachment.url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            attachments.push({
              filename: attachment.name,
              content: new Uint8Array(arrayBuffer),
              contentType: response.headers.get('content-type') || 'application/octet-stream'
            });
          }
        } else if (attachment.type === 'dynamic' && attachment.fieldId && templateData) {
          // Get file URL from form submission data
          const fileData = templateData[attachment.fieldId];
          console.log('📎 Processing dynamic attachment from field:', attachment.fieldId, fileData);
          
          if (fileData) {
            // fileData could be a URL string or an array of file objects
            const fileUrls = Array.isArray(fileData) ? fileData : [fileData];
            
            for (const fileUrl of fileUrls) {
              const url = typeof fileUrl === 'string' ? fileUrl : fileUrl?.url;
              const name = typeof fileUrl === 'string' ? attachment.name : (fileUrl?.name || attachment.name);
              
              if (url && typeof url === 'string') {
                console.log('📎 Fetching dynamic attachment:', url);
                const response = await fetch(url);
                if (response.ok) {
                  const arrayBuffer = await response.arrayBuffer();
                  attachments.push({
                    filename: name || 'attachment',
                    content: new Uint8Array(arrayBuffer),
                    contentType: response.headers.get('content-type') || 'application/octet-stream'
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error processing attachment:', error);
      }
    }
    
    console.log(`📎 Total attachments prepared: ${attachments.length}`);

    // Send email with all recipients (TO, CC, BCC) in a single email
    console.log(`📮 Sending email with TO: ${finalToRecipients.length}, CC: ${finalCcRecipients.length}, BCC: ${finalBccRecipients.length}`);
    const emailResults = [];
    
    // Create SMTP client
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
      // Prepare email payload with TO, CC, and BCC
      const emailPayload: any = {
        from: smtpConfig.from_name 
          ? `${smtpConfig.from_name} <${smtpConfig.from_email}>` 
          : smtpConfig.from_email,
        to: finalToRecipients.length > 0 ? finalToRecipients.join(', ') : undefined,
        cc: finalCcRecipients.length > 0 ? finalCcRecipients.join(', ') : undefined,
        bcc: finalBccRecipients.length > 0 ? finalBccRecipients.join(', ') : undefined,
        subject: processedSubject,
        content: processedTextContent || processedHtmlContent.replace(/<[^>]*>/g, ''),
        html: processedHtmlContent,
      };
      
      // Remove undefined fields
      if (!emailPayload.to) delete emailPayload.to;
      if (!emailPayload.cc) delete emailPayload.cc;
      if (!emailPayload.bcc) delete emailPayload.bcc;
      
      // Ensure at least one recipient exists
      if (!emailPayload.to && !emailPayload.cc && !emailPayload.bcc) {
        throw new Error('No recipients specified');
      }
      
      // If no TO but has CC/BCC, we need at least one TO recipient
      // Some SMTP servers require a TO field, so use the first CC as TO if needed
      if (!emailPayload.to && finalCcRecipients.length > 0) {
        emailPayload.to = finalCcRecipients[0];
        emailPayload.cc = finalCcRecipients.slice(1).join(', ') || undefined;
        if (!emailPayload.cc) delete emailPayload.cc;
      } else if (!emailPayload.to && finalBccRecipients.length > 0) {
        emailPayload.to = finalBccRecipients[0];
        emailPayload.bcc = finalBccRecipients.slice(1).join(', ') || undefined;
        if (!emailPayload.bcc) delete emailPayload.bcc;
      }
      
      console.log('📧 Email payload:', {
        from: emailPayload.from,
        to: emailPayload.to,
        cc: emailPayload.cc,
        bcc: emailPayload.bcc,
        subject: emailPayload.subject,
        hasHtml: !!emailPayload.html,
        attachmentCount: attachments.length
      });
      
      // Add attachments if any
      if (attachments.length > 0) {
        emailPayload.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }));
      }
      
      // Send email using SMTP
      await smtpClient.send(emailPayload);

      // Close connection after successful send
      await smtpClient.close();

      console.log(`✅ Email sent successfully`);
      
      // Log successful email for all recipients
      const allRecipients = [...finalToRecipients, ...finalCcRecipients, ...finalBccRecipients];
      for (const recipient of allRecipients) {
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
          trigger_context: {
            ...triggerContext,
            recipientType: finalToRecipients.includes(recipient) ? 'to' : 
                          finalCcRecipients.includes(recipient) ? 'cc' : 'bcc'
          },
        });

        emailResults.push({
          recipient,
          status: 'sent',
          type: finalToRecipients.includes(recipient) ? 'to' : 
                finalCcRecipients.includes(recipient) ? 'cc' : 'bcc'
        });
      }
    } catch (error: any) {
      console.error(`❌ Failed to send email:`, error);
      
      // Ensure connection is closed even on error
      await smtpClient.close().catch(() => {});
      
      // Log failed email
      const allRecipients = [...finalToRecipients, ...finalCcRecipients, ...finalBccRecipients];
      for (const recipient of allRecipients) {
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
