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
  action: 'auto-fill' | 'suggest-routing' | 'analyze-content' | 'generate-summary' | 'natural-language-query' | 'generate-content' | 'chatbot-assist' | 'generate-formula';
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

The query system uses this syntax:
- SELECT FIELD("field-id") FROM "form-id" 
- WHERE FIELD("field-id") = 'value'
- Aggregate functions: COUNT(), SUM(), AVG(), MIN(), MAX()
- String functions: UPPER(), LOWER(), CONCAT(), TRIM()
- Date functions: NOW(), YEAR(), MONTH(), DAY()
- System columns: submission_id, submitted_by, submitted_at, approval_status

Return JSON:
{
  "query": "the SQL-like query using SELECT FIELD(...) FROM form-id syntax",
  "explanation": "what this query does",
  "parameters": ["any parameters that should be bound"],
  "warnings": ["any potential issues or considerations"]
}

Example queries:
- "SELECT FIELD(\\"name\\"), FIELD(\\"status\\") FROM \\"${context.selectedFormId || 'form-uuid'}\\" WHERE FIELD(\\"status\\") = 'active'"
- "SELECT COUNT(FIELD(\\"id\\")) FROM \\"${context.selectedFormId || 'form-uuid'}\\" WHERE FIELD(\\"priority\\") = 'high'"`;
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
