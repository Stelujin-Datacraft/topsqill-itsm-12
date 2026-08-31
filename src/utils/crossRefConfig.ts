/**
 * Resolve the linked/target form from a cross-reference field's custom_config.
 * Handles nested shapes: { crossRefConfig: { targetFormId } } and flat { targetFormId }.
 * For child-cross-reference, also accepts parentFormId.
 */
export function resolveCrossRefLinkedForm(
  customConfig: unknown,
  fieldType?: string,
): { targetFormId?: string; targetFormName?: string } {
  let cfg: Record<string, any> = {};
  if (typeof customConfig === 'string') {
    try {
      cfg = JSON.parse(customConfig) || {};
    } catch {
      cfg = {};
    }
  } else if (customConfig && typeof customConfig === 'object') {
    cfg = customConfig as Record<string, any>;
  }

  const nested = cfg.crossRefConfig || cfg.cross_ref_config || cfg;
  const isChildRef = String(fieldType || '').toLowerCase() === 'child-cross-reference';

  const targetFormId = String(
    nested?.targetFormId
      || nested?.target_form_id
      || cfg.targetFormId
      || cfg.target_form_id
      || (isChildRef
        ? (nested?.parentFormId || nested?.parent_form_id || cfg.parentFormId || cfg.parent_form_id)
        : '')
      || '',
  ).trim() || undefined;

  const targetFormName = String(
    nested?.targetFormName
      || nested?.target_form_name
      || cfg.targetFormName
      || cfg.target_form_name
      || (isChildRef
        ? (nested?.parentFormName || nested?.parent_form_name || cfg.parentFormName || cfg.parent_form_name)
        : '')
      || '',
  ).trim() || undefined;

  return { targetFormId, targetFormName };
}
