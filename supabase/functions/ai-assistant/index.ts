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
  action: 'auto-fill' | 'suggest-routing' | 'analyze-content' | 'generate-summary' | 'natural-language-query';
  context: {
    formFields?: FormField[];
    currentValues?: Record<string, any>;
    userInput?: string;
    formName?: string;
    formDescription?: string;
    submissionData?: Record<string, any>;
    query?: string;
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
        temperature: 0.3,
        max_tokens: 1000,
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
