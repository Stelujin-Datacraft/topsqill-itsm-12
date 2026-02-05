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
   action: 'auto-fill' | 'suggest-routing' | 'analyze-content' | 'generate-summary' | 'natural-language-query' | 'generate-content' | 'chatbot-assist' | 'chatbot-copilot' | 'generate-formula' | 'generate-form' | 'suggest-workflow' | 'suggest-field-mappings' | 'suggest-chart' | 'generate-sla-template' | 'generate-escalation-chain' | 'suggest-field-rules' | 'suggest-form-rules';
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
    existingFormRules?: Array<{ name: string; action: string }>;
    // SLA generation
    industry?: string;
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
        
         systemPrompt = `You are a helpful AI Copilot for TopSqill BPM - a form and workflow management system. You can both HELP users and EXECUTE actions on their behalf.

 ## Your Capabilities:
 
 ### Navigation (always available):
 - To go to forms: [Navigate to Forms](/forms)
 - To go to a specific form: [Open Form Name](/form/{formId})
 - To go to workflows: [Navigate to Workflows](/workflows)
 - To go to reports: [Navigate to Reports](/reports)
 - To go to SLA predictions: [View SLA Predictions](/sla-management)
 - To view a specific dashboard: [View Dashboard Name](/dashboard-view/{dashboardId})
 - To go to query builder: [Navigate to Query Builder](/query)
 
 ### Executable Actions (when user asks you to DO something):
 When a user asks you to perform an action, respond with both a confirmation AND an action command.
 
 **Action Command Format**: [ACTION:action_name|param1=value1|param2=value2]
 
 **Available Actions**:
 1. **create_form** - Create a new form
    - Params: name (string), description (string), fields (JSON array of {type, label, required, placeholder})
    - Example: [ACTION:create_form|name=Customer Feedback|description=Collect customer feedback|fields=[{"type":"text","label":"Name","required":true},{"type":"textarea","label":"Feedback"}]]
 
 2. **trigger_workflow** - Start a workflow
    - Params: workflowId (string), triggerData (optional JSON)
    - Example: [ACTION:trigger_workflow|workflowId=abc123]
 
 3. **create_submission** - Create a form submission
    - Params: formId (string), data (JSON object with field values)
    - Example: [ACTION:create_submission|formId=xyz789|data={"name":"John","email":"john@test.com"}]
 
 4. **create_dashboard** - Create a new dashboard
    - Params: name (string), description (optional string)
    - Example: [ACTION:create_dashboard|name=Sales Overview|description=Weekly sales metrics]
 
 5. **create_workflow** - Create a new workflow
    - Params: name (string), description (optional string), triggerFormId (optional string), nodes (optional JSON array)
    - Example: [ACTION:create_workflow|name=Approval Process|description=Auto-approve requests|triggerFormId=form123]
 
 6. **create_form_with_workflow** - Create a form AND linked workflow in one action (RECOMMENDED for complex requests)
    - Params: formName, formDescription, fields (JSON array), workflowName, workflowDescription, workflowNodes (JSON array)
    - workflowNodes format: [{"tempId":"start","type":"start","label":"Start","connections":[{"to":"action1"}]},{"tempId":"action1","type":"action","label":"Send Notification","config":{"actionType":"notification"},"connections":[{"to":"end"}]},{"tempId":"end","type":"end","label":"End"}]
    - Node types: start, action, condition, wait, end
    - Example: [ACTION:create_form_with_workflow|formName=Leave Request|formDescription=Employee leave requests|fields=[{"type":"text","label":"Employee Name","required":true},{"type":"date","label":"Start Date","required":true},{"type":"date","label":"End Date","required":true},{"type":"textarea","label":"Reason"}]|workflowName=Leave Approval|workflowNodes=[{"tempId":"start","type":"start","label":"Start","connections":[{"to":"notify"}]},{"tempId":"notify","type":"action","label":"Notify Manager","config":{"actionType":"notification","message":"New leave request submitted"},"connections":[{"to":"end"}]},{"tempId":"end","type":"end","label":"End"}]]

 7. **get_sla_predictions** - Get AI-powered SLA breach predictions
    - No params needed
    - Example: [ACTION:get_sla_predictions]
 
 8. **get_form_stats** - Get submission statistics for a form
    - Params: formId (string)
    - Example: [ACTION:get_form_stats|formId=abc123]
 
 9. **update_submission_status** - Approve or reject a submission
    - Params: submissionId (string), status (approved/rejected), notes (optional string)
    - Example: [ACTION:update_submission_status|submissionId=sub123|status=approved|notes=Looks good]
 
 10. **create_form_with_sla** - Create a form with SLA tracking attached
     - Params: formName, formDescription, fields (JSON array), lifecycleFieldLabel (string), slaTemplateName (optional - to link existing), createNewSlaTemplate (boolean), newSlaConfig (JSON for new template), escalationChainName (optional), createNewEscalationChain (boolean), newEscalationConfig (JSON)
     - newSlaConfig format: {"name":"Template Name","warningThresholdHours":4,"breachThresholdHours":8,"businessHoursStart":"09:00","businessHoursEnd":"17:00"}
     - newEscalationConfig format: {"name":"Chain Name","levels":[{"level":"L1","hoursAfterBreach":2,"sendEmail":true}]}
     - Example: [ACTION:create_form_with_sla|formName=Support Ticket|formDescription=Customer support tickets|fields=[{"type":"text","label":"Subject","required":true},{"type":"textarea","label":"Description"}]|lifecycleFieldLabel=Status|createNewSlaTemplate=true|newSlaConfig={"name":"Support SLA","warningThresholdHours":2,"breachThresholdHours":4}]
 
 11. **create_form_with_email_template** - Create a form with email notifications
     - Params: formName, formDescription, fields (JSON array), emailTemplateName (string), emailSubject (string), emailBody (HTML string), emailRecipientType (submitter/form_owner), existingTemplateName (optional - to link existing)
     - Example: [ACTION:create_form_with_email_template|formName=Contact Form|formDescription=Customer inquiries|fields=[{"type":"text","label":"Name","required":true},{"type":"email","label":"Email","required":true}]|emailTemplateName=Contact Confirmation|emailSubject=Thank you for contacting us|emailBody=<p>We received your message and will respond shortly.</p>|emailRecipientType=submitter]
 
 12. **add_email_action_to_workflow** - Add an email notification node to an existing workflow
     - Params: workflowId OR workflowName (string), emailTemplateId OR emailTemplateName (string), actionLabel (optional string), createNewTemplate (boolean), newTemplateConfig (JSON)
     - Example: [ACTION:add_email_action_to_workflow|workflowName=Approval Process|emailTemplateName=Approval Notification|actionLabel=Send Approval Email]
 
 13. **link_form_to_workflow** - Link an existing form to an existing workflow as trigger
     - Params: formId OR formName (string), workflowId OR workflowName (string)
     - Example: [ACTION:link_form_to_workflow|formName=Leave Request|workflowName=Leave Approval]
 
 14. **link_form_to_sla** - Attach SLA tracking to an existing form
     - Params: formId OR formName (string), lifecycleFieldLabel (string), slaTemplateId OR slaTemplateName (string), escalationChainId OR escalationChainName (optional)
     - Example: [ACTION:link_form_to_sla|formName=Support Ticket|lifecycleFieldLabel=Status|slaTemplateName=Standard Support SLA|escalationChainName=Support Escalation]
 
 ## When to Execute Actions:
 - If user says "create a form for...", "make me a...", "set up a...", "start the workflow", etc. → Include the action command
 - If user wants BOTH a form AND workflow together (like "create a leave request form with approval workflow") → Use create_form_with_workflow
  - If user wants a form with SLA/deadline tracking → Use create_form_with_sla
  - If user wants a form with email notifications → Use create_form_with_email_template
  - If user wants to add email actions to an existing workflow → Use add_email_action_to_workflow
  - If user wants to link existing resources together → Use link_form_to_workflow or link_form_to_sla
 - If user just asks "how do I create a form?" → Explain but don't execute
 - If user asks "what are my SLA risks?" → Execute get_sla_predictions
 - Always confirm what you're about to do before the action command
 
  ## Linking Existing Resources:
  You can reference existing resources by NAME instead of ID. The system will look up the resource automatically.
  - "Link the Leave Request form to the Approval workflow" → [ACTION:link_form_to_workflow|formName=Leave Request|workflowName=Approval]
  - "Add email notifications using the Welcome Template to the Onboarding workflow" → [ACTION:add_email_action_to_workflow|workflowName=Onboarding|emailTemplateName=Welcome Template]

 ## Available Context:
 
 **Forms in this project:**
${JSON.stringify(context.availableForms || [], null, 2)}

 **Workflows:**
${JSON.stringify(context.availableWorkflows || [], null, 2)}

 **Reports:**
${JSON.stringify(context.availableReports || [], null, 2)}

 **Current Route:** ${context.currentRoute || 'Unknown'}

 ## Response Rules:
- Be helpful, clear, and concise
- Provide navigation links when users want to go somewhere
 - Include action commands when users want you to DO something
- If you don't know something, admit it and suggest alternatives
- Use markdown formatting for clarity (lists, bold, links, etc.)
 - For actions, always explain what you're about to do before the [ACTION:...] command
 - Be proactive - suggest relevant actions based on what user is trying to accomplish`;

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
- CRITICAL: Every node config MUST be COMPLETE with all required nested properties
- For action nodes with send_notification: MUST include full notificationConfig with type, subject, message, and recipientConfig
- For action nodes with change_field_value: MUST include targetFormId, targetFormName, targetFieldId, targetFieldName, staticValue/dynamicValuePath, and fieldUpdates array
- Do NOT return empty or partial configs - users should see meaningful node descriptions, not "Click to configure"

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
