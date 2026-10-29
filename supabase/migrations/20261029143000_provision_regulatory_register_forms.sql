-- Regulatory Standard Library, Regulatory Clause Register, and Regulatory Requirement Register.
-- Inserts one of each form per project when that reference id is missing.
-- Idempotent. Does not insert sample submissions and does not edit other forms.
-- One DO block so a pooled connection can run it as a single statement.

DO $provision$
DECLARE
  proj record;
  v_std uuid;
  v_clause uuid;
  v_req uuid;
  v_created jsonb;
  v_std_fields jsonb;
  v_clause_fields jsonb;
  v_standard_spec jsonb;
  v_standard_pages jsonb;
  v_clause_spec_base jsonb;
  v_clause_pages jsonb;
  v_clause_spec jsonb;
  v_req_spec_base jsonb;
  v_req_pages jsonb;
  v_req_spec jsonb;
  v_std_labels jsonb := '{"Standard ID":"standard_id","Standard Name":"standard_name","Country / Region":"country_region"}'::jsonb;
  v_clause_labels jsonb := '{"Clause ID":"clause_id","Clause Number / Reference":"clause_number","Clause Title":"clause_title","Regulatory Standard":"regulatory_standard"}'::jsonb;
  v_req_labels jsonb := '{"Regulatory Clause":"regulatory_clause"}'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'forms'
      AND column_name = 'reference_id'
  ) THEN
    RAISE EXCEPTION 'forms.reference_id is missing';
  END IF;

  PERFORM pg_advisory_xact_lock(872341, 291430);

  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS forms_project_reference_id_regulatory_uidx
      ON public.forms (project_id, reference_id)
      WHERE reference_id IN (
        'grc.standard-library',
        'grc.clause-register',
        'grc.requirement-register'
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'regulatory form unique index skipped: %', SQLERRM;
  END;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_parse_json(p_raw jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $body$
DECLARE
  v jsonb := COALESCE(p_raw, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v) = 'string' THEN
    BEGIN
      v := (v #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN '{}'::jsonb;
    END;
    IF jsonb_typeof(v) = 'string' THEN
      BEGIN
        v := (v #>> '{}')::jsonb;
      EXCEPTION WHEN others THEN
        RETURN '{}'::jsonb;
      END;
    END IF;
  END IF;
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN v;
END;
$body$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_find_form(p_project_id uuid, p_reference_id text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $sql$
  SELECT id
  FROM public.forms
  WHERE project_id = p_project_id
    AND reference_id = p_reference_id
  ORDER BY created_at
  LIMIT 1;
$sql$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_field_map(p_form_id uuid, p_labels jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $body$
DECLARE
  v_map jsonb := '{}'::jsonb;
  v_row record;
  v_cfg jsonb;
  v_key text;
BEGIN
  FOR v_row IN
    SELECT id, label, custom_config
    FROM public.form_fields
    WHERE form_id = p_form_id
  LOOP
    v_cfg := pg_temp.reg_parse_json(v_row.custom_config);
    v_key := COALESCE(v_cfg->>'libraryKey', '');
    IF v_key <> '' AND NOT (v_map ? v_key) THEN
      v_map := v_map || jsonb_build_object(v_key, v_row.id::text);
    END IF;
    v_key := COALESCE(p_labels ->> v_row.label, '');
    IF v_key <> '' AND NOT (v_map ? v_key) THEN
      v_map := v_map || jsonb_build_object(v_key, v_row.id::text);
    END IF;
  END LOOP;
  RETURN v_map;
END;
$body$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_ensure_fill(p_form_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $body$
DECLARE
  v_perms jsonb;
BEGIN
  SELECT pg_temp.reg_parse_json(permissions) INTO v_perms
  FROM public.forms
  WHERE id = p_form_id;
  IF COALESCE(v_perms->'view', '[]'::jsonb) ? '*'
     OR COALESCE(v_perms->'submit', '[]'::jsonb) ? '*' THEN
    RETURN;
  END IF;
  UPDATE public.forms
  SET permissions = '{"view":["*"],"submit":["*"],"edit":["admin"]}'::jsonb
  WHERE id = p_form_id;
END;
$body$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_repair_country(p_form_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $body$
BEGIN
  UPDATE public.form_fields
  SET field_type = 'country',
      placeholder = 'Select a country',
      custom_config = pg_temp.reg_parse_json(custom_config) || '{"libraryKey":"country_region","searchable":true,"showFlags":true}'::jsonb
  WHERE form_id = p_form_id
    AND field_type IS DISTINCT FROM 'country'
    AND (
      pg_temp.reg_parse_json(custom_config)->>'libraryKey' = 'country_region'
      OR label = 'Country / Region'
    );
END;
$body$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_repair_xref(
  p_form_id uuid,
  p_key text,
  p_label text,
  p_target_form uuid,
  p_target_name text,
  p_columns jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $body$
DECLARE
  v_id uuid;
  v_cfg jsonb;
BEGIN
  IF p_target_form IS NULL OR p_columns IS NULL OR jsonb_array_length(p_columns) = 0 THEN
    RETURN;
  END IF;
  SELECT id INTO v_id
  FROM public.form_fields
  WHERE form_id = p_form_id
    AND (
      pg_temp.reg_parse_json(custom_config)->>'libraryKey' = p_key
      OR label = p_label
    )
  LIMIT 1;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  SELECT pg_temp.reg_parse_json(custom_config) INTO v_cfg
  FROM public.form_fields
  WHERE id = v_id;
  IF COALESCE(v_cfg->>'targetFormId', '') <> ''
     AND jsonb_typeof(v_cfg->'displayColumns') = 'array'
     AND jsonb_array_length(v_cfg->'displayColumns') > 0 THEN
    RETURN;
  END IF;
  UPDATE public.form_fields
  SET custom_config = v_cfg || jsonb_build_object(
    'libraryKey', p_key,
    'targetFormId', p_target_form,
    'targetFormName', p_target_name,
    'displayColumns', p_columns,
    'tableDisplayFields', p_columns,
    'hyperlinkField', p_columns->>0,
    'enableSorting', true,
    'enableSearch', true,
    'pageSize', 10
  )
  WHERE id = v_id;
END;
$body$;
$fn$;

  EXECUTE $fn$
CREATE OR REPLACE FUNCTION pg_temp.reg_create_form(
  p_project_id uuid,
  p_organization_id uuid,
  p_created_by text,
  p_name text,
  p_description text,
  p_reference_id text,
  p_spec jsonb,
  p_pages_def jsonb,
  p_rule_kind text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $body$
DECLARE
  v_form_id uuid := gen_random_uuid();
  v_field_ids jsonb := '{}'::jsonb;
  v_rec record;
  v_item jsonb;
  v_field_id uuid;
  v_options jsonb;
  v_pages jsonb;
  v_rules jsonb := '[]'::jsonb;
  v_config jsonb;
BEGIN
  FOR v_rec IN
    SELECT field
    FROM jsonb_array_elements(p_spec) AS field_row(field)
  LOOP
    v_field_ids := v_field_ids || jsonb_build_object(v_rec.field->>'key', gen_random_uuid()::text);
  END LOOP;

  SELECT jsonb_agg(page_obj ORDER BY ord)
  INTO v_pages
  FROM (
    SELECT
      (page_row.page->>'order')::int AS ord,
      jsonb_build_object(
        'id', 'page-' || btrim(regexp_replace(lower(page_row.page->>'name'), '[^a-z0-9]+', '-', 'g'), '-'),
        'name', page_row.page->>'name',
        'order', (page_row.page->>'order')::int,
        'fields', COALESCE((
          SELECT jsonb_agg(v_field_ids ->> (field_row.field->>'key') ORDER BY (field_row.field->>'order')::int)
          FROM jsonb_array_elements(p_spec) AS field_row(field)
          WHERE field_row.field->>'page' = page_row.page->>'name'
        ), '[]'::jsonb)
      ) AS page_obj
    FROM jsonb_array_elements(p_pages_def) AS page_row(page)
  ) pages;

  IF v_pages IS NULL OR jsonb_array_length(v_pages) = 0 THEN
    RAISE EXCEPTION 'regulatory form % has no pages', p_name;
  END IF;

  IF p_rule_kind = 'effective' THEN
    v_rules := jsonb_build_array(jsonb_build_object(
      'id', 'rule-effective-date-order',
      'name', 'Effective date cannot precede publication date',
      'isActive', true,
      'action', 'preventSubmit',
      'actionValue', 'Effective Date must not precede Publication Date.',
      'conditions', jsonb_build_array(jsonb_build_object(
        'id', 'effective-before-publication',
        'type', 'single',
        'fieldId', v_field_ids->>'effective_date',
        'operator', '<',
        'compareToField', v_field_ids->>'publication_date',
        'value', ''
      ))
    ));
  ELSIF p_rule_kind = 'verification' THEN
    v_rules := jsonb_build_array(jsonb_build_object(
      'id', 'rule-verification-date-order',
      'name', 'Verification date cannot precede last assessment date',
      'isActive', true,
      'action', 'preventSubmit',
      'actionValue', 'Verification Date must not precede Last Assessment Date.',
      'conditions', jsonb_build_array(jsonb_build_object(
        'id', 'verification-before-assessment',
        'type', 'single',
        'fieldId', v_field_ids->>'verification_date',
        'operator', '<',
        'compareToField', v_field_ids->>'last_assessment_date',
        'value', ''
      ))
    ));
  END IF;

  INSERT INTO public.forms (
    id,
    name,
    description,
    organization_id,
    project_id,
    status,
    created_by,
    is_public,
    reference_id,
    permissions,
    share_settings,
    field_rules,
    form_rules,
    layout,
    pages
  ) VALUES (
    v_form_id,
    p_name,
    p_description,
    p_organization_id,
    p_project_id,
    'active',
    p_created_by,
    false,
    p_reference_id,
    '{"view":["*"],"submit":["*"],"edit":["admin"]}'::jsonb,
    '{"allowPublicAccess":false,"sharedUsers":[]}'::jsonb,
    '[]'::jsonb,
    v_rules,
    '{"columns":2}'::jsonb,
    v_pages
  );

  FOR v_rec IN
    SELECT field
    FROM jsonb_array_elements(p_spec) AS field_row(field)
  LOOP
    v_item := v_rec.field;
    v_field_id := (v_field_ids ->> (v_item->>'key'))::uuid;
    v_options := NULL;
    IF v_item ? 'options' THEN
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', 'opt-' || btrim(regexp_replace(lower(opt), '[^a-z0-9]+', '-', 'g'), '-'),
          'value', opt,
          'label', opt
        )
        ORDER BY n
      ), '[]'::jsonb)
      INTO v_options
      FROM jsonb_array_elements_text(v_item->'options') WITH ORDINALITY AS t(opt, n);
    END IF;
    v_config := COALESCE(v_item->'config', '{}'::jsonb) || jsonb_build_object('libraryKey', v_item->>'key');
    INSERT INTO public.form_fields (
      id,
      form_id,
      field_type,
      label,
      placeholder,
      required,
      default_value,
      options,
      validation,
      permissions,
      triggers,
      is_visible,
      is_enabled,
      current_value,
      tooltip,
      error_message,
      field_order,
      custom_config
    ) VALUES (
      v_field_id,
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
      true,
      '',
      COALESCE(v_item->>'tooltip', ''),
      '',
      COALESCE((v_item->>'order')::int, 0),
      v_config
    );
  END LOOP;

  IF (SELECT count(*) FROM public.form_fields WHERE form_id = v_form_id) <> jsonb_array_length(p_spec) THEN
    RAISE EXCEPTION 'regulatory form % field count mismatch', p_name;
  END IF;

  RETURN jsonb_build_object('formId', v_form_id::text, 'fields', v_field_ids);
END;
$body$;
$fn$;

  v_standard_pages := $pages$
[{"name":"Standard Identification","order":0},{"name":"Classification and Jurisdiction","order":1},{"name":"Official Source and Version","order":2},{"name":"Legal Status","order":3},{"name":"Related Clauses","order":4}]
$pages$::jsonb;

  v_standard_spec := $spec$
[
  {"key":"standard_id","label":"Standard ID","type":"text","required":true,"page":"Standard Identification","order":0,"placeholder":"Stable standard identifier","validation":{"unique":true,"trim":true}},
  {"key":"standard_name","label":"Standard Name","type":"text","required":true,"page":"Standard Identification","order":1},
  {"key":"short_name","label":"Short Name / Acronym","type":"text","required":false,"page":"Standard Identification","order":2},
  {"key":"standard_type","label":"Standard Type","type":"select","required":true,"page":"Standard Identification","order":3,"options":["Regulation","Act / Legislation","Regulatory Rule","Technical Standard","Industry Standard","Code of Practice","Framework","Guidance","Other"]},
  {"key":"description","label":"Description","type":"textarea","required":false,"page":"Standard Identification","order":4},
  {"key":"jurisdiction_type","label":"Jurisdiction Type","type":"select","required":true,"page":"Classification and Jurisdiction","order":5,"options":["Global / International","Regional / Supranational","National","State / Provincial","Local","Industry-Specific","Other"]},
  {"key":"country_region","label":"Country / Region","type":"country","required":false,"page":"Classification and Jurisdiction","order":6,"placeholder":"Select a country","config":{"searchable":true,"showFlags":true}},
  {"key":"issuing_authority","label":"Issuing Authority","type":"text","required":true,"page":"Classification and Jurisdiction","order":7},
  {"key":"industry_sector","label":"Industry / Sector","type":"multi-select","required":false,"page":"Classification and Jurisdiction","order":8,"options":["Financial Services","Healthcare","Technology","Government / Public Sector","Manufacturing","Energy","Telecommunications","Cross-Industry","Other"]},
  {"key":"official_source_url","label":"Official Source URL","type":"url","required":true,"page":"Official Source and Version","order":9,"placeholder":"https://","config":{"protocolRestriction":"http-or-https","realTimeValidation":true,"validationMessage":"Enter an absolute HTTP or HTTPS URL."}},
  {"key":"publication_reference","label":"Official Publication Reference","type":"text","required":false,"page":"Official Source and Version","order":10},
  {"key":"version_edition","label":"Version / Edition","type":"text","required":false,"page":"Official Source and Version","order":11},
  {"key":"publication_date","label":"Publication Date","type":"date","required":false,"page":"Official Source and Version","order":12},
  {"key":"effective_date","label":"Effective Date","type":"date","required":false,"page":"Official Source and Version","order":13},
  {"key":"source_language","label":"Source Language","type":"text","required":false,"page":"Official Source and Version","order":14},
  {"key":"legal_status","label":"Legal Status","type":"select","required":true,"page":"Legal Status","order":15,"defaultValue":"Unknown","options":["Unknown","Proposed","Published","Enacted / Adopted","In Force","Partially In Force","Superseded","Repealed","Withdrawn"]},
  {"key":"repeal_expiry_date","label":"Repeal / Expiry Date","type":"date","required":false,"page":"Legal Status","order":16}
]
$spec$::jsonb;

  v_clause_pages := $pages$
[{"name":"Clause Identification","order":0},{"name":"Clause Content","order":1},{"name":"Classification","order":2},{"name":"Related Standard","order":3}]
$pages$::jsonb;

  v_clause_spec_base := $spec$
[
  {"key":"clause_id","label":"Clause ID","type":"text","required":true,"page":"Clause Identification","order":0,"placeholder":"Stable clause identifier","validation":{"unique":true,"trim":true}},
  {"key":"clause_number","label":"Clause Number / Reference","type":"text","required":true,"page":"Clause Identification","order":1},
  {"key":"clause_title","label":"Clause Title","type":"text","required":true,"page":"Clause Identification","order":2},
  {"key":"short_reference","label":"Short Reference","type":"text","required":false,"page":"Clause Identification","order":3},
  {"key":"clause_text","label":"Clause Text","type":"textarea","required":true,"page":"Clause Content","order":4},
  {"key":"clause_summary","label":"Clause Summary","type":"textarea","required":false,"page":"Clause Content","order":5},
  {"key":"clause_category","label":"Clause Category","type":"select","required":true,"page":"Classification","order":6,"options":["Governance","Risk Management","Compliance Obligations","Reporting and Disclosure","Recordkeeping and Documentation","Data Protection and Privacy","Information Security","Incident Management","Third-Party Management","Training and Awareness","Monitoring and Testing","Business Continuity","Technical Requirements","Other"]},
  {"key":"topic_keywords","label":"Topic / Keywords","type":"text","required":false,"page":"Classification","order":7},
  {"key":"effective_date","label":"Effective Date","type":"date","required":false,"page":"Classification","order":8},
  {"key":"regulatory_standard","label":"Regulatory Standard","type":"cross-reference","required":true,"page":"Related Standard","order":9}
]
$spec$::jsonb;

  v_req_pages := $pages$
[{"name":"Requirement Identification","order":0},{"name":"Requirement Details","order":1},{"name":"Classification","order":2},{"name":"Implementation Lifecycle","order":3},{"name":"Related Clause","order":4}]
$pages$::jsonb;

  v_req_spec_base := $spec$
[
  {"key":"requirement_id","label":"Requirement ID","type":"text","required":true,"page":"Requirement Identification","order":0,"placeholder":"Stable requirement identifier","validation":{"unique":true,"trim":true}},
  {"key":"requirement_title","label":"Requirement Title","type":"text","required":true,"page":"Requirement Identification","order":1},
  {"key":"requirement_reference","label":"Requirement Reference","type":"text","required":false,"page":"Requirement Identification","order":2},
  {"key":"requirement_description","label":"Requirement Description","type":"textarea","required":true,"page":"Requirement Details","order":3},
  {"key":"implementation_guidance","label":"Implementation Guidance","type":"textarea","required":false,"page":"Requirement Details","order":4},
  {"key":"implementation_evidence","label":"Implementation Evidence / Notes","type":"textarea","required":false,"page":"Requirement Details","order":5},
  {"key":"requirement_type","label":"Requirement Type","type":"select","required":true,"page":"Classification","order":6,"options":["Governance","Policy","Process","Operational Control","Technical Control","Reporting","Recordkeeping","Training","Third-Party Obligation","Monitoring","Incident Management","Business Continuity","Other"]},
  {"key":"priority","label":"Priority","type":"select","required":true,"page":"Classification","order":7,"options":["Critical","High","Medium","Low"]},
  {"key":"implementation_status","label":"Implementation Status","type":"select","required":true,"page":"Implementation Lifecycle","order":8,"defaultValue":"Not Started","tooltip":"Not Started: Implementation work has not started. Partially Implemented: Some, but not all, required implementation work is complete. Not Implemented: The requirement has been assessed and implementation has not been completed. Implemented: Implementation has been completed. Not Applicable: The requirement has been assessed as not applicable.","options":["Not Started","Partially Implemented","Not Implemented","Implemented","Not Applicable"]},
  {"key":"implementation_notes","label":"Implementation Notes","type":"textarea","required":false,"page":"Implementation Lifecycle","order":9},
  {"key":"last_assessment_date","label":"Last Assessment Date","type":"date","required":false,"page":"Implementation Lifecycle","order":10},
  {"key":"verification_date","label":"Verification Date","type":"date","required":false,"page":"Implementation Lifecycle","order":11},
  {"key":"regulatory_clause","label":"Regulatory Clause","type":"cross-reference","required":true,"page":"Related Clause","order":12}
]
$spec$::jsonb;

  FOR proj IN
    SELECT id, organization_id, created_by::text AS created_by
    FROM public.projects
    WHERE organization_id IS NOT NULL
      AND created_by IS NOT NULL
      AND btrim(created_by::text) <> ''
  LOOP
    BEGIN
    v_std := pg_temp.reg_find_form(proj.id, 'grc.standard-library');
    IF v_std IS NULL THEN
      BEGIN
        v_created := pg_temp.reg_create_form(
          proj.id,
          proj.organization_id,
          proj.created_by,
          'Regulatory Standard Library',
          'Catalog of regulatory standards: identification, jurisdiction, official source, and legal status.',
          'grc.standard-library',
          v_standard_spec,
          v_standard_pages,
          'effective'
        );
        v_std := (v_created->>'formId')::uuid;
        v_std_fields := v_created->'fields';
      EXCEPTION WHEN unique_violation THEN
        v_std := pg_temp.reg_find_form(proj.id, 'grc.standard-library');
        v_std_fields := CASE WHEN v_std IS NULL THEN '{}'::jsonb ELSE pg_temp.reg_field_map(v_std, v_std_labels) END;
      END;
    ELSE
      PERFORM pg_temp.reg_ensure_fill(v_std);
      PERFORM pg_temp.reg_repair_country(v_std);
      v_std_fields := pg_temp.reg_field_map(v_std, v_std_labels);
    END IF;

    IF v_std IS NOT NULL
       AND (v_std_fields ? 'standard_id')
       AND (v_std_fields ? 'standard_name') THEN

    SELECT jsonb_agg(
      CASE
        WHEN field_row.field->>'key' = 'regulatory_standard' THEN
          field_row.field || jsonb_build_object('config', jsonb_build_object(
            'targetFormId', v_std,
            'targetFormName', 'Regulatory Standard Library',
            'displayColumns', jsonb_build_array(v_std_fields->>'standard_id', v_std_fields->>'standard_name'),
            'tableDisplayFields', jsonb_build_array(v_std_fields->>'standard_id', v_std_fields->>'standard_name'),
            'hyperlinkField', v_std_fields->>'standard_id',
            'enableSorting', true,
            'enableSearch', true,
            'pageSize', 10
          ))
        ELSE field_row.field
      END
      ORDER BY (field_row.field->>'order')::int
    )
    INTO v_clause_spec
    FROM jsonb_array_elements(v_clause_spec_base) AS field_row(field);

    v_clause := pg_temp.reg_find_form(proj.id, 'grc.clause-register');
    IF v_clause IS NULL THEN
      BEGIN
        v_created := pg_temp.reg_create_form(
          proj.id,
          proj.organization_id,
          proj.created_by,
          'Regulatory Clause Register',
          'Clauses linked to a regulatory standard. Clause text is stored as entered.',
          'grc.clause-register',
          v_clause_spec,
          v_clause_pages,
          'none'
        );
        v_clause := (v_created->>'formId')::uuid;
        v_clause_fields := v_created->'fields';
      EXCEPTION WHEN unique_violation THEN
        v_clause := pg_temp.reg_find_form(proj.id, 'grc.clause-register');
        v_clause_fields := CASE WHEN v_clause IS NULL THEN '{}'::jsonb ELSE pg_temp.reg_field_map(v_clause, v_clause_labels) END;
      END;
    ELSE
      PERFORM pg_temp.reg_ensure_fill(v_clause);
      PERFORM pg_temp.reg_repair_xref(
        v_clause,
        'regulatory_standard',
        'Regulatory Standard',
        v_std,
        'Regulatory Standard Library',
        jsonb_build_array(v_std_fields->>'standard_id', v_std_fields->>'standard_name')
      );
      v_clause_fields := pg_temp.reg_field_map(v_clause, v_clause_labels);
    END IF;

    IF v_clause IS NOT NULL
       AND (v_clause_fields ? 'clause_id')
       AND (v_clause_fields ? 'clause_number')
       AND (v_clause_fields ? 'clause_title') THEN

    SELECT jsonb_agg(
      CASE
        WHEN field_row.field->>'key' = 'regulatory_clause' THEN
          field_row.field || jsonb_build_object('config', jsonb_build_object(
            'targetFormId', v_clause,
            'targetFormName', 'Regulatory Clause Register',
            'displayColumns', jsonb_build_array(
              v_clause_fields->>'clause_id',
              v_clause_fields->>'clause_number',
              v_clause_fields->>'clause_title'
            ),
            'tableDisplayFields', jsonb_build_array(
              v_clause_fields->>'clause_id',
              v_clause_fields->>'clause_number',
              v_clause_fields->>'clause_title'
            ),
            'hyperlinkField', v_clause_fields->>'clause_id',
            'enableSorting', true,
            'enableSearch', true,
            'pageSize', 10
          ))
        ELSE field_row.field
      END
      ORDER BY (field_row.field->>'order')::int
    )
    INTO v_req_spec
    FROM jsonb_array_elements(v_req_spec_base) AS field_row(field);

    v_req := pg_temp.reg_find_form(proj.id, 'grc.requirement-register');
    IF v_req IS NULL THEN
      BEGIN
        PERFORM pg_temp.reg_create_form(
          proj.id,
          proj.organization_id,
          proj.created_by,
          'Regulatory Requirement Register',
          'Requirements linked to a regulatory clause, with an implementation status chosen by the user.',
          'grc.requirement-register',
          v_req_spec,
          v_req_pages,
          'verification'
        );
      EXCEPTION WHEN unique_violation THEN
        PERFORM pg_temp.reg_ensure_fill(pg_temp.reg_find_form(proj.id, 'grc.requirement-register'));
      END;
    ELSE
      PERFORM pg_temp.reg_ensure_fill(v_req);
      PERFORM pg_temp.reg_repair_xref(
        v_req,
        'regulatory_clause',
        'Regulatory Clause',
        v_clause,
        'Regulatory Clause Register',
        jsonb_build_array(
          v_clause_fields->>'clause_id',
          v_clause_fields->>'clause_number',
          v_clause_fields->>'clause_title'
        )
      );
    END IF;
    END IF;
    END IF;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE NOTICE 'regulatory forms skipped for project %: %', proj.id, SQLERRM;
    END;
  END LOOP;

  DROP FUNCTION IF EXISTS pg_temp.reg_create_form(uuid, uuid, text, text, text, text, jsonb, jsonb, text);
  DROP FUNCTION IF EXISTS pg_temp.reg_repair_xref(uuid, text, text, uuid, text, jsonb);
  DROP FUNCTION IF EXISTS pg_temp.reg_repair_country(uuid);
  DROP FUNCTION IF EXISTS pg_temp.reg_ensure_fill(uuid);
  DROP FUNCTION IF EXISTS pg_temp.reg_field_map(uuid, jsonb);
  DROP FUNCTION IF EXISTS pg_temp.reg_find_form(uuid, text);
  DROP FUNCTION IF EXISTS pg_temp.reg_parse_json(jsonb);
END;
$provision$;
