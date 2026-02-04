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

  return {
    isLoading,
    error,
    autoFillForm,
    suggestRouting,
    analyzeContent,
    generateSummary,
    naturalLanguageQuery
  };
}
