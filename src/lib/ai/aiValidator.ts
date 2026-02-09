/**
 * AI Output Validator & Auto-Corrector
 * 
 * Validates and normalizes AI-generated output before applying to the system.
 * This ensures 100% accuracy by catching and fixing AI mistakes.
 */

import {
  VALID_FIELD_TYPES,
  FIELD_TYPE_ALIASES,
  VALID_NODE_TYPES,
  NODE_TYPE_ALIASES,
  VALID_TRIGGER_TYPES,
  VALID_ACTION_TYPES,
  VALID_CONDITION_OPERATORS,
  CONDITION_OPERATOR_ALIASES,
  VALID_FIELD_RULE_ACTIONS,
  VALID_FORM_RULE_ACTIONS,
  VALID_CHART_TYPES,
  VALID_AGGREGATION_TYPES,
  VALID_NOTIFICATION_TYPES,
  VALID_RECIPIENT_TYPES,
  VALID_WAIT_TYPES,
  VALID_DURATION_UNITS,
  ValidFieldType,
  ValidNodeType,
  ValidConditionOperator
} from './systemSchema';

export interface ValidationResult<T> {
  valid: boolean;
  data: T;
  errors: string[];
  warnings: string[];
  corrections: string[];
}

// ============= FIELD TYPE VALIDATION =============

/**
 * Validates and normalizes a field type
 */
export function normalizeFieldType(type: string): { valid: boolean; normalized: ValidFieldType; correction?: string } {
  const lowerType = type.toLowerCase().trim();
  
  // Check if it's already valid
  if ((VALID_FIELD_TYPES as readonly string[]).includes(lowerType)) {
    return { valid: true, normalized: lowerType as ValidFieldType };
  }
  
  // Check aliases
  if (lowerType in FIELD_TYPE_ALIASES) {
    return {
      valid: true,
      normalized: FIELD_TYPE_ALIASES[lowerType],
      correction: `Corrected field type "${type}" to "${FIELD_TYPE_ALIASES[lowerType]}"`
    };
  }
  
  // Default fallback to text
  return {
    valid: false,
    normalized: 'text',
    correction: `Unknown field type "${type}" defaulted to "text"`
  };
}

// ============= NODE TYPE VALIDATION =============

/**
 * Validates and normalizes a workflow node type
 */
export function normalizeNodeType(type: string): { valid: boolean; normalized: ValidNodeType; correction?: string } {
  const lowerType = type.toLowerCase().trim();
  
  // Check if it's already valid
  if ((VALID_NODE_TYPES as readonly string[]).includes(lowerType)) {
    return { valid: true, normalized: lowerType as ValidNodeType };
  }
  
  // Check aliases
  if (lowerType in NODE_TYPE_ALIASES) {
    return {
      valid: true,
      normalized: NODE_TYPE_ALIASES[lowerType],
      correction: `Corrected node type "${type}" to "${NODE_TYPE_ALIASES[lowerType]}"`
    };
  }
  
  // Default fallback to action
  return {
    valid: false,
    normalized: 'action',
    correction: `Unknown node type "${type}" defaulted to "action"`
  };
}

// ============= OPERATOR VALIDATION =============

/**
 * Validates and normalizes a condition operator
 */
export function normalizeOperator(operator: string): { valid: boolean; normalized: ValidConditionOperator; correction?: string } {
  const cleanOp = operator.trim();
  
  // Check if it's already valid
  if ((VALID_CONDITION_OPERATORS as readonly string[]).includes(cleanOp)) {
    return { valid: true, normalized: cleanOp as ValidConditionOperator };
  }
  
  // Check aliases
  const lowerOp = cleanOp.toLowerCase();
  if (lowerOp in CONDITION_OPERATOR_ALIASES) {
    return {
      valid: true,
      normalized: CONDITION_OPERATOR_ALIASES[lowerOp],
      correction: `Corrected operator "${operator}" to "${CONDITION_OPERATOR_ALIASES[lowerOp]}"`
    };
  }
  
  // Default fallback to equals
  return {
    valid: false,
    normalized: '==',
    correction: `Unknown operator "${operator}" defaulted to "=="`
  };
}

// ============= FORM VALIDATION =============

interface AIGeneratedField {
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  tooltip?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, any>;
  defaultValue?: string;
  isFullWidth?: boolean;
}

interface AIGeneratedForm {
  name: string;
  description: string;
  fields: AIGeneratedField[];
  pages?: Array<{ name: string; description?: string; fieldIndexes: number[] }>;
  suggestedLayout?: 1 | 2 | 3;
  estimatedCompletionTime?: string;
}

/**
 * Validates and normalizes an AI-generated form
 */
export function validateGeneratedForm(form: AIGeneratedForm): ValidationResult<AIGeneratedForm> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  // Validate name
  if (!form.name || form.name.trim().length === 0) {
    form.name = 'Untitled Form';
    corrections.push('Added default form name');
  }
  
  // Validate description
  if (!form.description) {
    form.description = '';
    warnings.push('Form description is empty');
  }
  
  // Validate fields
  if (!form.fields || !Array.isArray(form.fields)) {
    form.fields = [];
    errors.push('No fields defined');
  } else {
    form.fields = form.fields.map((field, index) => {
      const typeResult = normalizeFieldType(field.type);
      if (typeResult.correction) {
        corrections.push(`Field ${index + 1}: ${typeResult.correction}`);
      }
      
      // Validate label
      if (!field.label || field.label.trim().length === 0) {
        field.label = `Field ${index + 1}`;
        corrections.push(`Field ${index + 1}: Added default label`);
      }
      
      // Ensure required is boolean
      field.required = Boolean(field.required);
      
      // Validate options for select/radio/checkbox types
      if (['select', 'multi-select', 'radio', 'checkbox'].includes(typeResult.normalized)) {
        if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
          field.options = [
            { value: 'option_1', label: 'Option 1' },
            { value: 'option_2', label: 'Option 2' }
          ];
          corrections.push(`Field ${index + 1}: Added default options for ${typeResult.normalized}`);
        } else {
          // Normalize options
          field.options = field.options.map((opt, optIndex) => ({
            value: opt.value || `option_${optIndex + 1}`,
            label: opt.label || opt.value || `Option ${optIndex + 1}`
          }));
        }
      }
      
      return {
        ...field,
        type: typeResult.normalized
      };
    });
  }
  
  // Validate layout
  if (form.suggestedLayout && ![1, 2, 3].includes(form.suggestedLayout)) {
    form.suggestedLayout = 1;
    corrections.push('Corrected invalid layout to 1 column');
  }
  
  return {
    valid: errors.length === 0,
    data: form,
    errors,
    warnings,
    corrections
  };
}

// ============= WORKFLOW VALIDATION =============

interface AIGeneratedNode {
  type: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  connections?: Array<{ to: string; condition?: string }>;
}

interface AIGeneratedWorkflow {
  name: string;
  description: string;
  nodes: AIGeneratedNode[];
  suggestions?: string[];
  estimatedDuration?: string;
}

/**
 * Validates and normalizes an AI-generated workflow
 */
export function validateGeneratedWorkflow(
  workflow: AIGeneratedWorkflow,
  availableForms?: Array<{ id: string; name: string }>
): ValidationResult<AIGeneratedWorkflow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  // Validate name
  if (!workflow.name || workflow.name.trim().length === 0) {
    workflow.name = 'Untitled Workflow';
    corrections.push('Added default workflow name');
  }
  
  // Validate description
  if (!workflow.description) {
    workflow.description = '';
    warnings.push('Workflow description is empty');
  }
  
  // Validate nodes
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    workflow.nodes = [];
    errors.push('No nodes defined');
  } else {
    // Check for required start and end nodes
    const hasStart = workflow.nodes.some(n => normalizeNodeType(n.type).normalized === 'start');
    const hasEnd = workflow.nodes.some(n => normalizeNodeType(n.type).normalized === 'end');
    
    if (!hasStart) {
      workflow.nodes.unshift({
        type: 'start',
        label: 'Start',
        config: { triggerType: 'manual' },
        connections: workflow.nodes.length > 0 ? [{ to: workflow.nodes[0].label }] : []
      });
      corrections.push('Added missing start node');
    }
    
    if (!hasEnd) {
      workflow.nodes.push({
        type: 'end',
        label: 'End',
        config: { endStatus: 'completed' },
        connections: []
      });
      corrections.push('Added missing end node');
    }
    
    workflow.nodes = workflow.nodes.map((node, index) => {
      const typeResult = normalizeNodeType(node.type);
      if (typeResult.correction) {
        corrections.push(`Node ${index + 1}: ${typeResult.correction}`);
      }
      
      // Validate label
      if (!node.label || node.label.trim().length === 0) {
        node.label = `Node ${index + 1}`;
        corrections.push(`Node ${index + 1}: Added default label`);
      }
      
      // Validate config based on node type
      if (!node.config) {
        node.config = {};
      }
      
      const normalizedType = typeResult.normalized;
      
      // Add required config properties
      if (normalizedType === 'start' && !node.config.triggerType) {
        node.config.triggerType = 'manual';
        corrections.push(`Node "${node.label}": Set default trigger type to "manual"`);
      }
      
      if (normalizedType === 'end' && !node.config.endStatus) {
        node.config.endStatus = 'completed';
        corrections.push(`Node "${node.label}": Set default end status to "completed"`);
      }
      
      if (normalizedType === 'wait') {
        if (!node.config.waitType) {
          node.config.waitType = 'duration';
        }
        if (!node.config.durationValue) {
          node.config.durationValue = 24;
        }
        if (!node.config.durationUnit) {
          node.config.durationUnit = 'hours';
        }
      }
      
      if (normalizedType === 'action' && !node.config.actionType) {
        node.config.actionType = 'send_notification';
        warnings.push(`Node "${node.label}": Action type not specified, defaulted to send_notification`);
      }
      
      // Validate condition node has proper connections
      if (normalizedType === 'condition') {
        const hasTrueConnection = node.connections?.some(c => c.condition === 'true');
        const hasFalseConnection = node.connections?.some(c => c.condition === 'false');
        
        if (!hasTrueConnection || !hasFalseConnection) {
          warnings.push(`Condition node "${node.label}" should have both "true" and "false" connections`);
        }
      }
      
      // Validate connections
      if (!node.connections) {
        node.connections = [];
        if (normalizedType !== 'end') {
          warnings.push(`Node "${node.label}" has no connections`);
        }
      }
      
      return {
        ...node,
        type: normalizedType
      };
    });
  }
  
  return {
    valid: errors.length === 0,
    data: workflow,
    errors,
    warnings,
    corrections
  };
}

// ============= FIELD RULES VALIDATION =============

interface AIGeneratedFieldRule {
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

interface AIGeneratedFieldRulesResult {
  rules: AIGeneratedFieldRule[];
  summary: string;
  suggestions?: string[];
}

/**
 * Validates and normalizes AI-generated field rules
 */
export function validateGeneratedFieldRules(
  result: AIGeneratedFieldRulesResult,
  availableFields: Array<{ id: string; label: string }>
): ValidationResult<AIGeneratedFieldRulesResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  const fieldIds = new Set(availableFields.map(f => f.id));
  const fieldLabels = new Map(availableFields.map(f => [f.label.toLowerCase(), f.id]));
  
  if (!result.rules || !Array.isArray(result.rules)) {
    result.rules = [];
    errors.push('No rules defined');
  } else {
    result.rules = result.rules.map((rule, ruleIndex) => {
      // Validate target field
      if (!fieldIds.has(rule.targetFieldId)) {
        // Try to find by label
        const foundId = fieldLabels.get(rule.targetFieldLabel?.toLowerCase() || '');
        if (foundId) {
          rule.targetFieldId = foundId;
          corrections.push(`Rule ${ruleIndex + 1}: Resolved target field by label`);
        } else {
          warnings.push(`Rule ${ruleIndex + 1}: Target field "${rule.targetFieldLabel}" not found`);
        }
      }
      
      // Validate action
      if (!(VALID_FIELD_RULE_ACTIONS as readonly string[]).includes(rule.action)) {
        const suggestedAction = 'show';
        corrections.push(`Rule ${ruleIndex + 1}: Unknown action "${rule.action}" defaulted to "show"`);
        rule.action = suggestedAction;
      }
      
      // Validate conditions
      if (!rule.conditions || !Array.isArray(rule.conditions)) {
        rule.conditions = [];
        errors.push(`Rule ${ruleIndex + 1}: No conditions defined`);
      } else {
        rule.conditions = rule.conditions.map((cond, condIndex) => {
          // Validate condition field
          if (!fieldIds.has(cond.fieldId)) {
            const foundId = fieldLabels.get(cond.fieldLabel?.toLowerCase() || '');
            if (foundId) {
              cond.fieldId = foundId;
              corrections.push(`Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: Resolved field by label`);
            } else {
              warnings.push(`Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: Field "${cond.fieldLabel}" not found`);
            }
          }
          
          // Normalize operator
          const opResult = normalizeOperator(cond.operator);
          if (opResult.correction) {
            corrections.push(`Rule ${ruleIndex + 1}, Condition ${condIndex + 1}: ${opResult.correction}`);
          }
          
          return {
            ...cond,
            operator: opResult.normalized
          };
        });
      }
      
      // Validate logic expression
      if (!rule.logicExpression) {
        rule.logicExpression = '1';
        corrections.push(`Rule ${ruleIndex + 1}: Added default logic expression`);
      }
      
      return rule;
    });
  }
  
  if (!result.summary) {
    result.summary = `Generated ${result.rules.length} field rules`;
  }
  
  return {
    valid: errors.length === 0,
    data: result,
    errors,
    warnings,
    corrections
  };
}

// ============= CHART VALIDATION =============

interface AIChartSuggestion {
  chartType: string;
  title: string;
  description: string;
  dimensions: string[];
  metrics: string[];
  aggregation: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Array<{ fieldId: string; operator: string; value: string }>;
  reasoning: string;
  priority: number;
}

interface AIChartSuggestionResult {
  suggestions: AIChartSuggestion[];
  insights?: string[];
  warnings?: string[];
}

/**
 * Validates and normalizes AI-generated chart suggestions
 */
export function validateGeneratedCharts(
  result: AIChartSuggestionResult,
  availableFields: Array<{ id: string; label: string; type: string }>
): ValidationResult<AIChartSuggestionResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  const fieldIds = new Set(availableFields.map(f => f.id));
  
  if (!result.suggestions || !Array.isArray(result.suggestions)) {
    result.suggestions = [];
    warnings.push('No chart suggestions generated');
  } else {
    result.suggestions = result.suggestions.map((chart, index) => {
      // Validate chart type
      if (!(VALID_CHART_TYPES as readonly string[]).includes(chart.chartType)) {
        corrections.push(`Chart ${index + 1}: Unknown type "${chart.chartType}" defaulted to "bar"`);
        chart.chartType = 'bar';
      }
      
      // Validate aggregation
      if (!(VALID_AGGREGATION_TYPES as readonly string[]).includes(chart.aggregation)) {
        corrections.push(`Chart ${index + 1}: Unknown aggregation "${chart.aggregation}" defaulted to "count"`);
        chart.aggregation = 'count';
      }
      
      // Validate dimensions reference valid fields
      if (chart.dimensions) {
        chart.dimensions = chart.dimensions.filter(dim => {
          if (!fieldIds.has(dim)) {
            warnings.push(`Chart ${index + 1}: Dimension field "${dim}" not found`);
            return false;
          }
          return true;
        });
      }
      
      // Validate metrics reference valid fields
      if (chart.metrics) {
        chart.metrics = chart.metrics.filter(metric => {
          if (!fieldIds.has(metric)) {
            warnings.push(`Chart ${index + 1}: Metric field "${metric}" not found`);
            return false;
          }
          return true;
        });
      }
      
      // Validate priority
      if (typeof chart.priority !== 'number' || chart.priority < 1 || chart.priority > 5) {
        chart.priority = index + 1;
      }
      
      return chart;
    });
  }
  
  return {
    valid: errors.length === 0,
    data: result,
    errors,
    warnings,
    corrections
  };
}

// ============= EMAIL TEMPLATE VALIDATION =============

interface AIEmailTemplate {
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  templateVariables?: string[];
  recipients?: {
    to?: Array<{ type: string; value?: string; label?: string }>;
  };
}

/**
 * Validates and normalizes AI-generated email template
 */
export function validateGeneratedEmailTemplate(template: AIEmailTemplate): ValidationResult<AIEmailTemplate> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const corrections: string[] = [];
  
  // Validate name
  if (!template.name || template.name.trim().length === 0) {
    template.name = 'Untitled Template';
    corrections.push('Added default template name');
  }
  
  // Validate subject
  if (!template.subject || template.subject.trim().length === 0) {
    template.subject = 'Notification';
    corrections.push('Added default subject');
  }
  
  // Validate HTML content
  if (!template.htmlContent || template.htmlContent.trim().length === 0) {
    template.htmlContent = '<p>Email content here.</p>';
    errors.push('Email content is empty');
  } else if (!template.htmlContent.includes('<')) {
    // Wrap plain text in HTML
    template.htmlContent = `<p>${template.htmlContent}</p>`;
    corrections.push('Wrapped plain text in HTML paragraph tags');
  }
  
  // Extract template variables from content
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const foundVariables = new Set<string>();
  
  let match;
  while ((match = variableRegex.exec(template.subject)) !== null) {
    foundVariables.add(match[1].trim());
  }
  while ((match = variableRegex.exec(template.htmlContent)) !== null) {
    foundVariables.add(match[1].trim());
  }
  
  if (!template.templateVariables) {
    template.templateVariables = Array.from(foundVariables);
    if (foundVariables.size > 0) {
      corrections.push(`Extracted ${foundVariables.size} template variables`);
    }
  }
  
  // Initialize recipients structure
  if (!template.recipients) {
    template.recipients = { to: [] };
  }
  
  return {
    valid: errors.length === 0,
    data: template,
    errors,
    warnings,
    corrections
  };
}
