import type { IntegrationDesign, FieldMappingSpec, DiscoveredField } from '../types/index';

export interface IAIProvider {
  generate(prompt: string, options?: Record<string, unknown>): Promise<string>;
  analyze(prompt: string, context?: Record<string, unknown>): Promise<unknown>;
  structuredOutput<T>(
    prompt: string,
    schemaDescription: string,
    options?: Record<string, unknown>,
  ): Promise<T>;
}

export interface IAssistant {
  analyzeRequirement(naturalLanguage: string): Promise<IntegrationDesign>;
  recommendArchitecture(design: IntegrationDesign): Promise<IntegrationDesign>;
  recommendLanguage(design: IntegrationDesign): Promise<{
    language: IntegrationDesign['language'];
    reason: string;
  }>;
  suggestMappings(input: {
    sourceFields: Array<{ name: string; label?: string; type?: string }>;
    targetFields: DiscoveredField[];
    design?: IntegrationDesign;
  }): Promise<FieldMappingSpec[]>;
  suggestTransformations(mappings: FieldMappingSpec[]): Promise<FieldMappingSpec[]>;
  validateIntegration(design: IntegrationDesign): Promise<{
    ok: boolean;
    issues: Array<{ severity: 'error' | 'warning'; code: string; message: string }>;
  }>;
  reviewIntegration(design: IntegrationDesign): Promise<{
    summary: string;
    recommendations: string[];
  }>;
}
