import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FormField {
  id: string;
  type: string;
  label: string;
  options?: Array<{ id: string; value: string; label: string }>;
  required?: boolean;
}

interface AIRequest {
   action: 'auto-fill' | 'suggest-routing' | 'analyze-content' | 'generate-summary' | 'natural-language-query' | 'generate-content' | 'chatbot-assist' | 'chatbot-copilot' | 'generate-formula' | 'generate-form' | 'generate-form-update' | 'suggest-workflow' | 'suggest-field-mappings' | 'suggest-chart' | 'generate-report-component' | 'generate-sla-template' | 'generate-escalation-chain' | 'suggest-field-rules' | 'suggest-form-rules' | 'generate-email-template';
  context: {
    formFields?: FormField[];
    currentValues?: Record<string, any>;
    userInput?: string;
    formName?: string;
    formDescription?: string;
    submissionData?: Record<string, any>;
    query?: string;
    // Content generation
    contentType?: 'email_subject' | 'email_body' | 'form_description' | 'summary' | 'response';
    contentContext?: string;
    tone?: 'professional' | 'friendly' | 'formal' | 'casual';
    outputFormat?: 'html' | 'text'; // For email body - whether to generate HTML or plain text
    // Chatbot
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    availableForms?: Array<{ id: string; name: string; description?: string }>;
    availableWorkflows?: Array<{ id: string; name: string; description?: string }>;
    availableReports?: Array<{ id: string; name: string; description?: string }>;
    currentRoute?: string;
    // Formula builder
    formulaType?: 'calculated_field' | 'sql_query' | 'filter_expression';
    availableFields?: Array<{ id: string; label: string; type: string }>;
    selectedFormId?: string;
    selectedFormName?: string;
    // Form generation
    formPurpose?: string;
    industry?: string;
    // Workflow suggestions
    workflowGoal?: string;
    triggerForm?: { id: string; name: string; fields: Array<{ id: string; label: string; type: string }> };
    existingNodes?: Array<{ id: string; type: string; label: string }>;
    // Data feed mapping
    sourceFields?: Array<{ id: string; label: string; type: string }>;
    targetFields?: Array<{ id: string; label: string; type: string }>;
    sourceFormName?: string;
    targetFormName?: string;
    // Chart suggestions
    formData?: Array<Record<string, any>>;
    existingCharts?: Array<{ type: string; dimensions: string[]; metrics: string[] }>;
    // Rule generation
    existingFieldRules?: Array<{ name: string; targetField: string; action: string }>;
    // SLA generation (industry already declared above)
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { action, context }: AIRequest = await req.json();

    let systemPrompt = '';
    let userPrompt = '';
    let maxTokens = 1000;
    let temperature = 0.3;

    switch (action) {
      case 'auto-fill':
        systemPrompt = `You are an intelligent form assistant. Based on the user's input and the form fields available, suggest appropriate values for form fields.
        
Rules:
- Only suggest values for fields that are relevant to the user's input
- For select/radio fields, only choose from available options
- Return a JSON object with field IDs as keys and suggested values
- Be conservative - only fill fields you're confident about
- Consider the context of the form (name, description) when making suggestions`;

        userPrompt = `Form: ${context.formName || 'Unknown Form'}
Description: ${context.formDescription || 'No description'}

Available Fields:
${JSON.stringify(context.formFields?.map(f => ({
  id: f.id,
  label: f.label,
  type: f.type,
  options: f.options?.map(o => o.label),
  required: f.required
})), null, 2)}

Current Values:
${JSON.stringify(context.currentValues || {}, null, 2)}

User Input: "${context.userInput}"

Based on the user's input, suggest appropriate values for the form fields. Return ONLY a valid JSON object with field IDs as keys and suggested values. For select fields, use the exact option value.`;
        break;

      case 'suggest-routing':
        systemPrompt = `You are an intelligent ticket routing assistant. Analyze the submission content and suggest the most appropriate team or department to handle this request.

Rules:
- Analyze keywords, sentiment, and context
- Suggest a primary team and optionally a backup team
- Provide a confidence score (0-100)
- Explain your reasoning briefly`;

        userPrompt = `Form: ${context.formName}
Submission Data:
${JSON.stringify(context.submissionData, null, 2)}

Analyze this submission and suggest which team should handle it. Return JSON with format:
{
  "primaryTeam": "team name",
  "backupTeam": "team name or null",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;
        break;

      case 'analyze-content':
        systemPrompt = `You are a content analysis assistant. Analyze the provided content and extract key information.

Rules:
- Identify sentiment (positive, neutral, negative)
- Extract key topics and entities
- Identify urgency level (low, medium, high, critical)
- Suggest relevant tags`;

        userPrompt = `Content to analyze:
${JSON.stringify(context.submissionData, null, 2)}

Analyze this content and return JSON with format:
{
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high|critical",
  "topics": ["topic1", "topic2"],
  "entities": ["entity1", "entity2"],
  "suggestedTags": ["tag1", "tag2"],
  "summary": "brief one-line summary"
}`;
        break;

      case 'generate-summary':
        systemPrompt = `You are a summarization assistant. Create concise, informative summaries of form submissions.

Rules:
- Keep summaries under 100 words
- Highlight the most important information
- Use bullet points for key details
- Include any action items or next steps if apparent`;

        userPrompt = `Form: ${context.formName}
Submission Data:
${JSON.stringify(context.submissionData, null, 2)}

Generate a concise summary of this submission.`;
        break;

      case 'natural-language-query':
        systemPrompt = `You are a query assistant that helps users search and filter form data. Convert natural language queries into structured filters.

Rules:
- Understand common query patterns like "show me", "find", "filter by", "where", "with", "that have"
- Match user terms to field labels (case-insensitive, partial match OK)
- Extract field names, operators, and values accurately
- Support all operator types for comprehensive filtering
- For date filters, use relative terms like "today", "yesterday", "last week", "last month", or ISO dates
- For "between" operator, format value as "start,end" (e.g., "2024-01-01,2024-01-31" or "10,100")
- For "in" operator, format value as comma-separated list (e.g., "pending,approved,review")

Available operators:
- equals: exact match
- not_equals: does not match
- contains: text contains substring
- not_contains: text does not contain
- starts_with: text starts with
- ends_with: text ends with
- greater_than: numeric/date greater than
- less_than: numeric/date less than
- greater_than_or_equal: numeric >=
- less_than_or_equal: numeric <=
- between: within range (value format: "start,end")
- is_empty: field has no value
- is_not_empty: field has a value
- in: value is one of (value format: "val1,val2,val3")
- not_in: value is not one of`;

        userPrompt = `Available form fields:
${JSON.stringify(context.formFields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}

User query: "${context.query}"

Convert this query to a structured filter. Return JSON with format:
{
  "filters": [
    { "fieldId": "field_id", "operator": "equals|not_equals|contains|not_contains|starts_with|ends_with|greater_than|less_than|greater_than_or_equal|less_than_or_equal|between|is_empty|is_not_empty|in|not_in", "value": "value" }
  ],
  "sortBy": "field_id or null",
  "sortOrder": "asc|desc",
  "interpretation": "what you understood from the query"
}

Examples:
- "show pending or approved requests" → operator: "in", value: "pending,approved"
- "created between Jan 1 and Jan 31" → operator: "between", value: "2024-01-01,2024-01-31"
- "records with no email" → operator: "is_empty"
- "status not equal to rejected" → operator: "not_equals", value: "rejected"
- "priority is high or critical" → operator: "in", value: "high,critical"`;
        break;

      // NEW: Content Generation
      case 'generate-content':
        temperature = 0.7; // More creative for content generation
        maxTokens = 2000;
        
        const toneGuide = {
          professional: 'Use professional, business-appropriate language. Be clear, concise, and respectful.',
          friendly: 'Use warm, approachable language. Be helpful and personable while remaining professional.',
          formal: 'Use formal, official language. Maintain a serious and authoritative tone.',
          casual: 'Use relaxed, conversational language. Be natural and easygoing.'
        };

        systemPrompt = `You are an expert content writer for business applications. Generate high-quality content based on the user's request.

Tone: ${toneGuide[context.tone || 'professional']}

Rules:
- Write clear, well-structured content
- Be concise but comprehensive
- Use appropriate formatting (paragraphs, bullet points when helpful)
- Tailor content to the specific type requested
- Include placeholders like {{variable_name}} for dynamic content where appropriate`;

        switch (context.contentType) {
          case 'email_subject':
            userPrompt = `Generate an email subject line.

Context: ${context.contentContext || 'General email'}
User Request: "${context.userInput}"

Generate 3 subject line options. Return JSON:
{
  "subjects": ["Subject 1", "Subject 2", "Subject 3"],
  "recommended": "The best subject line from the options"
}`;
            break;
          case 'email_body':
            const isHtmlFormat = context.outputFormat === 'html';
            userPrompt = `Generate an email body${isHtmlFormat ? ' in HTML format' : ' as plain text'}.

Context: ${context.contentContext || 'General email'}
User Request: "${context.userInput}"
Output Format: ${isHtmlFormat ? 'HTML' : 'Plain Text'}

${isHtmlFormat 
  ? `Generate a complete HTML email body with proper HTML structure including:
- Use semantic HTML tags (<p>, <h1>, <h2>, <ul>, <li>, <strong>, <em>, etc.)
- Use inline CSS styles for formatting
- Create visually appealing email layout
- You may include placeholders like {{recipient_name}}, {{sender_name}}, etc. for personalization.`
  : `Generate a plain text email body:
- Use simple text formatting
- Use line breaks for paragraphs
- Use dashes or asterisks for bullet points
- You may include placeholders like {{recipient_name}}, {{sender_name}}, etc. for personalization.`}

Return JSON: { "text": "the email body content" }`;
            break;
          case 'form_description':
            userPrompt = `Generate a form description.

Form Name: ${context.formName || 'Form'}
Context: ${context.contentContext || 'General form'}
User Request: "${context.userInput}"

Generate a clear, helpful description for this form that explains its purpose and provides guidance for users filling it out.`;
            break;
          case 'summary':
            userPrompt = `Generate a summary.

Content to summarize:
${context.contentContext || context.userInput}

Generate a concise, informative summary highlighting key points.`;
            break;
          case 'response':
            userPrompt = `Draft a response.

Original message/context: ${context.contentContext || 'N/A'}
User Request: "${context.userInput}"

Generate an appropriate response that addresses the context provided.`;
            break;
          default:
            userPrompt = `Generate content based on:

Context: ${context.contentContext || 'General content'}
Request: "${context.userInput}"

Generate appropriate content for this request.`;
        }
        break;

      // NEW: Chatbot Assistant with Tool Calling
      case 'chatbot-assist': {
        temperature = 0.4;
        maxTokens = 2000;
        
        // Build enriched form context with fields
        const formsWithFields = (context.availableForms || []).map((f: any) => {
          const fields = f.fields || [];
          return {
            id: f.id,
            name: f.name,
            description: f.description,
            fields: fields.map((field: any) => ({
              id: field.id,
              label: field.label,
              type: field.type,
              options: field.options?.map((o: any) => o.label || o.value).slice(0, 10),
              required: field.required
            }))
          };
        });

        const copilotSystemPrompt = `You are a helpful AI Copilot for TopSqill BPM - a form and workflow management system.

## Your Capabilities:
1. **Navigate** users to pages using markdown links like [Go to Forms](/forms)
2. **Execute actions** by calling the provided tools
3. **Explain** features and guide users

## Navigation Links:
- Forms: [Navigate to Forms](/forms)
- Specific form: [Open Form](/form-edit/{formId})
- Workflows: [Navigate to Workflows](/workflows)
- Reports: [Navigate to Reports](/reports)
- SLA: [View SLA](/sla-management)
- Dashboards: [View Dashboard](/dashboard-view/{dashboardId})
- Query: [Navigate to Query](/query)
- Email Templates: [View Email Templates](/email-templates)

## Available Forms (with their fields):
${JSON.stringify(formsWithFields, null, 2)}

## Available Workflows:
${JSON.stringify(context.availableWorkflows || [], null, 2)}

## Available Reports:
${JSON.stringify(context.availableReports || [], null, 2)}

## Current Route: ${context.currentRoute || 'Unknown'}

## Rules:
- When the user asks to CREATE something, use the appropriate tool
- When creating workflows, ALWAYS reference real form IDs and field labels from the context above
- For workflow conditions, use actual field IDs and values from the form's field options
- For email templates, generate COMPLETE professional content - never use placeholders like "content here"
- When linking forms to workflows, use the real form ID from the context
- Be concise and helpful. Use markdown for formatting.
- If user asks "how" to do something, explain without executing
- If user says "create/make/set up", execute the action via tools
- If the user asks to add/change/modify/rename/remove/move fields on a form already created in this conversation, use update_form (NOT create_form)
- Prefer the most recently created form in the conversation when updating unless the user names another form
- When the user specifies a page (by name like "Profile" or by order like "2nd page"), set targetPageName or targetPageIndex on update_form
- For updates, prefer the operations array with op=add|update|rename|remove|move and full field props (options, required, validation, defaultValue, placeholder, isFullWidth)
- If the user names a page that may not exist yet, still set pageName / pagesToAdd so the app can create it
- For layout requests (2-column / 3-column), set layoutColumns on update_form`;

        // Define tools for structured output
        const copilotTools = [
          {
            type: "function",
            function: {
              name: "create_form",
              description: "Create a brand-new form with fields. Do NOT use this when the user wants to change/add fields on an existing form from the current chat — use update_form instead.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Form name" },
                  description: { type: "string", description: "Form description" },
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["text", "textarea", "number", "email", "phone", "date", "time", "datetime", "select", "multi-select", "radio", "checkbox", "toggle-switch", "file", "image", "signature", "rating", "slider", "header", "description", "horizontal-line", "section-break", "tags", "country", "address", "currency", "url", "color", "user-picker", "barcode", "ip-address", "geo-location"] },
                        label: { type: "string" },
                        required: { type: "boolean" },
                        placeholder: { type: "string" },
                        tooltip: { type: "string" },
                        defaultValue: { type: "string" },
                        isFullWidth: { type: "boolean" },
                        validation: { type: "object" },
                        options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } }
                      },
                      required: ["type", "label", "required"]
                    }
                  },
                  pages: {
                    type: "array",
                    description: "Optional multi-page layout. Each page contains fieldIndexes referencing the fields array. Use for forms with 8+ fields or distinct sections.",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Page title e.g. 'Personal Info'" },
                        description: { type: "string" },
                        fieldIndexes: { type: "array", items: { type: "integer" }, description: "Zero-based indexes into the fields array" }
                      },
                      required: ["name", "fieldIndexes"]
                    }
                  }
                },
                required: ["name", "description", "fields"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_form",
              description: "Update an EXISTING form: add/update/rename/remove/move fields, create pages, change layout. Never create a duplicate form. Prefer operations[] with op set. If the user names a page (e.g. Profile / 2nd page), set targetPageName/targetPageIndex or per-field pageName.",
              parameters: {
                type: "object",
                properties: {
                  formId: { type: "string", description: "ID of the existing form to update (from available forms or the form created earlier in this chat)" },
                  targetPageName: { type: "string", description: "Default page name for adds, e.g. Profile (created if missing)" },
                  targetPageIndex: { type: "integer", description: "1-based page index when user says 2nd page / page 2" },
                  layoutColumns: { type: "integer", enum: [1, 2, 3], description: "Form column layout when user asks for 1/2/3 columns" },
                  pagesToAdd: {
                    type: "array",
                    description: "New pages to create by name",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["name"]
                    }
                  },
                  operations: {
                    type: "array",
                    description: "Preferred rich field operations",
                    items: {
                      type: "object",
                      properties: {
                        op: { type: "string", enum: ["add", "update", "rename", "remove", "move"] },
                        type: { type: "string", enum: ["text", "textarea", "number", "email", "phone", "date", "time", "datetime", "select", "multi-select", "radio", "checkbox", "toggle-switch", "file", "image", "signature", "rating", "slider", "header", "description", "horizontal-line", "section-break", "tags", "country", "address", "currency", "url", "color", "user-picker", "barcode", "ip-address", "geo-location"] },
                        label: { type: "string", description: "Field label (new label for add; current or new for update)" },
                        currentLabel: { type: "string", description: "Existing field label to match for update/rename/remove/move" },
                        newLabel: { type: "string", description: "New label when renaming" },
                        required: { type: "boolean" },
                        placeholder: { type: "string" },
                        tooltip: { type: "string" },
                        defaultValue: { type: "string" },
                        isFullWidth: { type: "boolean" },
                        validation: { type: "object" },
                        pageName: { type: "string" },
                        pageIndex: { type: "integer" },
                        targetPageName: { type: "string", description: "Destination page for move" },
                        targetPageIndex: { type: "integer" },
                        options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } }
                      },
                      required: ["label"]
                    }
                  },
                  fields: {
                    type: "array",
                    description: "Legacy: fields to add/update (prefer operations). Same shape as operations without requiring op.",
                    items: {
                      type: "object",
                      properties: {
                        op: { type: "string", enum: ["add", "update", "rename", "remove", "move"] },
                        type: { type: "string", enum: ["text", "textarea", "number", "email", "phone", "date", "time", "datetime", "select", "multi-select", "radio", "checkbox", "toggle-switch", "file", "image", "signature", "rating", "slider", "header", "description", "horizontal-line", "section-break", "tags", "country", "address", "currency", "url", "color", "user-picker", "barcode", "ip-address", "geo-location"] },
                        label: { type: "string" },
                        currentLabel: { type: "string" },
                        newLabel: { type: "string" },
                        required: { type: "boolean" },
                        placeholder: { type: "string" },
                        tooltip: { type: "string" },
                        defaultValue: { type: "string" },
                        isFullWidth: { type: "boolean" },
                        validation: { type: "object" },
                        pageName: { type: "string", description: "Optional page name for this field (created if missing)" },
                        pageIndex: { type: "integer", description: "Optional 1-based page index for this field" },
                        targetPageName: { type: "string" },
                        targetPageIndex: { type: "integer" },
                        options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } }
                      },
                      required: ["label"]
                    }
                  }
                },
                required: ["formId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_workflow",
              description: "Create a workflow with nodes triggered by a form submission. You MUST provide triggerFormId from available forms and include at least start, action/condition, and end nodes.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  triggerFormId: { type: "string", description: "REQUIRED: ID of the form that triggers this workflow (from available forms)" },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tempId: { type: "string" },
                        type: { type: "string", enum: ["start", "action", "condition", "wait", "end"] },
                        label: { type: "string" },
                        config: { type: "object" },
                        connections: { type: "array", items: { type: "object", properties: { to: { type: "string" }, sourceHandle: { type: "string" }, conditionType: { type: "string" } }, required: ["to"] } }
                      },
                      required: ["tempId", "type", "label", "config"]
                    }
                  }
                },
                required: ["name", "description", "triggerFormId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_form_with_workflow",
              description: "Create a form AND a linked workflow together. Best for requests like 'create a leave request form with approval workflow'.",
              parameters: {
                type: "object",
                properties: {
                  formName: { type: "string" },
                  formDescription: { type: "string" },
                  fields: { type: "array", items: { type: "object", properties: { type: { type: "string" }, label: { type: "string" }, required: { type: "boolean" }, placeholder: { type: "string" }, options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } } }, required: ["type", "label", "required"] } },
                  workflowName: { type: "string" },
                  workflowDescription: { type: "string" },
                  workflowNodes: { type: "array", items: { type: "object", properties: { tempId: { type: "string" }, type: { type: "string" }, label: { type: "string" }, config: { type: "object" }, connections: { type: "array", items: { type: "object", properties: { to: { type: "string" } }, required: ["to"] } } }, required: ["tempId", "type", "label", "config"] } }
                },
                required: ["formName", "formDescription", "fields", "workflowName", "workflowNodes"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "trigger_workflow",
              description: "Trigger/start an existing workflow",
              parameters: {
                type: "object",
                properties: {
                  workflowId: { type: "string" },
                  triggerData: { type: "object" }
                },
                required: ["workflowId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_submission",
              description: "Create a new submission for a form",
              parameters: {
                type: "object",
                properties: {
                  formId: { type: "string" },
                  data: { type: "object" }
                },
                required: ["formId", "data"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_dashboard",
              description: "Create a new empty dashboard shell (no charts). Use only when the user explicitly asks for a dashboard, not a report/chart.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" }
                },
                required: ["name"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_report",
              description: "Create a report with a chart from form submission data. Requires a source form id and chart intent.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  formId: { type: "string", description: "Source form id from available forms context" }
                },
                required: ["name", "formId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "link_form_to_workflow",
              description: "Link an existing form to an existing workflow as a trigger",
              parameters: {
                type: "object",
                properties: {
                  formId: { type: "string" },
                  formName: { type: "string" },
                  workflowId: { type: "string" },
                  workflowName: { type: "string" }
                },
                required: []
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_email_template",
              description: "Create a standalone email template",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  subject: { type: "string" },
                  htmlContent: { type: "string", description: "Full professional HTML email body" },
                  recipientType: { type: "string", enum: ["submitter", "form_owner"] }
                },
                required: ["name", "subject", "htmlContent"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_form_with_email_template",
              description: "Create a form with automatic email notifications on submission",
              parameters: {
                type: "object",
                properties: {
                  formName: { type: "string" },
                  formDescription: { type: "string" },
                  fields: { type: "array", items: { type: "object", properties: { type: { type: "string" }, label: { type: "string" }, required: { type: "boolean" }, placeholder: { type: "string" }, options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } } }, required: ["type", "label", "required"] } },
                  emailTemplateName: { type: "string" },
                  emailSubject: { type: "string" },
                  emailBody: { type: "string", description: "Complete HTML email body" },
                  emailRecipientType: { type: "string", enum: ["submitter", "form_owner"] }
                },
                required: ["formName", "formDescription", "fields", "emailTemplateName", "emailSubject", "emailBody"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "get_sla_predictions",
              description: "Get AI-powered SLA breach predictions for current project",
              parameters: { type: "object", properties: {}, required: [] }
            }
          },
          {
            type: "function",
            function: {
              name: "get_form_stats",
              description: "Get submission statistics for a form",
              parameters: {
                type: "object",
                properties: { formId: { type: "string" } },
                required: ["formId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_submission_status",
              description: "Approve or reject a submission",
              parameters: {
                type: "object",
                properties: {
                  submissionId: { type: "string" },
                  status: { type: "string", enum: ["approved", "rejected"] },
                  notes: { type: "string" }
                },
                required: ["submissionId", "status"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_form_with_sla",
              description: "Create a form with SLA tracking attached",
              parameters: {
                type: "object",
                properties: {
                  formName: { type: "string" },
                  formDescription: { type: "string" },
                  fields: { type: "array", items: { type: "object", properties: { type: { type: "string" }, label: { type: "string" }, required: { type: "boolean" }, placeholder: { type: "string" }, options: { type: "array", items: { type: "object", properties: { value: { type: "string" }, label: { type: "string" } }, required: ["value", "label"] } } }, required: ["type", "label", "required"] } },
                  lifecycleFieldLabel: { type: "string" },
                  createNewSlaTemplate: { type: "boolean" },
                  newSlaConfig: { type: "object", properties: { name: { type: "string" }, warningThresholdHours: { type: "number" }, breachThresholdHours: { type: "number" } } },
                  createNewEscalationChain: { type: "boolean" },
                  newEscalationConfig: { type: "object" }
                },
                required: ["formName", "formDescription", "fields", "lifecycleFieldLabel"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "add_email_action_to_workflow",
              description: "Add an email notification node to an existing workflow",
              parameters: {
                type: "object",
                properties: {
                  workflowId: { type: "string" },
                  workflowName: { type: "string" },
                  emailTemplateName: { type: "string" },
                  actionLabel: { type: "string" },
                  createNewTemplate: { type: "boolean" },
                  newTemplateConfig: { type: "object", properties: { name: { type: "string" }, subject: { type: "string" }, htmlContent: { type: "string" } } }
                },
                required: []
              }
            }
          },
          {
            type: "function",
            function: {
              name: "link_form_to_sla",
              description: "Attach SLA tracking to an existing form",
              parameters: {
                type: "object",
                properties: {
                  formId: { type: "string" },
                  formName: { type: "string" },
                  lifecycleFieldLabel: { type: "string" },
                  slaTemplateName: { type: "string" },
                  escalationChainName: { type: "string" }
                },
                required: ["lifecycleFieldLabel"]
              }
            }
          }
        ];

        // Build conversation history
        const copilotChatMessages = context.chatHistory?.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })) || [];

        const copilotResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: copilotSystemPrompt },
              ...copilotChatMessages,
              { role: 'user', content: context.userInput || '' }
            ],
            temperature,
            max_tokens: maxTokens,
            tools: copilotTools,
          }),
        });

        if (!copilotResponse.ok) {
          const errorText = await copilotResponse.text();
          console.error('AI Gateway error:', copilotResponse.status, errorText);
          
          if (copilotResponse.status === 429) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'AI rate limit exceeded. Please try again in a few moments.' 
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          if (copilotResponse.status === 402) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'AI credits exhausted. Please add credits to your Lovable workspace.' 
            }), {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          throw new Error(`AI Gateway error: ${copilotResponse.status}`);
        }

        const copilotData = await copilotResponse.json();
        const copilotChoice = copilotData.choices[0];
        const copilotMessage = copilotChoice?.message;

        // Check if the AI wants to call a tool (return all tool calls, not just the first)
        if (copilotMessage?.tool_calls && copilotMessage.tool_calls.length > 0) {
          const parsedToolCalls = copilotMessage.tool_calls.map((toolCall: any) => {
            const functionName = toolCall.function?.name;
            let functionArgs: any = {};
            try {
              functionArgs = JSON.parse(toolCall.function?.arguments || '{}');
            } catch (e) {
              console.error('Failed to parse tool call arguments:', e);
            }
            console.log(`AI tool call: ${functionName}`, functionArgs);
            return { action: functionName, params: functionArgs };
          });

          return new Response(JSON.stringify({ 
            success: true, 
            result: { 
              message: copilotMessage.content || `I'll execute that for you now...`,
              toolCall: parsedToolCalls[0],
              toolCalls: parsedToolCalls,
            } 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // No tool call - just a text response
        return new Response(JSON.stringify({ 
          success: true, 
          result: { message: copilotMessage?.content || 'I could not generate a response.' } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // NEW: Formula/Query Builder
      case 'generate-formula':
        temperature = 0.2; // Lower temperature for precise formulas
        maxTokens = 1500;
        
        systemPrompt = `You are an expert at converting natural language into formulas, SQL queries, and filter expressions.

Available Fields:
${JSON.stringify(context.availableFields || [], null, 2)}

Rules:
- Generate syntactically correct expressions
- Use only the fields provided
- Explain what the formula does
- Provide alternatives when applicable
- For SQL, use standard SQL syntax compatible with PostgreSQL
- For calculated fields, use JavaScript-like expressions
- For filters, use the filter expression format`;

        switch (context.formulaType) {
          case 'calculated_field':
            userPrompt = `Convert this to a calculated field formula:

Request: "${context.userInput}"

Available fields (use these exact IDs in your formula):
${JSON.stringify(context.availableFields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}

Return JSON:
{
  "formula": "the formula expression using field IDs",
  "explanation": "what this formula calculates",
  "fieldReferences": ["field_id_1", "field_id_2"],
  "resultType": "number|string|boolean|date",
  "examples": [
    { "inputs": {"field_id": "value"}, "output": "result" }
  ]
}

Formula syntax:
- Field references: {field_id}
- Arithmetic: +, -, *, /, %
- Comparison: ==, !=, >, <, >=, <=
- Logical: &&, ||, !
- Functions: SUM(), AVG(), COUNT(), MAX(), MIN(), IF(condition, then, else), CONCAT(), DATEDIFF()
- String: UPPER(), LOWER(), TRIM(), SUBSTRING()`;
            break;
            
          case 'sql_query':
            userPrompt = `Convert this to a custom SQL-like query for querying form submissions.

Request: "${context.userInput}"

${context.selectedFormId ? `Target Form: ${context.selectedFormName || 'Unknown'} (ID: ${context.selectedFormId})` : 'No form selected - please specify the form context.'}

Available form fields:
${JSON.stringify(context.availableFields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}

The query system uses standard SQL syntax with these features:

**SELECT clause:**
- SELECT FIELD("field-id"), FIELD("another-field") FROM "form-id"
- SELECT DISTINCT FIELD("field-id") for unique values
- Aggregate functions: COUNT(*), COUNT(FIELD("id")), SUM(FIELD("amount")), AVG(FIELD("score")), MIN(FIELD("date")), MAX(FIELD("value"))
- Aliases: SELECT COUNT(*) AS total_count, AVG(FIELD("score")) AS avg_score

**WHERE clause:**
- Comparison: =, !=, <, >, <=, >=
- LIKE for pattern matching: WHERE FIELD("name") LIKE '%smith%'
- IN for multiple values: WHERE FIELD("status") IN ('pending', 'approved')
- BETWEEN for ranges: WHERE FIELD("amount") BETWEEN 100 AND 500
- IS NULL / IS NOT NULL
- AND, OR for combining conditions

**GROUP BY clause:**
- GROUP BY FIELD("category") - group results by a field
- GROUP BY FIELD("status"), FIELD("priority") - group by multiple fields
- Always use GROUP BY when using aggregate functions with non-aggregated fields

**HAVING clause (filter on aggregated results):**
- HAVING COUNT(*) > 5
- HAVING SUM(FIELD("amount")) >= 1000
- HAVING AVG(FIELD("score")) < 50

**ORDER BY clause:**
- ORDER BY FIELD("date") DESC
- ORDER BY FIELD("priority") ASC, FIELD("created_at") DESC
- ORDER BY COUNT(*) DESC - order by aggregate

**LIMIT and OFFSET:**
- LIMIT 10 - return first 10 results
- LIMIT 10 OFFSET 20 - pagination

**Functions:**
- String: UPPER(), LOWER(), CONCAT(), TRIM(), SUBSTRING()
- Date: NOW(), YEAR(), MONTH(), DAY(), DATE_TRUNC()
- System columns: submission_id, submitted_by, submitted_at, approval_status

Return JSON:
{
  "query": "the complete SQL query",
  "explanation": "what this query does in plain English",
  "parameters": ["any dynamic parameters"],
  "warnings": ["potential issues or performance considerations"]
}

Example queries:
- Simple: "SELECT FIELD(\\"name\\"), FIELD(\\"status\\") FROM \\"${context.selectedFormId || 'form-uuid'}\\" WHERE FIELD(\\"status\\") = 'active'"
- Aggregation with GROUP BY: "SELECT FIELD(\\"status\\"), COUNT(*) AS count FROM \\"${context.selectedFormId || 'form-uuid'}\\" GROUP BY FIELD(\\"status\\") ORDER BY count DESC"
- Complex: "SELECT FIELD(\\"category\\"), SUM(FIELD(\\"amount\\")) AS total, AVG(FIELD(\\"amount\\")) AS average FROM \\"${context.selectedFormId || 'form-uuid'}\\" WHERE FIELD(\\"date\\") >= '2024-01-01' GROUP BY FIELD(\\"category\\") HAVING SUM(FIELD(\\"amount\\")) > 1000 ORDER BY total DESC LIMIT 10"`;
            break;
            
          case 'filter_expression':
            userPrompt = `Convert this to a filter expression:

Request: "${context.userInput}"

Available fields:
${JSON.stringify(context.availableFields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}

Return JSON:
{
  "expression": "the filter expression",
  "conditions": [
    { "fieldId": "field_id", "operator": "equals|contains|greater_than|less_than|between|in", "value": "value" }
  ],
  "logic": "AND|OR",
  "explanation": "what this filter does"
}`;
            break;
            
          default:
            userPrompt = `Convert this natural language to a formula/expression:

Request: "${context.userInput}"

Available fields:
${JSON.stringify(context.availableFields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}

Return JSON:
{
  "formula": "the formula or expression",
  "type": "calculated_field|sql_query|filter_expression",
  "explanation": "what this does"
}`;
        }
        break;

      // NEW: Form Generation
      case 'generate-form':
        temperature = 0.5;
        maxTokens = 6000;
        
        systemPrompt = `You are an expert enterprise form designer who creates comprehensive, professional forms. Your goal is to generate THOROUGH forms that cover ALL aspects related to the topic — even from a short one-line prompt.

COMPREHENSIVENESS RULES (CRITICAL):
1. From even a brief prompt like "employee onboarding", you MUST infer and include ALL logically related fields. Think like a domain expert — what would a real-world version of this form include?
2. Always aim for 20-40+ data fields (plus structural fields like headers, descriptions, section-breaks). Short prompts should generate MORE fields, not fewer.
3. Think in categories: WHO (personal info, contacts), WHAT (details, specifics), WHEN (dates, timelines), WHERE (location, address), HOW (preferences, methods), WHY (reasons, justifications), ATTACHMENTS (documents, photos, signatures)
4. For every topic, consider: identification fields, contact fields, date fields, status/category fields, description/notes fields, approval fields, attachment fields, preference fields, emergency/backup fields
5. Use diverse field types — don't just use "text" for everything. Use email for emails, phone for phones, date for dates, currency for money, rating for satisfaction, select for categories, multi-select for multiple choices, toggle-switch for yes/no preferences, signature for sign-offs, file for attachments, country for nationality/location, address for addresses, tags for keywords

DESIGN PRINCIPLES:
1. ALWAYS start each logical section with a "header" field as a section title, followed by a "description" field for context when useful
2. Use "section-break" between major sections for clear visual separation
3. Use "horizontal-line" for subtle visual breaks within sections
4. Group related fields together logically (e.g., personal info, contact details, address)
5. Split into multiple pages (3-5 pages for comprehensive forms) with descriptive page names
6. Use 2-column layout for forms with many short fields, 1-column for complex fields
7. Mark only truly essential fields as required — don't over-require
8. Add meaningful placeholders showing expected format (e.g., "+91 98765 43210", "john.doe@company.com")
9. Add tooltips for fields that might confuse users
10. For select/radio fields, provide comprehensive real-world options (5-8 options)
11. Include validation rules: min/max for numbers, minLength/maxLength for text

STRUCTURAL FIELD USAGE:
- "header": Section titles creating visual hierarchy
- "description": Instructions or context after headers
- "section-break": Clear breaks between major sections
- "horizontal-line": Subtle dividers within a section

FIELD TYPE REFERENCE (use EXACTLY these values):
Layout/Display: header, description, section-break, horizontal-line
Text: text, textarea, email, url, phone, address
Numbers: number, slider, rating, currency
Date/Time: date, time, datetime
Selection: select, multi-select, radio, checkbox, toggle-switch
Media: file, image, signature
Special: tags, country, color, barcode

PAGE STRUCTURE:
- Page 1: Core/primary information
- Page 2: Details and specifics
- Page 3: Preferences and additional info
- Page 4: Documents, attachments, agreements
- Page 5: Review, sign-off, declarations
- Each page: 6-12 fields including structural elements
- Every page starts with a "header" field (NOT a section-break — never use section-break as the first field on any page, it creates an ugly gap at the top)`;

        userPrompt = `Generate a COMPREHENSIVE, professional form based on this request. Even if the prompt is short, infer ALL related fields a domain expert would include.

Request: "${context.userInput}"
Purpose: ${context.formPurpose || 'General purpose form'}
Industry: ${context.industry || 'General'}

IMPORTANT: 
- Generate 20-40+ data fields covering every aspect of the topic
- Use diverse field types (NOT just text — use email, phone, date, select, multi-select, toggle-switch, currency, rating, signature, file, country, address, tags, etc.)
- Create 3-5 pages with logical grouping
- Include structural elements (header, description, section-break, horizontal-line) for professional layout
- Think: What would a real company's version of this form look like? Include EVERYTHING.

Return JSON with this exact format:
{
  "name": "Professional Form Name",
  "description": "Clear description of the form's purpose and who should fill it",
  "fields": [
    {
      "type": "header",
      "label": "Section Title",
      "required": false
    },
    {
      "type": "description",
      "label": "Helpful instructions for this section",
      "required": false
    },
    {
      "type": "text",
      "label": "Field Label",
      "required": true,
      "placeholder": "e.g., John Doe",
      "tooltip": "Enter your full legal name as it appears on official documents",
      "validation": { "minLength": 2, "maxLength": 100 },
      "isFullWidth": false
    },
    {
      "type": "select",
      "label": "Department",
      "required": true,
      "options": [{"value": "engineering", "label": "Engineering"}, {"value": "hr", "label": "Human Resources"}]
    }
  ],
  "pages": [
    {
      "name": "Basic Information",
      "description": "Core details and primary information",
      "fieldIndexes": [0, 1, 2, 3]
    },
    {
      "name": "Additional Details",
      "description": "Secondary information and preferences",
      "fieldIndexes": [4, 5, 6, 7]
    }
  ],
  "suggestedLayout": 2,
  "estimatedCompletionTime": "5-8 minutes"
}

Remember:
- Start each section/page with a "header" field
- Add "description" fields for user guidance
- Use "horizontal-line" or "section-break" between groups
- Include realistic options for select/radio fields (4-6 minimum)
- Set isFullWidth: true for textarea, address, description, header, section-break, horizontal-line
- Set isFullWidth: false for short fields like text, email, phone, date, select in 2+ column layouts
- Include defaultValue when a sensible default exists`;
        break;

      case 'generate-form-update':
        temperature = 0.3;
        maxTokens = 4000;

        systemPrompt = `You are an expert form editor. Produce a MINIMAL incremental update plan for an EXISTING form. Do NOT regenerate the whole form.

Supported field ops:
- add: create a new field (include type, label, required, and rich props)
- update: change props on an existing field (match with currentLabel or label)
- rename: change label (currentLabel + newLabel)
- remove: delete a field (currentLabel or label)
- move: move a field to another page (currentLabel/label + targetPageName or targetPageIndex)

Rules:
1. Only include fields that must change to satisfy the user request
2. Use existing page names exactly when they match; if the user invents a new page name, put it in pagesToAdd and on the field pageName
3. Prefer diverse real field types (email, phone, date, select, multi-select, radio, checkbox, toggle-switch, currency, rating, signature, file, country, address, tags, user-picker, etc.)
4. For select/radio/multi-select, always include realistic options
5. Include validation, placeholder, tooltip, defaultValue, isFullWidth when relevant
6. Set layoutColumns only when the user asks for column layout (1, 2, or 3)
7. Set applyFieldRules=true only when the user asks for show/hide/enable/require when/if logic
8. Never invent unrelated fields

FIELD TYPE REFERENCE (exact values):
Layout/Display: header, description, section-break, horizontal-line
Text: text, textarea, email, url, phone, address
Numbers: number, slider, rating, currency
Date/Time: date, time, datetime
Selection: select, multi-select, radio, checkbox, toggle-switch
Media: file, image, signature
Special: tags, country, color, barcode, user-picker, ip-address, geo-location`;

        userPrompt = `Create an incremental update plan for this existing form.

Form: ${context.formName || 'Form'}
Description: ${context.formDescription || 'No description'}

Existing pages:
${JSON.stringify(context.existingPages || [], null, 2)}

Existing fields:
${JSON.stringify(context.formFields?.map((f: any) => ({
  id: f.id,
  label: f.label,
  type: f.type,
  required: f.required,
  options: f.options,
})) || [], null, 2)}

User request: "${context.userInput}"

Return JSON with this exact shape:
{
  "fields": [
    {
      "op": "add|update|rename|remove|move",
      "type": "select",
      "label": "Gender",
      "currentLabel": "optional existing label to match",
      "newLabel": "optional new label for rename",
      "required": false,
      "placeholder": "optional",
      "tooltip": "optional",
      "defaultValue": "optional",
      "isFullWidth": false,
      "validation": { "minLength": 1 },
      "options": [{"value": "male", "label": "Male"}, {"value": "female", "label": "Female"}],
      "pageName": "Profile",
      "pageIndex": 2,
      "targetPageName": "for move ops",
      "targetPageIndex": 2
    }
  ],
  "pagesToAdd": [{ "name": "Profile", "description": "optional" }],
  "layoutColumns": 2,
  "applyFieldRules": false,
  "summary": "Short description of the plan"
}

Omit pagesToAdd / layoutColumns / applyFieldRules when not needed. Keep fields array focused and small.`;
        break;

      // NEW: Workflow Suggestions
      case 'suggest-workflow':
        temperature = 0.3;
        maxTokens = 3000;
        
        systemPrompt = `You are an expert workflow automation designer. Create detailed workflow configurations that can be directly used.

CRITICAL: You MUST only use these EXACT node types (no others):
- start: Workflow entry point with trigger conditions
- action: Performs automated actions (send email, notification, change field values, create records)
- condition: Branch based on data (if/else logic) - ALWAYS has exactly 2 connections: "true" and "false"
- wait: Pause for time duration or until a date
- end: Workflow completion

FORBIDDEN types (do NOT use): form-assignment, notification, approval, email, trigger, branch, decision, delay, pause, stop, finish, complete.

=== NODE CONFIGURATION SCHEMAS ===

START NODE config:
{
  "triggerType": "form_submission" | "form_completion" | "rule_success" | "rule_failure" | "manual",
  "triggerFormId": "form_id_if_known",
  "triggerFormName": "Form Name"
}

ACTION NODE config (based on actionType):
For send_notification:
{
  "actionType": "send_notification",
  "notificationConfig": {
    "type": "email" | "in_app",
    "subject": "Email Subject",
    "message": "Email/notification body with {{field_name}} placeholders",
    "recipientConfig": {
      "type": "submitter" | "form_owner" | "specific_users" | "field_value",
      "specificEmails": ["email@example.com"],
      "fieldId": "email_field_id"
    }
  }
}

For change_field_value:
{
  "actionType": "change_field_value",
  "targetFormId": "form_id",
  "fieldUpdates": [
    { "fieldId": "status_field", "value": "approved", "valueType": "static" }
  ]
}

For create_record:
{
  "actionType": "create_record",
  "targetFormId": "target_form_id",
  "targetFormName": "Target Form Name",
  "recordCount": 1,
  "initialStatus": "pending",
  "setSubmittedBy": "trigger_submitter",
  "fieldMappings": [
    { "sourceFieldId": "source_field", "targetFieldId": "target_field" }
  ]
}

For create_linked_record (creates a record in a linked form via cross-reference field):
{
  "actionType": "create_linked_record",
  "crossReferenceFieldId": "cross_ref_field_id_in_trigger_form",
  "crossReferenceFieldName": "Cross Ref Field Label",
  "targetFormId": "linked_form_id",
  "targetFormName": "Linked Form Name",
  "recordCount": 1,
  "fieldConfigMode": "field_mapping" | "none",
  "fieldMappings": [
    { "sourceFieldId": "source_field", "targetFieldId": "target_field" }
  ],
  "setSubmittedBy": "trigger_submitter",
  "initialStatus": "pending"
}

For update_linked_records (updates existing records in a linked form via cross-reference):
{
  "actionType": "update_linked_records",
  "crossReferenceFieldId": "cross_ref_field_id_in_trigger_form",
  "crossReferenceFieldName": "Cross Ref Field Label",
  "targetFormId": "linked_form_id",
  "targetFormName": "Linked Form Name",
  "updateScope": "all" | "first" | "last",
  "fieldMappings": [
    { "sourceFieldId": "trigger_field_id", "targetFieldId": "linked_field_id" }
  ]
}

For create_combination_records (creates Cartesian product records from cross-ref selections):
{
  "actionType": "create_combination_records",
  "combinationMode": "single",
  "sourceCrossRefFieldId": "cross_ref_field_id",
  "sourceCrossRefFieldName": "Cross Ref Field Label",
  "sourceLinkedFormId": "linked_form_id",
  "sourceLinkedFormName": "Linked Form Name",
  "targetFormId": "destination_form_id",
  "targetFormName": "Destination Form Name",
  "initialStatus": "pending",
  "setSubmittedBy": "trigger_submitter"
}

CONDITION NODE config:
{
  "enhancedCondition": {
    "systemType": "field_level",
    "conditions": [
      {
        "id": "cond_1",
        "systemType": "field_level",
        "fieldLevelCondition": {
          "id": "flc_1",
          "formId": "form_id",
          "fieldId": "field_id",
          "fieldLabel": "Field Label",
          "fieldType": "text",
          "operator": "==" | "!=" | ">" | "<" | "contains" | "not_contains",
          "value": "comparison_value"
        }
      }
    ]
  }
}

WAIT NODE config:
{
  "waitType": "duration" | "until_date" | "until_event",
  "durationValue": 24,
  "durationUnit": "minutes" | "hours" | "days" | "weeks"
}

END NODE config:
{
  "endStatus": "completed" | "failed" | "cancelled",
  "summary": "Workflow completion description"
}

=== CONNECTION RULES ===
- Start node: exactly 1 connection to next node
- Action node: exactly 1 connection to next node
- Condition node: MUST have exactly 2 connections with "condition": "true" and "condition": "false"
- Wait node: exactly 1 connection to next node
- End node: no connections

Use the "connections" array to specify edges. Reference target nodes by their "label" field.`;

        userPrompt = `Design a complete workflow based on this goal:

Goal: "${context.workflowGoal || context.userInput}"
${context.triggerForm ? `
=== TRIGGER FORM (Primary) ===
Form Name: ${context.triggerForm.name}
Form ID: ${context.triggerForm.id}
Fields:
${JSON.stringify(context.triggerForm.fields?.map(f => ({ id: f.id, label: f.label, type: f.type, ...(f.options ? { options: f.options } : {}), ...(f.crossRefConfig ? { crossRefConfig: { targetFormId: f.crossRefConfig.targetFormId, targetFormName: f.crossRefConfig.targetFormName, targetFormFields: f.crossRefConfig.targetFormFields } } : {}) })), null, 2)}` : ''}
${context.additionalForms?.length ? `
=== ADDITIONAL FORMS (Available for actions like create_record, change_field_value) ===
${context.additionalForms.map(f => `
Form: ${f.name} (ID: ${f.id})
Fields:
${JSON.stringify(f.fields?.map(ff => ({ id: ff.id, label: ff.label, type: ff.type, ...(ff.options ? { options: ff.options } : {}), ...(ff.crossRefConfig ? { crossRefConfig: { targetFormId: ff.crossRefConfig.targetFormId, targetFormName: ff.crossRefConfig.targetFormName, targetFormFields: ff.crossRefConfig.targetFormFields } } : {}) })), null, 2)}
`).join('')}` : ''}
${context.existingNodes?.length ? `
Existing Nodes to consider:
${JSON.stringify(context.existingNodes, null, 2)}` : ''}

IMPORTANT: 
- Use the ACTUAL field IDs and form IDs from the forms provided above - DO NOT make up IDs
- For condition nodes, reference actual field IDs, labels, and for select/radio fields use the actual option values
- For send_notification actions, use {{field_label}} placeholders matching the actual field labels
- For change_field_value, use actual field IDs from the correct form
- For create_record, map source fields to target fields using actual IDs from both forms
- CROSS-REFERENCE ACTIONS: When fields have "crossRefConfig" property, they are cross-reference fields linked to other forms. USE these to suggest cross-ref actions:
  * create_linked_record: Use when the workflow should create new records in linked forms (use the crossRefConfig.targetFormId and the cross-ref field ID)
  * update_linked_records: Use when the workflow should update existing linked records
  * create_combination_records: Use when combining records across cross-ref selections
- Ensure every node except "end" has proper connections
- Condition nodes MUST have both "true" and "false" connections
- CRITICAL: Every node config MUST be COMPLETE with all required nested properties
- For action nodes with send_notification: MUST include full notificationConfig with type, subject, message, and recipientConfig
- For action nodes with change_field_value: MUST include targetFormId, targetFormName, targetFieldId, targetFieldName, staticValue/dynamicValuePath, and fieldUpdates array
- Do NOT return empty or partial configs - users should see meaningful node descriptions

Return a valid JSON object:
{
  "name": "Descriptive Workflow Name",
  "description": "What this workflow accomplishes",
  "nodes": [
    {
      "type": "start|action|condition|wait|end",
      "label": "Unique Node Label",
      "description": "What this step does",
      "config": { /* COMPLETE node-specific config with ALL required fields as defined above */ },
      "connections": [
        { "to": "Next Node Label", "condition": "true|false for condition nodes only" }
      ]
    }
  ],
  "suggestions": ["Additional recommendations"],
  "estimatedDuration": "Estimated time to complete"
}`;
        break;

      // NEW: Data Feed Field Mapping Suggestions
      case 'suggest-field-mappings':
        temperature = 0.2;
        maxTokens = 2000;
        
        systemPrompt = `You are an expert data integration specialist. Suggest optimal field mappings between source and target forms.

Rules:
- Match fields by semantic meaning, not just name similarity
- Consider data types compatibility
- Suggest transformations when needed
- Identify fields that likely correspond
- Flag fields that may need manual review
- Consider common field name variations (e.g., "name" = "full_name" = "customer_name")`;

        userPrompt = `Suggest field mappings between these forms:

Source Form: ${context.sourceFormName || 'Source'}
Source Fields:
${JSON.stringify(context.sourceFields, null, 2)}

Target Form: ${context.targetFormName || 'Target'}
Target Fields:
${JSON.stringify(context.targetFields, null, 2)}

${context.userInput ? `Additional Context: ${context.userInput}` : ''}

Return JSON with format:
{
  "mappings": [
    {
      "sourceFieldId": "source_field_id",
      "sourceFieldLabel": "Source Field Label",
      "targetFieldId": "target_field_id",
      "targetFieldLabel": "Target Field Label",
      "confidence": 0.0-1.0,
      "transformation": null | "uppercase" | "lowercase" | "trim" | "format_date" | "parse_number" | "custom",
      "transformationDetails": "optional explanation",
      "reason": "why these fields match"
    }
  ],
  "unmappedSourceFields": [
    { "fieldId": "id", "fieldLabel": "label", "suggestion": "why it wasn't mapped or what to do" }
  ],
  "unmappedTargetFields": [
    { "fieldId": "id", "fieldLabel": "label", "required": true|false, "suggestion": "how to handle this" }
  ],
  "warnings": ["any potential issues with the mappings"],
  "overallConfidence": 0.0-1.0
}`;
        break;

      // NEW: Chart/Report Suggestions
      case 'suggest-chart':
        temperature = 0.4;
        maxTokens = 2000;
        
        systemPrompt = `You are a data visualization expert. Suggest optimal chart configurations based on form data and fields.

Available chart types:
- bar: Best for comparing categories
- line: Best for trends over time
- area: Like line but emphasizes volume
- pie: Best for showing parts of a whole (limit to <7 segments)
- scatter: Best for showing correlations between two numeric values
- bubble: Like scatter but with a third dimension (size)
- table: Best for detailed data display

Aggregation types: count, sum, avg, min, max

Rules:
- Match chart type to data characteristics
- Suggest meaningful dimensions and metrics
- Consider data cardinality (too many categories = bad for pie)
- Time fields should typically be on X-axis for trends
- Numeric fields are good metrics
- Categorical fields are good dimensions`;

        userPrompt = `Suggest chart configurations for this form:

Form: ${context.selectedFormName || 'Form'}
Available Fields:
${JSON.stringify(context.availableFields, null, 2)}

${context.formData?.length ? `Sample Data (${context.formData.length} records):
${JSON.stringify(context.formData.slice(0, 5), null, 2)}` : ''}

${context.existingCharts?.length ? `Already Created Charts:
${JSON.stringify(context.existingCharts, null, 2)}` : ''}

${context.userInput ? `User Request: "${context.userInput}"` : 'Suggest the most insightful visualizations for this data.'}

Return JSON with format:
{
  "suggestions": [
    {
      "chartType": "bar|line|area|pie|scatter|bubble|table",
      "title": "Descriptive Chart Title",
      "description": "What insight this chart provides",
      "dimensions": ["field_id_for_grouping"],
      "metrics": ["field_id_for_measuring"],
      "aggregation": "count|sum|avg|min|max",
      "sortBy": "metric|dimension",
      "sortOrder": "asc|desc",
      "filters": [{ "fieldId": "id", "operator": "equals", "value": "value" }],
      "reasoning": "Why this visualization is useful",
      "priority": 1-5 // 1 = most recommended
    }
  ],
  "insights": [
    "Key observation about the data",
    "Recommended analysis approach"
  ],
  "warnings": ["Any data quality issues noticed"]
}`;
        break;

      // Generate Report Component from natural language
      case 'generate-report-component':
        temperature = 0.3;
        maxTokens = 2500;
        
        systemPrompt = `You are a report builder AI. Given a natural language prompt describing a chart, generate a complete chart configuration object.

Available chart types: bar, line, area, pie, donut, scatter, bubble, heatmap
Aggregation types: count, sum, avg, min, max
Filter operators: equals, not_equals, contains, not_contains, greater_than, less_than, greater_equal, less_equal, is_empty, is_not_empty
Color themes: default, vibrant, pastel, monochrome

There are TWO distinct chart modes:

1. **Compare Two Fields** (compareMode: true, aggregationEnabled: false):
   - Used when the user wants to plot two fields against each other (e.g., "compare Field A vs Field B")
   - Both metrics[0] and metrics[1] are field IDs representing the two fields to compare
   - No aggregation is applied — raw submission values are plotted directly
   - Best for scatter plots or when user says "compare", "X vs Y", "plot field A against field B"
   - dimensions should contain both field IDs

2. **Calculate Values** (compareMode: false, aggregationEnabled: true):
   - Used when the user wants to aggregate/summarize data (e.g., "count of Status", "sum of Amount by Category")
   - metrics[0] is the field to aggregate, dimensions[0] is the grouping field
   - aggregationType specifies how to aggregate (count, sum, avg, min, max)
   - The user MUST explicitly mention aggregation keywords (count, sum, average, total, etc.)

Rules:
- Use the exact field IDs provided for all field references
- DEFAULT to compareMode when user provides both X and Y axis fields WITHOUT mentioning aggregation
- Only set aggregationEnabled: true when user explicitly asks for count, sum, avg, min, max, or similar aggregation
- For pie/donut, always use aggregation mode
- For scatter, default to compare mode
- Drilldown levels should be an array of field IDs for hierarchical drill-down
- Only include filters if the user explicitly mentions filtering criteria
- Only include drilldown if the user mentions drill-down or hierarchy`;

        userPrompt = `Generate a chart configuration from this prompt:

Form: ${context.selectedFormName || 'Form'}
Form ID: ${context.selectedFormId || ''}

Available Fields (use these exact IDs):
${JSON.stringify(context.availableFields, null, 2)}

User Prompt: "${context.userInput}"

Return JSON with this exact format:
{
  "title": "Chart Title",
  "description": "Brief description of what this chart shows",
  "chartType": "bar|line|area|pie|donut|scatter|bubble|heatmap",
  "formId": "${context.selectedFormId || ''}",
  "compareMode": true or false,
  "aggregationEnabled": true or false,
  "metrics": ["field_id_1", "field_id_2_if_compare_mode"],
  "dimensions": ["field_id_for_grouping"],
  "aggregationType": "count|sum|avg|min|max (only when aggregationEnabled is true)",
  "metricAggregations": [{"field": "field_id", "aggregation": "count|sum|avg|min|max"}],
  "colorTheme": "default|vibrant|pastel|monochrome",
  "filters": [{ "field": "field_id", "operator": "equals", "value": "some_value" }],
  "drilldownConfig": {
    "enabled": false,
    "levels": ["field_id_level1", "field_id_level2"]
  },
  "maxDataPoints": 20,
  "reasoning": "Why this configuration matches the user's request. Explain if compare or calculate mode was chosen and why."
}

IMPORTANT: 
- Use the exact field IDs from the available fields list. Do not invent field IDs.
- If user says "X axis = FieldA, Y axis = FieldB" WITHOUT mentioning aggregation, use compareMode: true.
- If user says "count of FieldA" or "sum of FieldB grouped by FieldA", use aggregationEnabled: true.`;
        break;

      // NEW: SLA Template Generation
      case 'generate-sla-template':
        temperature = 0.4;
        maxTokens = 1500;
        
        const industryContextTemplate: Record<string, string> = {
          general: 'general business operations with standard response expectations',
          it_support: 'IT support/help desk with tiered priority levels (P1-P4), critical incidents requiring immediate response',
          customer_service: 'customer service with focus on first response time and resolution time',
          healthcare: 'healthcare with urgent patient-related matters requiring fast response',
          finance: 'financial services with regulatory compliance and audit requirements',
          manufacturing: 'manufacturing with equipment downtime and production impact considerations',
          hr: 'human resources with employee request and onboarding timelines',
          legal: 'legal services with court deadlines and client matter urgency'
        };
        
        systemPrompt = `You are an SLA configuration expert. Generate an SLA template based on user requirements.

Industry Context: ${industryContextTemplate[context.industry || 'general'] || 'general business'}

Rules:
- Warning time should typically be 50-75% of breach time
- Consider business hours for non-urgent items
- Priority multipliers: high priority = faster (0.5x), low priority = slower (1.5x)
- Business hours typically 9:00-17:00 unless specified
- Be realistic with timing based on industry standards`;

        userPrompt = `Create an SLA template based on this requirement:

"${context.userInput}"

Return a JSON object:
{
  "name": "Descriptive template name",
  "description": "What this SLA covers",
  "warning_hours": number (when to warn before breach),
  "breach_hours": number (when SLA is breached),
  "use_business_hours": boolean (count only business hours),
  "business_start_time": "HH:MM:SS" (if use_business_hours),
  "business_end_time": "HH:MM:SS" (if use_business_hours),
  "business_days": ["Monday", "Tuesday", ...] (if use_business_hours),
  "priority_multipliers": {
    "critical": 0.25,
    "high": 0.5,
    "medium": 1.0,
    "low": 1.5
  }
}`;
        break;

      // NEW: Escalation Chain Generation
      case 'generate-escalation-chain':
        temperature = 0.4;
        maxTokens = 1500;
        
        const industryContextChain: Record<string, string> = {
          general: 'standard business escalation from team to manager to director',
          it_support: 'IT escalation from L1 support through L2/L3 specialists to IT management',
          customer_service: 'customer service escalation from agent to supervisor to manager',
          healthcare: 'clinical escalation with urgency for patient safety',
          finance: 'financial services escalation with compliance officer involvement',
          manufacturing: 'production escalation from operator to supervisor to plant manager',
          hr: 'HR escalation from HR specialist to HR manager to HR director',
          legal: 'legal escalation from paralegal to associate to partner'
        };
        
        systemPrompt = `You are an escalation management expert. Generate an escalation chain based on user requirements.

Industry Context: ${industryContextChain[context.industry || 'general'] || 'standard business'}

Rules:
- L1 is typically immediate or within 1-2 hours of breach
- Each subsequent level adds more time (e.g., L2 at +4h, L3 at +8h, L4 at +24h)
- Higher levels should include more senior personnel
- Critical issues may skip levels or have faster escalation
- Consider notification methods appropriate for urgency`;

        userPrompt = `Create an escalation chain based on this requirement:

"${context.userInput}"

Return a JSON object:
{
  "name": "Descriptive chain name",
  "description": "What this escalation chain is for",
  "levels": [
    {
      "level": "L1",
      "hours_after_breach": 0,
      "send_email": true,
      "send_notification": true,
      "change_priority": false,
      "new_priority": null,
      "custom_message": "Optional notification message"
    },
    {
      "level": "L2",
      "hours_after_breach": 2,
      "send_email": true,
      "send_notification": true,
      "change_priority": true,
      "new_priority": "high",
      "custom_message": "Escalated - requires immediate attention"
    }
    // Add L3, L4 as needed
  ]
}

Generate between 2-4 levels based on the complexity described.`;
        break;

      // NEW: Field Rule Suggestions
      case 'suggest-field-rules':
        temperature = 0.4;
        maxTokens = 2500;
        
        systemPrompt = `You are a form logic expert. Generate field rules that control real-time UI behavior during form filling.

Available Field Actions:
- show: Show a hidden field
- hide: Hide a visible field
- enable: Enable a disabled field
- disable: Disable an enabled field
- require: Make a field required
- optional: Make a field optional
- setDefault: Set a default value for a field
- clearValue: Clear the field's current value
- filterOptions: Filter dropdown/radio options based on another field
- preventSubmit: Prevent form submission
- allowSubmit: Allow form submission

Available Operators:
- == : equals
- != : not equals
- < : less than
- > : greater than
- <= : less than or equal
- >= : greater than or equal
- contains : text contains
- not contains : text does not contain
- startsWith : text starts with
- endsWith : text ends with
- in : value is in list
- isEmpty : field is empty
- isNotEmpty : field is not empty

Rules:
- Use field IDs exactly as provided (they are UUIDs)
- Match operators to field types (numeric operators for numbers, text operators for text)
- Create meaningful rule names that describe the behavior
- The logicExpression uses condition numbers (1, 2, 3...) with AND, OR, NOT operators
- For simple single-condition rules, use "1" as the expression
- For complex rules, combine like "1 AND 2" or "1 OR (2 AND 3)"
- Only suggest rules that make logical sense for the form context`;

        userPrompt = `Generate field rules for this form based on the user's request:

Form: ${context.formName || 'Form'}
Description: ${context.formDescription || 'No description'}

Available Fields:
${JSON.stringify(context.formFields?.map(f => ({
  id: f.id,
  label: f.label,
  type: f.type,
  options: f.options?.map(o => ({ id: o.id, label: o.label })),
  required: f.required
})), null, 2)}

${context.existingFieldRules?.length ? `Existing Rules (avoid duplicates):
${JSON.stringify(context.existingFieldRules, null, 2)}` : ''}

User Request: "${context.userInput}"

Return JSON with format:
{
  "rules": [
    {
      "name": "Descriptive rule name",
      "targetFieldId": "field_uuid_to_affect",
      "targetFieldLabel": "Human readable label",
      "conditions": [
        {
          "fieldId": "condition_field_uuid",
          "fieldLabel": "Condition field label",
          "operator": "==|!=|<|>|<=|>=|contains|not contains|startsWith|endsWith|in|isEmpty|isNotEmpty",
          "value": "value_to_compare"
        }
      ],
      "logicExpression": "1" or "1 AND 2" or "1 OR (2 AND 3)",
      "action": "show|hide|enable|disable|require|optional|setDefault|clearValue|filterOptions|preventSubmit|allowSubmit",
      "actionValue": "optional value for setDefault or filterOptions",
      "explanation": "What this rule does in plain English"
    }
  ],
  "summary": "Brief summary of all rules generated",
  "suggestions": ["Additional rules that might be useful"]
}`;
        break;

      // NEW: Form Rule Suggestions
      case 'suggest-form-rules':
        temperature = 0.4;
        maxTokens = 2500;
        
        systemPrompt = `You are a form automation expert. Generate form rules that trigger actions upon form submission.

Available Form Actions:
- approve: Approve the submission
- reject: Reject the submission
- notify: Send an in-app notification
- sendEmail: Send an email notification
- startWorkflow: Start a workflow process
- assignForm: Assign to a user/team
- lockForm: Lock the form from further edits
- unlockForm: Unlock the form for editing
- redirect: Redirect after submission

Available Operators:
- == : equals
- != : not equals
- < : less than
- > : greater than
- <= : less than or equal
- >= : greater than or equal
- contains : text contains
- not contains : text does not contain
- startsWith : text starts with
- endsWith : text ends with
- in : value is in list
- isEmpty : field is empty
- isNotEmpty : field is not empty

Rules:
- Use field IDs exactly as provided (they are UUIDs)
- Form rules execute ONLY when the form is submitted
- Create meaningful rule names that describe the submission behavior
- The logicExpression uses condition numbers (1, 2, 3...) with AND, OR, NOT operators
- For approval workflows, consider common patterns like auto-approve/reject based on field values
- For notifications, consider who should be notified and when`;

        userPrompt = `Generate form rules (submission-triggered) for this form based on the user's request:

Form: ${context.formName || 'Form'}
Description: ${context.formDescription || 'No description'}

Available Fields:
${JSON.stringify(context.formFields?.map(f => ({
  id: f.id,
  label: f.label,
  type: f.type,
  options: f.options?.map(o => ({ id: o.id, label: o.label })),
  required: f.required
})), null, 2)}

${context.existingFormRules?.length ? `Existing Rules (avoid duplicates):
${JSON.stringify(context.existingFormRules, null, 2)}` : ''}

User Request: "${context.userInput}"

Return JSON with format:
{
  "rules": [
    {
      "name": "Descriptive rule name",
      "conditions": [
        {
          "fieldId": "condition_field_uuid",
          "fieldLabel": "Condition field label",
          "operator": "==|!=|<|>|<=|>=|contains|not contains|startsWith|endsWith|in|isEmpty|isNotEmpty",
          "value": "value_to_compare"
        }
      ],
      "logicExpression": "1" or "1 AND 2" or "1 OR (2 AND 3)",
      "action": "approve|reject|notify|sendEmail|startWorkflow|assignForm|lockForm|unlockForm|redirect",
      "actionValue": "optional value depending on action type",
      "explanation": "What this rule does in plain English"
    }
  ],
  "summary": "Brief summary of all rules generated",
  "suggestions": ["Additional rules that might be useful"]
}`;
        break;

      case 'generate-email-template':
        temperature = 0.7;
        maxTokens = 3000;
        
        const emailToneGuide = {
          professional: 'Use professional, business-appropriate language. Be clear, concise, and respectful.',
          friendly: 'Use warm, approachable language. Be helpful and personable while remaining professional.',
          formal: 'Use formal, official language. Maintain a serious and authoritative tone.',
          casual: 'Use relaxed, conversational language. Be natural and easygoing.'
        };

        systemPrompt = `You are an expert email template designer for business applications. You create complete, production-ready email templates with professional HTML content.

Tone: ${emailToneGuide[context.tone || 'professional']}

CRITICAL RULES:
1. Generate a complete email template with ALL required fields
2. The HTML content MUST be professional, visually appealing, and well-structured
3. Use inline CSS styles for email compatibility
4. Include placeholders using {{variable_name}} syntax where appropriate
5. Extract any email addresses mentioned as static recipients
6. If dynamic fields are mentioned (like "user's email field"), note them for dynamic recipients

HTML Best Practices:
- Use tables for layout (email-safe)
- Use inline CSS styles
- Include proper spacing and padding
- Use readable fonts (Arial, Helvetica, sans-serif)
- Include a header, body, and footer section
- Make it mobile-responsive with max-width containers`;

        userPrompt = `Generate a complete email template based on this description:

"${context.userInput}"

Return a JSON object with this EXACT structure:
{
  "name": "Template Name (clear, descriptive)",
  "description": "Brief description of what this template is for",
  "subject": "Email subject line (can include {{placeholders}})",
  "htmlContent": "Complete HTML email body with inline CSS styling. Make it professional and visually appealing.",
  "templateVariables": ["array", "of", "variable", "names", "used", "in", "content"],
  "recipients": {
    "to": [
      {"type": "static", "value": "email@example.com", "label": "Recipient Name"}
    ]
  }
}

IMPORTANT:
- htmlContent must be valid HTML with inline CSS
- templateVariables should list ALL {{placeholders}} used in subject and htmlContent
- recipients.to should include any static emails mentioned in the prompt
- If no specific emails mentioned, leave recipients.to as empty array
- Make the HTML visually professional with proper formatting, colors, and spacing`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Processing AI request: ${action}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI rate limit exceeded. Please try again in a few moments.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'AI credits exhausted. Please add credits to your Lovable workspace.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    console.log('AI response received successfully');

    // Try to parse JSON from the response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      // If not valid JSON, return as text
      result = { text: content };
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
