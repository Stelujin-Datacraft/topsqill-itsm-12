import type {
  ClarificationAnswers,
  ClarificationResult,
  DesignValidationReport,
  DiscoveredField,
  DryRunResult,
  FieldMappingSpec,
  IntegrationDesign,
} from '../types/index';

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
  /** Phase 2 — ask only when critical details are missing. */
  clarifyRequirement?(
    naturalLanguage: string,
  ): Promise<ClarificationResult | { needsClarification: false }>;
  /** Phase 2 — merge answers then analyze. */
  analyzeWithClarifications?(
    naturalLanguage: string,
    answers: ClarificationAnswers,
  ): Promise<IntegrationDesign>;
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
  applyNaturalLanguageMappingChange?(
    mappings: FieldMappingSpec[],
    instruction: string,
    context?: {
      sourceFields?: Array<{ name: string }>;
      targetFields?: DiscoveredField[];
    },
  ): Promise<FieldMappingSpec[]>;
  validateIntegration(design: IntegrationDesign): Promise<{
    ok: boolean;
    issues: Array<{ severity: 'error' | 'warning'; code: string; message: string }>;
  }>;
  validateDesignComplete?(input: {
    design: IntegrationDesign;
    mappings: FieldMappingSpec[];
    sourceFields: Array<{ name: string }>;
    targetFields: DiscoveredField[];
    hasSourceConnection?: boolean;
    hasTargetConnection?: boolean;
    hasMatchingStrategy?: boolean;
  }): Promise<DesignValidationReport>;
  dryRun?(input: {
    sourceRecords: Record<string, unknown>[];
    mappings: FieldMappingSpec[];
    targetFields?: DiscoveredField[];
  }): Promise<DryRunResult>;
  reviewIntegration(design: IntegrationDesign): Promise<{
    summary: string;
    recommendations: string[];
  }>;
}
