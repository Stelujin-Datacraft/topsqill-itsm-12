import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormField } from '@/types/form';
import { toast } from 'sonner';

interface AIAutoFillResult {
  [fieldId: string]: any;
}

interface AIRoutingResult {
  primaryTeam: string;
  backupTeam: string | null;
  confidence: number;
  reasoning: string;
}

interface AIAnalysisResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  topics: string[];
  entities: string[];
  suggestedTags: string[];
  summary: string;
}

interface AIQueryResult {
  filters: Array<{
    fieldId: string;
    operator: string;
    value: string;
  }>;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  interpretation: string;
}

interface AIContentResult {
  subjects?: string[];
  recommended?: string;
  text?: string;
}

interface AIChatbotResult {
  message: string;
}

interface AIFormulaResult {
  formula?: string;
  query?: string;
  expression?: string;
  explanation: string;
  type?: string;
  fieldReferences?: string[];
  resultType?: string;
  examples?: Array<{ inputs: Record<string, any>; output: string }>;
  conditions?: Array<{ fieldId: string; operator: string; value: string }>;
  logic?: string;
  parameters?: string[];
  warnings?: string[];
}

interface AIFormGenerationResult {
  name: string;
  description: string;
  fields: Array<{
    type: string;
    label: string;
    required: boolean;
    placeholder?: string;
    tooltip?: string;
    options?: Array<{ value: string; label: string }>;
    validation?: Record<string, any>;
    defaultValue?: string;
    isFullWidth?: boolean;
  }>;
  pages?: Array<{
    name: string;
    description?: string;
    fieldIndexes: number[];
  }>;
  suggestedLayout?: 1 | 2 | 3;
  estimatedCompletionTime?: string;
}

interface AIWorkflowSuggestionResult {
  name: string;
  description: string;
  nodes: Array<{
    type: string;
    label: string;
    description?: string;
    config: Record<string, any>;
    connections?: Array<{ to: string; condition?: string }>;
  }>;
  suggestions?: string[];
  estimatedDuration?: string;
}

interface AIFieldMappingResult {
  mappings: Array<{
    sourceFieldId: string;
    sourceFieldLabel: string;
    targetFieldId: string;
    targetFieldLabel: string;
    confidence: number;
    transformation?: string;
    transformationDetails?: string;
    reason: string;
  }>;
  unmappedSourceFields?: Array<{ fieldId: string; fieldLabel: string; suggestion?: string }>;
  unmappedTargetFields?: Array<{ fieldId: string; fieldLabel: string; required?: boolean; suggestion?: string }>;
  warnings?: string[];
  overallConfidence: number;
}

interface AIChartSuggestionResult {
  suggestions: Array<{
    chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'bubble' | 'table';
    title: string;
    description: string;
    dimensions: string[];
    metrics: string[];
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Array<{ fieldId: string; operator: string; value: string }>;
    reasoning: string;
    priority: number;
  }>;
  insights?: string[];
  warnings?: string[];
}

interface AIFieldRuleSuggestion {
  name: string;
  targetFieldId: string;
  targetFieldLabel: string;
  conditions: Array<{
    fieldId: string;
    fieldLabel: string;
    operator: string;
    value: string | string[] | number | boolean;
  }>;
  logicExpression: string;
  action: string;
  actionValue?: string | string[] | number | boolean;
  explanation: string;
}

interface AIFieldRuleSuggestionResult {
  rules: AIFieldRuleSuggestion[];
  summary: string;
  suggestions?: string[];
}

interface AIFormRuleSuggestion {
  name: string;
  conditions: Array<{
    fieldId: string;
    fieldLabel: string;
    operator: string;
    value: string | string[] | number | boolean;
  }>;
  logicExpression: string;
  action: string;
  actionValue?: string | any;
  explanation: string;
}

interface AIFormRuleSuggestionResult {
  rules: AIFormRuleSuggestion[];
  summary: string;
  suggestions?: string[];
}

export function useFormAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAI = useCallback(async (action: string, context: Record<string, any>) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', {
        body: { action, context }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'AI request failed');
      }

      return data.result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
      toast.error('AI Error', { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const autoFillForm = useCallback(async (
    formFields: FormField[],
    currentValues: Record<string, any>,
    userInput: string,
    formName?: string,
    formDescription?: string
  ): Promise<AIAutoFillResult | null> => {
    return callAI('auto-fill', {
      formFields: formFields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        options: f.options,
        required: f.required
      })),
      currentValues,
      userInput,
      formName,
      formDescription
    });
  }, [callAI]);

  const suggestRouting = useCallback(async (
    formName: string,
    submissionData: Record<string, any>
  ): Promise<AIRoutingResult | null> => {
    return callAI('suggest-routing', { formName, submissionData });
  }, [callAI]);

  const analyzeContent = useCallback(async (
    submissionData: Record<string, any>
  ): Promise<AIAnalysisResult | null> => {
    return callAI('analyze-content', { submissionData });
  }, [callAI]);

  const generateSummary = useCallback(async (
    formName: string,
    submissionData: Record<string, any>
  ): Promise<string | null> => {
    const result = await callAI('generate-summary', { formName, submissionData });
    return result?.text || result;
  }, [callAI]);

  const naturalLanguageQuery = useCallback(async (
    formFields: FormField[],
    query: string
  ): Promise<AIQueryResult | null> => {
    return callAI('natural-language-query', {
      formFields: formFields.map(f => ({
        id: f.id,
        label: f.label,
        type: f.type
      })),
      query
    });
  }, [callAI]);

  // NEW: Content Generation
  const generateContent = useCallback(async (
    contentType: 'email_subject' | 'email_body' | 'form_description' | 'summary' | 'response',
    userInput: string,
    options?: {
      contentContext?: string;
      tone?: 'professional' | 'friendly' | 'formal' | 'casual';
      formName?: string;
      outputFormat?: 'html' | 'text'; // For email body - HTML or plain text
    }
  ): Promise<AIContentResult | null> => {
    return callAI('generate-content', {
      contentType,
      userInput,
      contentContext: options?.contentContext,
      tone: options?.tone || 'professional',
      formName: options?.formName,
      outputFormat: options?.outputFormat || 'text'
    });
  }, [callAI]);

  // NEW: Chatbot Assistant
  const chatbotAssist = useCallback(async (
    userInput: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: {
      availableForms?: Array<{ id: string; name: string; description?: string }>;
      availableWorkflows?: Array<{ id: string; name: string; description?: string }>;
      availableReports?: Array<{ id: string; name: string; description?: string }>;
      currentRoute?: string;
    }
  ): Promise<AIChatbotResult | null> => {
    return callAI('chatbot-assist', {
      userInput,
      chatHistory,
      availableForms: options?.availableForms || [],
      availableWorkflows: options?.availableWorkflows || [],
      availableReports: options?.availableReports || [],
      currentRoute: options?.currentRoute
    });
  }, [callAI]);

  // NEW: Formula/Query Builder
  const generateFormula = useCallback(async (
    userInput: string,
    formulaType: 'calculated_field' | 'sql_query' | 'filter_expression',
    availableFields: Array<{ id: string; label: string; type: string }>,
    options?: {
      selectedFormId?: string;
      selectedFormName?: string;
    }
  ): Promise<AIFormulaResult | null> => {
    return callAI('generate-formula', {
      userInput,
      formulaType,
      availableFields,
      selectedFormId: options?.selectedFormId,
      selectedFormName: options?.selectedFormName
    });
  }, [callAI]);

  // NEW: Form Generation from natural language
  const generateForm = useCallback(async (
    userInput: string,
    options?: {
      formPurpose?: string;
      industry?: string;
    }
  ): Promise<AIFormGenerationResult | null> => {
    return callAI('generate-form', {
      userInput,
      formPurpose: options?.formPurpose,
      industry: options?.industry
    });
  }, [callAI]);

  // NEW: Workflow Suggestions
  const suggestWorkflow = useCallback(async (
    workflowGoal: string,
    options?: {
      triggerForm?: { id: string; name: string; fields: Array<{ id: string; label: string; type: string }> };
      existingNodes?: Array<{ id: string; type: string; label: string }>;
    }
  ): Promise<AIWorkflowSuggestionResult | null> => {
    return callAI('suggest-workflow', {
      workflowGoal,
      userInput: workflowGoal,
      triggerForm: options?.triggerForm,
      existingNodes: options?.existingNodes
    });
  }, [callAI]);

  // NEW: Data Feed Field Mapping Suggestions
  const suggestFieldMappings = useCallback(async (
    sourceFields: Array<{ id: string; label: string; type: string }>,
    targetFields: Array<{ id: string; label: string; type: string }>,
    options?: {
      sourceFormName?: string;
      targetFormName?: string;
      additionalContext?: string;
    }
  ): Promise<AIFieldMappingResult | null> => {
    return callAI('suggest-field-mappings', {
      sourceFields,
      targetFields,
      sourceFormName: options?.sourceFormName,
      targetFormName: options?.targetFormName,
      userInput: options?.additionalContext
    });
  }, [callAI]);

  // NEW: Chart/Report Suggestions
  const suggestCharts = useCallback(async (
    formFields: Array<{ id: string; label: string; type: string }>,
    options?: {
      formName?: string;
      formData?: Array<Record<string, any>>;
      existingCharts?: Array<{ type: string; dimensions: string[]; metrics: string[] }>;
      userRequest?: string;
    }
  ): Promise<AIChartSuggestionResult | null> => {
    return callAI('suggest-chart', {
      availableFields: formFields,
      selectedFormName: options?.formName,
      formData: options?.formData,
      existingCharts: options?.existingCharts,
      userInput: options?.userRequest
    });
  }, [callAI]);

  // NEW: Field Rule Suggestions
  const suggestFieldRules = useCallback(async (
    formFields: FormField[],
    userInput: string,
    options?: {
      formName?: string;
      formDescription?: string;
      existingRules?: Array<{ name: string; targetField: string; action: string }>;
    }
  ): Promise<AIFieldRuleSuggestionResult | null> => {
    return callAI('suggest-field-rules', {
      formFields: formFields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        options: f.options?.map(o => ({
          id: o.id || o.value,
          value: o.value,
          label: o.label
        })),
        required: f.required
      })),
      userInput,
      formName: options?.formName,
      formDescription: options?.formDescription,
      existingFieldRules: options?.existingRules
    });
  }, [callAI]);

  // NEW: Form Rule Suggestions
  const suggestFormRules = useCallback(async (
    formFields: FormField[],
    userInput: string,
    options?: {
      formName?: string;
      formDescription?: string;
      existingRules?: Array<{ name: string; action: string }>;
    }
  ): Promise<AIFormRuleSuggestionResult | null> => {
    return callAI('suggest-form-rules', {
      formFields: formFields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        options: f.options?.map(o => ({
          id: o.id || o.value,
          value: o.value,
          label: o.label
        })),
        required: f.required
      })),
      userInput,
      formName: options?.formName,
      formDescription: options?.formDescription,
      existingFormRules: options?.existingRules
    });
  }, [callAI]);

  // NEW: Generate field metadata (tooltips, placeholders, help text)
  const generateFieldMetadata = useCallback(async (
    formFields: FormField[],
    options?: {
      formName?: string;
      formDescription?: string;
    }
  ) => {
    return callAI('generate-field-metadata', {
      formFields: formFields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        tooltip: f.tooltip,
        options: f.options?.map(o => ({ label: o.label, value: o.value })),
        required: f.required
      })),
      formName: options?.formName,
      formDescription: options?.formDescription
    });
  }, [callAI]);

  // NEW: Summarize submission data
  const summarizeData = useCallback(async (
    formFields: FormField[],
    formName: string,
    sampleData: Array<Record<string, any>>,
    dataSummary: Record<string, any>,
    totalRecords: number
  ) => {
    return callAI('summarize-data', {
      formFields: formFields.map(f => ({ id: f.id, label: f.label, type: f.type })),
      formName,
      sampleData,
      dataSummary,
      totalRecords
    });
  }, [callAI]);

  // NEW: Detect anomalies in data
  const detectAnomalies = useCallback(async (
    formFields: FormField[],
    formName: string,
    sampleData: Array<Record<string, any>>,
    dataSummary: Record<string, any>,
    totalRecords: number
  ) => {
    return callAI('detect-anomalies', {
      formFields: formFields.map(f => ({ id: f.id, label: f.label, type: f.type })),
      formName,
      sampleData,
      dataSummary,
      totalRecords
    });
  }, [callAI]);

  return {
    isLoading,
    error,
    autoFillForm,
    suggestRouting,
    analyzeContent,
    generateSummary,
    naturalLanguageQuery,
    generateContent,
    chatbotAssist,
    generateFormula,
    // New AI capabilities
    generateForm,
    suggestWorkflow,
    suggestFieldMappings,
    suggestCharts,
    suggestFieldRules,
    suggestFormRules,
    generateFieldMetadata,
    summarizeData,
    detectAnomalies
  };
}
