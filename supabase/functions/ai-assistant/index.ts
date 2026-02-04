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
  action: 'auto-fill' | 'suggest-routing' | 'analyze-content' | 'generate-summary' | 'natural-language-query' | 'generate-content' | 'chatbot-assist' | 'generate-formula' | 'generate-form' | 'suggest-workflow' | 'suggest-field-mappings' | 'suggest-chart';
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

      // NEW: Chatbot Assistant
      case 'chatbot-assist':
        temperature = 0.5;
        maxTokens = 1500;
        
        systemPrompt = `You are a helpful AI assistant for a form and workflow management system called TopsQill ITSM. Help users navigate and understand how to use forms, workflows, reports, and features.

Your capabilities:
- **Navigate users** to different sections of the application
- Explain how to submit forms and what each form is for
- Guide users through workflow processes
- Help users understand reports and dashboards
- Answer questions about form fields and requirements
- Provide step-by-step instructions for common tasks

**Navigation Commands**: When users want to go somewhere, provide a navigation link in this format:
- To go to forms: [Navigate to Forms](/forms)
- To go to a specific form: [Open Form Name](/forms/{formId}/view)
- To go to workflows: [Navigate to Workflows](/workflows)
- To go to reports: [Navigate to Reports](/reports)
- To go to dashboards: [Navigate to Dashboards](/dashboards)
- To go to email templates: [Navigate to Email Templates](/email-templates)
- To go to settings: [Navigate to Settings](/settings)
- To go to query builder: [Navigate to Query Builder](/query)

Available Forms in this project:
${JSON.stringify(context.availableForms || [], null, 2)}

Available Workflows:
${JSON.stringify(context.availableWorkflows || [], null, 2)}

Available Reports:
${JSON.stringify(context.availableReports || [], null, 2)}

Current Route: ${context.currentRoute || 'Unknown'}

Rules:
- Be helpful, clear, and concise
- Provide navigation links when users want to go somewhere
- If you don't know something, admit it and suggest alternatives
- Provide actionable guidance when possible
- Reference specific forms/workflows/reports by name when relevant
- Use markdown formatting for clarity (lists, bold, links, etc.)
- Help users understand how different parts of the system connect
- Suggest relevant features based on what the user is trying to accomplish`;

        // Build conversation history
        const chatMessages = context.chatHistory?.map(msg => ({
          role: msg.role,
          content: msg.content
        })) || [];
        
        userPrompt = context.userInput || '';
        
        // For chatbot, we'll include history in the request
        const chatResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatMessages,
              { role: 'user', content: userPrompt }
            ],
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          console.error('AI Gateway error:', chatResponse.status, errorText);
          
          if (chatResponse.status === 429) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'AI rate limit exceeded. Please try again in a few moments.' 
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          if (chatResponse.status === 402) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: 'AI credits exhausted. Please add credits to your Lovable workspace.' 
            }), {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          throw new Error(`AI Gateway error: ${chatResponse.status}`);
        }

        const chatData = await chatResponse.json();
        const chatContent = chatData.choices[0]?.message?.content;

        return new Response(JSON.stringify({ 
          success: true, 
          result: { message: chatContent } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

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
        temperature = 0.4;
        maxTokens = 3000;
        
        systemPrompt = `You are an expert form designer. Generate complete form schemas from natural language descriptions.

Rules:
- Create well-structured forms with appropriate field types
- Include validation rules where applicable
- Group related fields logically
- Consider user experience and flow
- Add helpful placeholders and tooltips
- For select/radio fields, include sensible options
- CRITICAL: You must ONLY use the exact field types listed below. Do NOT invent new types.

Available field types (use EXACTLY these values):
- text: Single line text input
- textarea: Multi-line text input
- number: Numeric input
- email: Email with validation
- phone: Phone number
- date: Date picker
- time: Time picker
- datetime: Date and time picker
- select: Dropdown selection
- multi-select: Multiple selection dropdown
- radio: Radio button group
- checkbox: Checkbox (for multiple options, use multiple checkboxes)
- toggle-switch: On/off toggle switch
- file: File upload
- image: Image upload
- signature: Signature capture
- rating: Star rating
- slider: Range slider
- header: Section header/title
- description: Help text or description
- horizontal-line: Visual separator
- section-break: Section break with title
- tags: Tag input
- country: Country selector
- address: Address input
- currency: Currency input
- url: URL input
- color: Color picker
- barcode: Barcode scanner`;

        userPrompt = `Generate a complete form schema based on this request:

Request: "${context.userInput}"
Purpose: ${context.formPurpose || 'General purpose form'}
Industry: ${context.industry || 'General'}

Return JSON with format:
{
  "name": "Suggested Form Name",
  "description": "Clear description of the form's purpose",
  "fields": [
    {
      "type": "field_type",
      "label": "Field Label",
      "required": true|false,
      "placeholder": "Helpful placeholder text",
      "tooltip": "Help text for users",
      "options": [{"value": "opt1", "label": "Option 1"}] // for select/radio/checkbox-group only
      "validation": {
        "min": number, // for number/slider
        "max": number,
        "minLength": number, // for text
        "maxLength": number,
        "pattern": "regex" // for text
      },
      "defaultValue": "optional default",
      "isFullWidth": true|false
    }
  ],
  "pages": [
    {
      "name": "Page Name",
      "description": "Page description",
      "fieldIndexes": [0, 1, 2] // indexes of fields on this page
    }
  ],
  "suggestedLayout": 1|2|3, // recommended column layout
  "estimatedCompletionTime": "5 minutes"
}`;
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
  "recordCount": 1,
  "initialStatus": "pending",
  "setSubmittedBy": "trigger_submitter",
  "fieldMappings": [
    { "sourceFieldId": "source_field", "targetFieldId": "target_field" }
  ]
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
Trigger Form: ${context.triggerForm.name}
Form ID: ${context.triggerForm.id}
Form Fields:
${JSON.stringify(context.triggerForm.fields?.map(f => ({ id: f.id, label: f.label, type: f.type })), null, 2)}` : ''}
${context.existingNodes?.length ? `
Existing Nodes to consider:
${JSON.stringify(context.existingNodes, null, 2)}` : ''}

IMPORTANT: 
- Use the actual field IDs and form ID from above in your configurations
- For condition nodes, reference actual field IDs and labels
- Ensure every node except "end" has proper connections
- Condition nodes MUST have both "true" and "false" connections

Return a valid JSON object:
{
  "name": "Descriptive Workflow Name",
  "description": "What this workflow accomplishes",
  "nodes": [
    {
      "type": "start|action|condition|wait|end",
      "label": "Unique Node Label",
      "description": "What this step does",
      "config": { /* node-specific config as defined above */ },
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
