import { GRC_CROSS_LINKS, GRC_FOUNDATION_FORMS } from '@/lib/grc/foundationCatalog';

function sqlCatalog() {
  return GRC_FOUNDATION_FORMS.map((form) => ({
    referenceId: form.referenceId,
    name: form.name,
    description: form.description,
    pages: form.pages,
    fields: form.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      page: field.page,
      ...(field.options ? { options: [...field.options] } : {}),
      ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      ...(field.tooltip ? { tooltip: field.tooltip } : {}),
      ...(field.validation ? { validation: field.validation } : {}),
      ...(field.enabled === false ? { enabled: false } : {}),
    })),
  }));
}

function sqlLinks() {
  return GRC_CROSS_LINKS.map((link) => ({
    sourceReferenceId: link.sourceReferenceId,
    libraryKey: link.libraryKey,
    targetReferenceId: link.targetReferenceId,
    targetFormName: link.targetFormName,
    displayKeys: [...link.displayKeys],
  }));
}

/**
 * Idempotent provision of the four foundation forms.
 * Cross-references are filled from forms that already exist for the same project,
 * including Regulatory Requirement Register. It does not modify that form's fields.
 */
export function buildGrcFoundationSql(): string {
  const catalog = JSON.stringify(sqlCatalog());
  const links = JSON.stringify(sqlLinks());
  if (catalog.includes('$grccat$') || links.includes('$grclinks$') || catalog.includes('grc.regulatory.')) {
    throw new Error('GRC foundation SQL catalog cannot be embedded safely');
  }

  return `-- Control Objective Register, Asset Type Register, Asset Register, and Asset Assessment Questionnaire.
-- Idempotent per project and reference_id. Does not modify Regulatory Standard Library,
-- Regulatory Clause Register, or Regulatory Requirement Register fields, and does not write it_assets.

DO $grc$
DECLARE
  v_project record;
  v_form jsonb;
  v_field record;
  v_item jsonb;
  v_link record;
  v_link_item jsonb;
  v_key text;
  v_form_id uuid;
  v_existing uuid;
  v_source_form uuid;
  v_target_form uuid;
  v_display_id uuid;
  v_pages jsonb;
  v_field_ids jsonb;
  v_options jsonb;
  v_config jsonb;
  v_display jsonb;
  v_missing boolean;
  v_order integer;
  v_catalog jsonb := $grccat$${catalog}$grccat$::jsonb;
  v_links jsonb := $grclinks$${links}$grclinks$::jsonb;
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS forms_project_reference_id_grc_foundation_uidx
      ON public.forms (project_id, reference_id)
      WHERE reference_id IN (
        'grc.control-objective-register',
        'grc.asset-type-register',
        'grc.asset-register',
        'grc.asset-assessment-questionnaire'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'grc foundation unique index skipped: %', SQLERRM;
  END;

  CREATE TEMP TABLE IF NOT EXISTS grc_foundation_field (
    project_id uuid,
    reference_id text,
    field_key text,
    field_id uuid,
    form_id uuid
  ) ON COMMIT DROP;
  DELETE FROM grc_foundation_field;

  FOR v_project IN
    SELECT id, organization_id, created_by::text AS created_by
    FROM public.projects
    WHERE organization_id IS NOT NULL
      AND created_by IS NOT NULL
      AND btrim(created_by::text) <> ''
  LOOP
    BEGIN
      FOR v_form IN SELECT value FROM jsonb_array_elements(v_catalog)
      LOOP
        SELECT id INTO v_existing
        FROM public.forms
        WHERE project_id = v_project.id
          AND reference_id = v_form->>'referenceId'
        LIMIT 1;

        IF v_existing IS NULL THEN
          v_form_id := gen_random_uuid();
          v_field_ids := '{}'::jsonb;
          FOR v_field IN SELECT value FROM jsonb_array_elements(v_form->'fields') AS field_row(value)
          LOOP
            v_item := v_field.value;
            v_field_ids := v_field_ids || jsonb_build_object(v_item->>'key', gen_random_uuid()::text);
          END LOOP;

          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', 'page-' || btrim(regexp_replace(lower(page_name), '[^a-z0-9]+', '-', 'g'), '-'),
            'name', page_name,
            'order', page_ord - 1,
            'fields', (
              SELECT COALESCE(jsonb_agg(v_field_ids ->> (field_item->>'key') ORDER BY field_ord), '[]'::jsonb)
              FROM jsonb_array_elements(v_form->'fields') WITH ORDINALITY AS field_row(field_item, field_ord)
              WHERE field_item->>'page' = page_name
            )
          ) ORDER BY page_ord), '[]'::jsonb)
          INTO v_pages
          FROM jsonb_array_elements_text(v_form->'pages') WITH ORDINALITY AS page_row(page_name, page_ord);

          INSERT INTO public.forms (
            id, name, description, organization_id, project_id, status, created_by,
            is_public, reference_id, permissions, share_settings, field_rules, form_rules, layout, pages
          ) VALUES (
            v_form_id,
            v_form->>'name',
            v_form->>'description',
            v_project.organization_id,
            v_project.id,
            'active',
            v_project.created_by,
            false,
            v_form->>'referenceId',
            '{"view":["*"],"submit":["*"],"edit":["admin"]}'::jsonb,
            '{"allowPublicAccess":false,"sharedUsers":[]}'::jsonb,
            '[]'::jsonb,
            '[]'::jsonb,
            '{"columns":2}'::jsonb,
            v_pages
          );

          v_order := 0;
          FOR v_field IN SELECT value FROM jsonb_array_elements(v_form->'fields') AS field_row(value)
          LOOP
            v_item := v_field.value;
            v_options := NULL;
            IF v_item ? 'options' THEN
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', 'opt-' || btrim(regexp_replace(lower(opt), '[^a-z0-9]+', '-', 'g'), '-'),
                'value', opt,
                'label', opt
              ) ORDER BY n), '[]'::jsonb)
              INTO v_options
              FROM jsonb_array_elements_text(v_item->'options') WITH ORDINALITY AS option_row(opt, n);
            END IF;
            v_config := jsonb_build_object('libraryKey', v_item->>'key');
            INSERT INTO public.form_fields (
              id, form_id, field_type, label, placeholder, required, default_value, options,
              validation, permissions, triggers, is_visible, is_enabled, current_value,
              tooltip, error_message, field_order, custom_config
            ) VALUES (
              (v_field_ids ->> (v_item->>'key'))::uuid,
              v_form_id,
              v_item->>'type',
              v_item->>'label',
              COALESCE(v_item->>'placeholder', ''),
              COALESCE((v_item->>'required')::boolean, false),
              v_item->>'defaultValue',
              v_options,
              v_item->'validation',
              '{"read":["*"],"write":["*"]}'::jsonb,
              '[]'::jsonb,
              true,
              COALESCE((v_item->>'enabled')::boolean, true),
              '',
              COALESCE(v_item->>'tooltip', ''),
              '',
              v_order,
              v_config
            );
            INSERT INTO grc_foundation_field (project_id, reference_id, field_key, field_id, form_id)
            VALUES (
              v_project.id,
              v_form->>'referenceId',
              v_item->>'key',
              (v_field_ids ->> (v_item->>'key'))::uuid,
              v_form_id
            );
            v_order := v_order + 1;
          END LOOP;
        ELSE
          v_form_id := v_existing;
          INSERT INTO grc_foundation_field (project_id, reference_id, field_key, field_id, form_id)
          SELECT
            v_project.id,
            v_form->>'referenceId',
            CASE
              WHEN jsonb_typeof(ff.custom_config) = 'object' THEN ff.custom_config->>'libraryKey'
              WHEN jsonb_typeof(ff.custom_config) = 'string' THEN ((ff.custom_config #>> '{}')::jsonb ->> 'libraryKey')
              ELSE NULL
            END,
            ff.id,
            ff.form_id
          FROM public.form_fields ff
          WHERE ff.form_id = v_existing;
        END IF;
      END LOOP;

      FOR v_link IN SELECT value FROM jsonb_array_elements(v_links) AS link_row(value)
      LOOP
        v_link_item := v_link.value;
        SELECT form_id INTO v_source_form
        FROM grc_foundation_field
        WHERE project_id = v_project.id
          AND reference_id = v_link_item->>'sourceReferenceId'
        LIMIT 1;

        SELECT id INTO v_target_form
        FROM public.forms
        WHERE project_id = v_project.id
          AND reference_id = v_link_item->>'targetReferenceId'
        LIMIT 1;

        IF v_source_form IS NOT NULL AND v_target_form IS NOT NULL THEN
          v_display := '[]'::jsonb;
          v_missing := false;
          FOR v_key IN SELECT value FROM jsonb_array_elements_text(v_link_item->'displayKeys') AS key_row(value)
          LOOP
            v_display_id := NULL;
            IF NOT v_missing THEN
              SELECT ff.id INTO v_display_id
              FROM public.form_fields ff
              WHERE ff.form_id = v_target_form
                AND (
                  (jsonb_typeof(ff.custom_config) = 'object' AND ff.custom_config->>'libraryKey' = v_key)
                  OR (jsonb_typeof(ff.custom_config) = 'string' AND ((ff.custom_config #>> '{}')::jsonb ->> 'libraryKey') = v_key)
                )
              LIMIT 1;
              IF v_display_id IS NULL THEN
                v_missing := true;
              ELSE
                v_display := v_display || jsonb_build_array(v_display_id::text);
              END IF;
            END IF;
          END LOOP;

          IF NOT v_missing THEN
            UPDATE public.form_fields ff
            SET custom_config = (
              CASE
                WHEN jsonb_typeof(ff.custom_config) = 'object' THEN ff.custom_config
                WHEN jsonb_typeof(ff.custom_config) = 'string' THEN (ff.custom_config #>> '{}')::jsonb
                ELSE '{}'::jsonb
              END
            ) || jsonb_build_object(
              'libraryKey', v_link_item->>'libraryKey',
              'targetFormId', v_target_form::text,
              'targetFormName', v_link_item->>'targetFormName',
              'displayColumns', v_display,
              'tableDisplayFields', v_display,
              'hyperlinkField', v_display->>0,
              'enableSorting', true,
              'enableSearch', true,
              'pageSize', 10
            )
            WHERE ff.form_id = v_source_form
              AND (
                (jsonb_typeof(ff.custom_config) = 'object' AND ff.custom_config->>'libraryKey' = v_link_item->>'libraryKey')
                OR (
                  jsonb_typeof(ff.custom_config) = 'string'
                  AND ((ff.custom_config #>> '{}')::jsonb ->> 'libraryKey') = v_link_item->>'libraryKey'
                )
              );
          END IF;
        END IF;
      END LOOP;
    EXCEPTION
      WHEN foreign_key_violation THEN
        RAISE NOTICE 'grc foundation skipped project %: %', v_project.id, SQLERRM;
    END;
  END LOOP;
END
$grc$;
`;
}
