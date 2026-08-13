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

export interface UpdateFormFromAiResult {
  formId: string;
  formName: string;
  addedFieldCount: number;
  skippedExistingCount: number;
  totalFieldCount: number;
  targetPageName?: string;
}

export type AiFieldWithPage = AiGeneratedFormField & {
  pageName?: string;
  pageIndex?: number; // 1-based for user-facing prompts
};

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
    // "on/in/to the Profile page" or "'Profile' page"
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

    // "2nd page", "second page", "page 2"
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

/**
 * Append AI-generated fields onto an existing form (does not create a new form).
 * Places fields on the requested page when the user/AI names it; otherwise page 1.
 */
export async function updateFormFromAiGeneration(
  formId: string,
  generated: Pick<AiGeneratedFormSchema, 'fields'> & {
    name?: string;
    description?: string;
    fields: AiFieldWithPage[];
  },
  options?: {
    replaceName?: boolean;
    replaceDescription?: boolean;
    targetPageName?: string;
    targetPageIndex?: number;
    userPrompt?: string;
  },
): Promise<UpdateFormFromAiResult> {
  if (!Array.isArray(generated.fields) || generated.fields.length === 0) {
    throw new Error('AI did not return any fields to add. Describe the fields you want to change.');
  }

  const { data: formRow, error: formError } = await supabase
    .from('forms')
    .select('id, name, description, pages')
    .eq('id', formId)
    .single();

  if (formError || !formRow) {
    throw new Error(formError?.message || 'Form not found');
  }

  const { data: existingFieldRows, error: fieldsError } = await supabase
    .from('form_fields')
    .select('id, label, field_order')
    .eq('form_id', formId)
    .order('field_order', { ascending: true });

  if (fieldsError) {
    throw new Error(fieldsError.message || 'Failed to load existing fields');
  }

  const existingFields = existingFieldRows || [];
  const existingLabels = new Set(
    existingFields.map((f) => (f.label || '').trim().toLowerCase()).filter(Boolean),
  );

  const toAdd: AiFieldWithPage[] = [];
  let skippedExistingCount = 0;
  for (const field of generated.fields) {
    const labelKey = (field.label || '').trim().toLowerCase();
    if (!labelKey) continue;
    if (existingLabels.has(labelKey)) {
      skippedExistingCount += 1;
      continue;
    }
    existingLabels.add(labelKey);
    toAdd.push(field);
  }

  if (toAdd.length === 0) {
    throw new Error(
      'Those fields already exist on this form. Try describing different fields, or ask to create a new form.',
    );
  }

  const pages = parsePages(formRow.pages, existingFields.map((f) => f.id));
  const defaultTargetPage = resolveTargetPage(pages, {
    pageName: options?.targetPageName,
    pageIndex: options?.targetPageIndex,
    userPrompt: options?.userPrompt,
  });

  let nextOrder = existingFields.reduce((max, f) => Math.max(max, f.field_order ?? 0), -1) + 1;
  let addedFieldCount = 0;
  const usedPageNames = new Set<string>();

  for (const field of toAdd) {
    const targetPage = resolveTargetPage(pages, {
      pageName: field.pageName || options?.targetPageName,
      pageIndex: field.pageIndex || options?.targetPageIndex,
      userPrompt: options?.userPrompt,
    }) || defaultTargetPage;
    usedPageNames.add(targetPage.name);

    const mappedOptions = field.options?.map((opt, idx) => ({
      id: `opt-${idx}-${Date.now()}-${addedFieldCount}`,
      value: opt.value,
      label: opt.label,
    }));

    const { data: newFieldRow, error: fieldError } = await supabase
      .from('form_fields')
      .insert({
        form_id: formId,
        field_type: sanitizeAiFieldType(field.type),
        label: field.label,
        placeholder: field.placeholder || '',
        required: field.required || false,
        default_value: '',
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
        custom_config: null,
      })
      .select('id')
      .single();

    if (fieldError || !newFieldRow) {
      throw new Error(fieldError?.message || `Failed to add field "${field.label}"`);
    }

    targetPage.fields.push(newFieldRow.id);
    nextOrder += 1;
    addedFieldCount += 1;
  }

  const formUpdates: Record<string, unknown> = {
    pages: JSON.stringify(pages),
  };
  if (options?.replaceName && generated.name) formUpdates.name = generated.name;
  if (options?.replaceDescription && generated.description != null) {
    formUpdates.description = generated.description;
  }

  const { error: pagesError } = await supabase
    .from('forms')
    .update(formUpdates)
    .eq('id', formId);

  if (pagesError) {
    throw new Error(pagesError.message || 'Failed to update form pages');
  }

  return {
    formId,
    formName: (formUpdates.name as string) || formRow.name,
    addedFieldCount,
    skippedExistingCount,
    totalFieldCount: existingFields.length + addedFieldCount,
    targetPageName: [...usedPageNames].join(', ') || defaultTargetPage.name,
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
