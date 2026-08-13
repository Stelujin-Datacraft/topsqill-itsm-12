import { backend as supabase } from '@/services/api';
import {
  sanitizeAiFieldType,
  type AiGeneratedFormField,
  type AiGeneratedFormSchema,
} from '@/lib/createFormFromAiGeneration';

export interface FormPageInfo {
  id: string;
  name: string;
  order: number;
  fields: string[];
}

export type FieldOpType = 'add' | 'update' | 'rename' | 'remove' | 'move';

export interface AiFieldOp extends AiGeneratedFormField {
  op?: FieldOpType;
  /** Label of the existing field when renaming or updating under a new name */
  currentLabel?: string;
  /** New label when renaming */
  newLabel?: string;
  pageName?: string;
  pageIndex?: number; // 1-based
  targetPageName?: string;
  targetPageIndex?: number;
  defaultValue?: string | boolean | string[] | number | null;
  customConfig?: Record<string, unknown>;
}

export interface FormUpdatePlan {
  fields?: AiFieldOp[];
  pagesToAdd?: Array<{ name: string; description?: string }>;
  layoutColumns?: 1 | 2 | 3;
  applyFieldRules?: boolean;
}

export interface UpdateFormFromAiResult {
  formId: string;
  formName: string;
  addedFieldCount: number;
  updatedFieldCount: number;
  removedFieldCount: number;
  movedFieldCount: number;
  renamedFieldCount: number;
  skippedCount: number;
  pagesCreated: number;
  rulesAdded: number;
  totalFieldCount: number;
  targetPageName?: string;
  summary: string;
}

export type AiFieldWithPage = AiFieldOp;

interface ExistingFieldRow {
  id: string;
  label: string;
  field_type: string;
  field_order: number | null;
  placeholder: string | null;
  required: boolean | null;
  default_value: string | null;
  options: unknown;
  validation: unknown;
  tooltip: string | null;
  custom_config: unknown;
}

function parseJsonValue<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parsePages(rawPages: unknown, fallbackFieldIds: string[] = []): FormPageInfo[] {
  try {
    const raw = typeof rawPages === 'string' ? JSON.parse(rawPages) : rawPages;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p: any, idx: number) => ({
        id: p.id || `page-${idx + 1}`,
        name: p.name || `Page ${idx + 1}`,
        order: typeof p.order === 'number' ? p.order : idx,
        fields: Array.isArray(p.fields) ? [...p.fields] : [],
      }));
    }
  } catch {
    /* ignore */
  }
  return [{
    id: 'default',
    name: 'Page 1',
    order: 0,
    fields: [...fallbackFieldIds],
  }];
}

function labelKey(label?: string | null): string {
  return (label || '').trim().toLowerCase();
}

function serializeDefaultValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function buildCustomConfig(
  field: Pick<AiFieldOp, 'isFullWidth' | 'customConfig' | 'type'>,
  existing?: unknown,
): Record<string, unknown> | null {
  const base = parseJsonValue<Record<string, unknown>>(existing, {});
  const merged: Record<string, unknown> = {
    ...(base && typeof base === 'object' ? base : {}),
    ...(field.customConfig && typeof field.customConfig === 'object' ? field.customConfig : {}),
  };

  if (typeof field.isFullWidth === 'boolean') {
    merged.isFullWidth = field.isFullWidth;
  } else if (
    field.isFullWidth == null
    && ['textarea', 'address', 'header', 'description', 'section-break', 'horizontal-line', 'rich-text'].includes(
      sanitizeAiFieldType(field.type || 'text'),
    )
  ) {
    merged.isFullWidth = true;
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

function mapOptions(
  options: AiFieldOp['options'] | undefined,
  seed: string,
): Array<{ id: string; value: string; label: string }> | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  return options.map((opt, idx) => ({
    id: `opt-${idx}-${seed}`,
    value: opt.value || opt.label || `option_${idx + 1}`,
    label: opt.label || opt.value || `Option ${idx + 1}`,
  }));
}

/**
 * Resolve a page from natural-language cues:
 * - page name: "Profile", "on Profile page"
 * - ordinal/index: "2nd page", "page 2", "second page"
 */
export function resolveTargetPage(
  pages: FormPageInfo[],
  hint?: { pageName?: string; pageIndex?: number; userPrompt?: string },
): FormPageInfo {
  if (!pages.length) {
    return { id: 'default', name: 'Page 1', order: 0, fields: [] };
  }

  const sorted = [...pages].sort((a, b) => a.order - b.order);

  if (typeof hint?.pageIndex === 'number' && hint.pageIndex >= 1 && hint.pageIndex <= sorted.length) {
    return sorted[hint.pageIndex - 1];
  }

  const nameHint = (hint?.pageName || '').trim().toLowerCase();
  if (nameHint) {
    const exact = sorted.find((p) => p.name.trim().toLowerCase() === nameHint);
    if (exact) return exact;
    const partial = sorted.find((p) => p.name.trim().toLowerCase().includes(nameHint) || nameHint.includes(p.name.trim().toLowerCase()));
    if (partial) return partial;
  }

  const prompt = (hint?.userPrompt || '').toLowerCase();
  if (prompt) {
    for (const page of sorted) {
      const pageName = page.name.trim().toLowerCase();
      if (!pageName) continue;
      const escaped = pageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameOnPage = new RegExp(
        `(?:on|in|to|under|into)\\s+(?:the\\s+)?['"]?${escaped}['"]?\\s+page\\b`,
        'i',
      );
      const pageNamed = new RegExp(
        `\\bpage\\s+['"]?${escaped}['"]?\\b|['"]${escaped}['"]\\s+page\\b`,
        'i',
      );
      if (nameOnPage.test(prompt) || pageNamed.test(prompt)) {
        return page;
      }
    }

    const ordinalMatch = prompt.match(
      /\b(?:on|in|to|under)?\s*(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+page\b|\bpage\s*(?:number\s*)?(\d+)\b|\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+page\b/i,
    );
    if (ordinalMatch) {
      const wordMap: Record<string, number> = {
        first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
        sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
      };
      const idx = Number(ordinalMatch[1] || ordinalMatch[2] || wordMap[(ordinalMatch[3] || '').toLowerCase()] || 0);
      if (idx >= 1 && idx <= sorted.length) return sorted[idx - 1];
    }
  }

  return sorted[0];
}

/** Create a page when the named target does not exist yet. */
export function resolveOrCreateTargetPage(
  pages: FormPageInfo[],
  hint?: { pageName?: string; pageIndex?: number; userPrompt?: string; createIfMissing?: boolean },
): { page: FormPageInfo; created: boolean } {
  const createIfMissing = hint?.createIfMissing !== false;
  const nameHint = (hint?.pageName || '').trim();

  if (nameHint) {
    // resolveTargetPage falls back to page 1 — detect true miss by name first
    const exactOrPartial = pages.find((p) => {
      const n = p.name.trim().toLowerCase();
      const h = nameHint.toLowerCase();
      return n === h || n.includes(h) || h.includes(n);
    });

    if (exactOrPartial) {
      return { page: exactOrPartial, created: false };
    }

    if (typeof hint?.pageIndex === 'number' && hint.pageIndex >= 1 && hint.pageIndex <= pages.length) {
      return { page: resolveTargetPage(pages, hint), created: false };
    }

    if (createIfMissing) {
      const nextOrder = pages.reduce((max, p) => Math.max(max, p.order), -1) + 1;
      const newPage: FormPageInfo = {
        id: `page-${Date.now()}-${nextOrder + 1}`,
        name: nameHint,
        order: nextOrder,
        fields: [],
      };
      pages.push(newPage);
      return { page: newPage, created: true };
    }
  }

  return { page: resolveTargetPage(pages, hint), created: false };
}

function findFieldByLabel(fields: ExistingFieldRow[], label?: string): ExistingFieldRow | undefined {
  const key = labelKey(label);
  if (!key) return undefined;
  return fields.find((f) => labelKey(f.label) === key);
}

function removeFieldFromPages(pages: FormPageInfo[], fieldId: string) {
  for (const page of pages) {
    page.fields = page.fields.filter((id) => id !== fieldId);
  }
}

function inferOp(field: AiFieldOp, existingLabels: Set<string>): FieldOpType {
  if (field.op) return field.op;
  const matchLabel = field.currentLabel || field.label;
  if (matchLabel && existingLabels.has(labelKey(matchLabel))) {
    if (field.newLabel && labelKey(field.newLabel) !== labelKey(matchLabel)) return 'rename';
    if (field.targetPageName || typeof field.targetPageIndex === 'number') return 'move';
    return 'update';
  }
  return 'add';
}

/** Convert tool-seeded / generated fields into a normalized update plan. */
export function buildUpdatePlanFromFields(
  fields: AiFieldOp[],
  extras?: Omit<FormUpdatePlan, 'fields'>,
): FormUpdatePlan {
  return {
    ...extras,
    fields: fields.map((f) => ({
      ...f,
      op: f.op || 'add',
      label: f.label || f.currentLabel || f.newLabel || 'Field',
      type: f.type || 'text',
      required: Boolean(f.required),
    })),
  };
}

/**
 * Apply rich AI form updates: add / update / rename / remove / move fields,
 * create missing pages, persist full field props, and optional layout columns.
 */
export async function updateFormFromAiGeneration(
  formId: string,
  generated: Pick<AiGeneratedFormSchema, 'fields'> & {
    name?: string;
    description?: string;
    fields: AiFieldOp[];
  } | FormUpdatePlan,
  options?: {
    replaceName?: boolean;
    replaceDescription?: boolean;
    targetPageName?: string;
    targetPageIndex?: number;
    userPrompt?: string;
    layoutColumns?: 1 | 2 | 3;
    pagesToAdd?: Array<{ name: string }>;
    fieldRulesToAppend?: Array<Record<string, unknown>>;
  },
): Promise<UpdateFormFromAiResult> {
  const plan: FormUpdatePlan = Array.isArray((generated as FormUpdatePlan).fields)
    || (generated as FormUpdatePlan).pagesToAdd
    || (generated as FormUpdatePlan).layoutColumns
    ? {
        fields: (generated as FormUpdatePlan).fields || [],
        pagesToAdd: (generated as FormUpdatePlan).pagesToAdd || options?.pagesToAdd,
        layoutColumns: (generated as FormUpdatePlan).layoutColumns || options?.layoutColumns,
        applyFieldRules: (generated as FormUpdatePlan).applyFieldRules,
      }
    : buildUpdatePlanFromFields(
        ((generated as { fields: AiFieldOp[] }).fields || []) as AiFieldOp[],
        {
          pagesToAdd: options?.pagesToAdd,
          layoutColumns: options?.layoutColumns,
        },
      );

  const ops = plan.fields || [];
  if (ops.length === 0 && !plan.pagesToAdd?.length && !plan.layoutColumns && !options?.fieldRulesToAppend?.length) {
    throw new Error('AI did not return any form changes. Describe the fields or pages you want to change.');
  }

  const { data: formRow, error: formError } = await supabase
    .from('forms')
    .select('id, name, description, pages, layout, field_rules')
    .eq('id', formId)
    .single();

  if (formError || !formRow) {
    throw new Error(formError?.message || 'Form not found');
  }

  const { data: existingFieldRows, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, label, field_type, field_order, placeholder, required, default_value, options, validation, tooltip, custom_config')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message || 'Failed to load existing fields');
  }

  const existingFields = (existingFieldRows || []) as ExistingFieldRow[];
  const pages = parsePages(formRow.pages, existingFields.map((f) => f.id));
  let pagesCreated = 0;

  // Explicit pages to add first
  for (const pageSpec of plan.pagesToAdd || []) {
    const name = (pageSpec.name || '').trim();
    if (!name) continue;
    const exists = pages.some((p) => labelKey(p.name) === labelKey(name));
    if (exists) continue;
    const { created } = resolveOrCreateTargetPage(pages, { pageName: name, createIfMissing: true });
    if (created) pagesCreated += 1;
  }

  const existingLabels = new Set(
    existingFields.map((f) => labelKey(f.label)).filter(Boolean),
  );

  let nextOrder = existingFields.reduce((max, f) => Math.max(max, f.field_order ?? 0), -1) + 1;
  let addedFieldCount = 0;
  let updatedFieldCount = 0;
  let removedFieldCount = 0;
  let movedFieldCount = 0;
  let renamedFieldCount = 0;
  let skippedCount = 0;
  const usedPageNames = new Set<string>();

  const defaultHint = {
    pageName: options?.targetPageName,
    pageIndex: options?.targetPageIndex,
    userPrompt: options?.userPrompt,
  };

  for (const field of ops) {
    const op = inferOp(field, existingLabels);
    const matchLabel = field.currentLabel || (op === 'add' ? undefined : field.label) || field.label;
    const existing = findFieldByLabel(existingFields, matchLabel)
      || findFieldByLabel(existingFields, field.label);

    if (op === 'remove') {
      if (!existing) {
        skippedCount += 1;
        continue;
      }
      const { error: deleteError } = await supabase
        .from('form_fields')
        .delete()
        .eq('id', existing.id)
        .eq('form_id', formId);
      if (deleteError) {
        throw new Error(deleteError.message || `Failed to remove field "${existing.label}"`);
      }
      removeFieldFromPages(pages, existing.id);
      existingLabels.delete(labelKey(existing.label));
      const idx = existingFields.findIndex((f) => f.id === existing.id);
      if (idx >= 0) existingFields.splice(idx, 1);
      removedFieldCount += 1;
      continue;
    }

    if (op === 'move') {
      if (!existing) {
        skippedCount += 1;
        continue;
      }
      const { page: targetPage, created } = resolveOrCreateTargetPage(pages, {
        pageName: field.targetPageName || field.pageName || options?.targetPageName,
        pageIndex: field.targetPageIndex || field.pageIndex || options?.targetPageIndex,
        userPrompt: options?.userPrompt,
        createIfMissing: true,
      });
      if (created) pagesCreated += 1;
      removeFieldFromPages(pages, existing.id);
      if (!targetPage.fields.includes(existing.id)) {
        targetPage.fields.push(existing.id);
      }
      usedPageNames.add(targetPage.name);
      movedFieldCount += 1;
      continue;
    }

    if (op === 'update' || op === 'rename') {
      if (!existing) {
        // Fall through to add if the target doesn't exist
      } else {
        const nextLabel = (op === 'rename' ? (field.newLabel || field.label) : (field.label || existing.label))?.trim()
          || existing.label;
        const updates: Record<string, unknown> = {};

        if (nextLabel && nextLabel !== existing.label) {
          updates.label = nextLabel;
          existingLabels.delete(labelKey(existing.label));
          existingLabels.add(labelKey(nextLabel));
          existing.label = nextLabel;
          if (op === 'rename' || field.newLabel) renamedFieldCount += 1;
        }
        if (field.type) updates.field_type = sanitizeAiFieldType(field.type);
        if (typeof field.required === 'boolean') updates.required = field.required;
        if (field.placeholder != null) updates.placeholder = field.placeholder;
        if (field.tooltip != null) updates.tooltip = field.tooltip;
        if (field.defaultValue !== undefined) updates.default_value = serializeDefaultValue(field.defaultValue);
        if (field.validation) updates.validation = JSON.stringify(field.validation);
        if (field.options) {
          const mapped = mapOptions(field.options, `${existing.id}-${Date.now()}`);
          updates.options = mapped ? JSON.stringify(mapped) : null;
        }
        const customConfig = buildCustomConfig(field, existing.custom_config);
        if (customConfig) updates.custom_config = JSON.stringify(customConfig);

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('form_fields')
            .update(updates)
            .eq('id', existing.id)
            .eq('form_id', formId);
          if (updateError) {
            throw new Error(updateError.message || `Failed to update field "${existing.label}"`);
          }
          updatedFieldCount += 1;
        } else {
          skippedCount += 1;
        }

        // Optional page move as part of update/rename
        if (field.pageName || field.targetPageName || typeof field.pageIndex === 'number' || typeof field.targetPageIndex === 'number') {
          const { page: targetPage, created } = resolveOrCreateTargetPage(pages, {
            pageName: field.targetPageName || field.pageName || options?.targetPageName,
            pageIndex: field.targetPageIndex || field.pageIndex || options?.targetPageIndex,
            userPrompt: options?.userPrompt,
            createIfMissing: true,
          });
          if (created) pagesCreated += 1;
          removeFieldFromPages(pages, existing.id);
          if (!targetPage.fields.includes(existing.id)) targetPage.fields.push(existing.id);
          usedPageNames.add(targetPage.name);
          movedFieldCount += 1;
        }
        continue;
      }
    }

    // add (default)
    const addLabel = (field.label || field.newLabel || '').trim();
    if (!addLabel) {
      skippedCount += 1;
      continue;
    }
    if (existingLabels.has(labelKey(addLabel))) {
      // Same label already exists — update props instead of skipping silently when rich props provided
      const existingSame = findFieldByLabel(existingFields, addLabel);
      if (existingSame && (field.type || field.options || field.required != null || field.placeholder || field.validation || field.defaultValue !== undefined)) {
        const updates: Record<string, unknown> = {};
        if (field.type) updates.field_type = sanitizeAiFieldType(field.type);
        if (typeof field.required === 'boolean') updates.required = field.required;
        if (field.placeholder != null) updates.placeholder = field.placeholder;
        if (field.tooltip != null) updates.tooltip = field.tooltip;
        if (field.defaultValue !== undefined) updates.default_value = serializeDefaultValue(field.defaultValue);
        if (field.validation) updates.validation = JSON.stringify(field.validation);
        if (field.options) {
          const mapped = mapOptions(field.options, `${existingSame.id}-${Date.now()}`);
          updates.options = mapped ? JSON.stringify(mapped) : null;
        }
        const customConfig = buildCustomConfig(field, existingSame.custom_config);
        if (customConfig) updates.custom_config = JSON.stringify(customConfig);
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('form_fields')
            .update(updates)
            .eq('id', existingSame.id);
          if (updateError) throw new Error(updateError.message || `Failed to update field "${addLabel}"`);
          updatedFieldCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }
      skippedCount += 1;
      continue;
    }

    const { page: targetPage, created } = resolveOrCreateTargetPage(pages, {
      pageName: field.pageName || options?.targetPageName,
      pageIndex: field.pageIndex || options?.targetPageIndex,
      userPrompt: options?.userPrompt,
      createIfMissing: Boolean(field.pageName || options?.targetPageName),
    });
    if (created) pagesCreated += 1;
    usedPageNames.add(targetPage.name);

    const mappedOptions = mapOptions(field.options, `${Date.now()}-${addedFieldCount}`);
    const customConfig = buildCustomConfig(field);

    const { data: newFieldRow, error: fieldError } = await supabase
      .from('form_fields')
      .insert({
        form_id: formId,
        field_type: sanitizeAiFieldType(field.type || 'text'),
        label: addLabel,
        placeholder: field.placeholder || '',
        required: field.required || false,
        default_value: serializeDefaultValue(field.defaultValue),
        options: mappedOptions ? JSON.stringify(mappedOptions) : null,
        validation: field.validation ? JSON.stringify(field.validation) : null,
        permissions: JSON.stringify({ read: ['*'], write: ['*'] }),
        triggers: JSON.stringify([]),
        is_visible: true,
        is_enabled: true,
        current_value: '',
        tooltip: field.tooltip || '',
        error_message: '',
        field_order: nextOrder,
        custom_config: customConfig ? JSON.stringify(customConfig) : null,
      })
      .select('id')
      .single();

    if (fieldError || !newFieldRow) {
      throw new Error(fieldError?.message || `Failed to add field "${addLabel}"`);
    }

    targetPage.fields.push(newFieldRow.id);
    existingFields.push({
      id: newFieldRow.id,
      label: addLabel,
      field_type: sanitizeAiFieldType(field.type || 'text'),
      field_order: nextOrder,
      placeholder: field.placeholder || null,
      required: field.required || false,
      default_value: serializeDefaultValue(field.defaultValue),
      options: mappedOptions,
      validation: field.validation || null,
      tooltip: field.tooltip || null,
      custom_config: customConfig,
    });
    existingLabels.add(labelKey(addLabel));
    nextOrder += 1;
    addedFieldCount += 1;
  }

  // Ensure default page hint page is recorded even if only pages/rules changed
  if (usedPageNames.size === 0 && (options?.targetPageName || defaultHint.pageName)) {
    usedPageNames.add(options?.targetPageName || defaultHint.pageName || '');
  }

  const formUpdates: Record<string, unknown> = {
    pages: JSON.stringify(pages),
  };
  if (options?.replaceName && (generated as { name?: string }).name) {
    formUpdates.name = (generated as { name?: string }).name;
  }
  if (options?.replaceDescription && (generated as { description?: string }).description != null) {
    formUpdates.description = (generated as { description?: string }).description;
  }

  const layoutColumns = plan.layoutColumns || options?.layoutColumns;
  if (layoutColumns && [1, 2, 3].includes(layoutColumns)) {
    const existingLayout = parseJsonValue<{ columns?: number }>(formRow.layout, { columns: 1 });
    formUpdates.layout = JSON.stringify({ ...existingLayout, columns: layoutColumns });
  }

  let rulesAdded = 0;
  if (options?.fieldRulesToAppend?.length) {
    const existingRules = parseJsonValue<Array<Record<string, unknown>>>(formRow.field_rules, []);
    const nextRules = [...(Array.isArray(existingRules) ? existingRules : []), ...options.fieldRulesToAppend];
    formUpdates.field_rules = JSON.stringify(nextRules);
    rulesAdded = options.fieldRulesToAppend.length;
  }

  const { error: pagesError } = await supabase
    .from('forms')
    .update(formUpdates)
    .eq('id', formId);

  if (pagesError) {
    throw new Error(pagesError.message || 'Failed to update form pages');
  }

  const parts: string[] = [];
  if (addedFieldCount) parts.push(`added ${addedFieldCount}`);
  if (updatedFieldCount) parts.push(`updated ${updatedFieldCount}`);
  if (renamedFieldCount) parts.push(`renamed ${renamedFieldCount}`);
  if (movedFieldCount) parts.push(`moved ${movedFieldCount}`);
  if (removedFieldCount) parts.push(`removed ${removedFieldCount}`);
  if (pagesCreated) parts.push(`created ${pagesCreated} page(s)`);
  if (layoutColumns) parts.push(`set ${layoutColumns}-column layout`);
  if (rulesAdded) parts.push(`added ${rulesAdded} rule(s)`);
  if (skippedCount) parts.push(`skipped ${skippedCount}`);

  const defaultTargetPage = resolveTargetPage(pages, defaultHint);

  return {
    formId,
    formName: (formUpdates.name as string) || formRow.name,
    addedFieldCount,
    updatedFieldCount,
    removedFieldCount,
    movedFieldCount,
    renamedFieldCount,
    skippedCount,
    pagesCreated,
    rulesAdded,
    totalFieldCount: existingFields.length,
    targetPageName: [...usedPageNames].filter(Boolean).join(', ') || defaultTargetPage.name,
    summary: parts.length ? parts.join(', ') : 'no field changes',
  };
}

/** Load page list for prompt context / targeting. */
export async function loadFormPages(formId: string): Promise<FormPageInfo[]> {
  const { data, error } = await supabase
    .from('forms')
    .select('pages')
    .eq('id', formId)
    .single();
  if (error || !data) return [];
  return parsePages(data.pages);
}
