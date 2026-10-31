-- Control Objective Register, Asset Type Register, Asset Register, and Asset Assessment Questionnaire.
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
  v_catalog jsonb := $grccat$[{"referenceId":"grc.asset-type-register","name":"Asset Type Register","description":"Reusable catalog of asset types for inventory and control mapping.","pages":["Asset Type Identification","Classification","Lifecycle and Governance"],"fields":[{"key":"asset_type_id","label":"Asset Type ID","type":"text","required":true,"page":"Asset Type Identification","placeholder":"Stable asset type identifier","validation":{"unique":true,"trim":true}},{"key":"asset_type_name","label":"Asset Type Name","type":"text","required":true,"page":"Asset Type Identification"},{"key":"description","label":"Description","type":"textarea","required":false,"page":"Asset Type Identification"},{"key":"asset_type_code","label":"Asset Type Code","type":"text","required":false,"page":"Asset Type Identification"},{"key":"asset_category","label":"Asset Category","type":"select","required":true,"page":"Classification","options":["Hardware","Software","Data","Network","Cloud Service","Business Application","Infrastructure","Facility","Service","Other"]},{"key":"asset_subcategory","label":"Asset Subcategory","type":"text","required":false,"page":"Classification"},{"key":"typical_asset_examples","label":"Typical Asset Examples","type":"textarea","required":false,"page":"Classification"},{"key":"default_environment","label":"Default Environment","type":"select","required":false,"page":"Classification","options":["Production","Development","Test","Disaster Recovery","Corporate","Other"]},{"key":"record_status","label":"Record Status","type":"select","required":true,"page":"Lifecycle and Governance","options":["Active","Inactive"],"defaultValue":"Active"},{"key":"type_owner","label":"Type Owner","type":"user-picker","required":false,"page":"Lifecycle and Governance"},{"key":"type_notes","label":"Type Notes","type":"textarea","required":false,"page":"Lifecycle and Governance"}]},{"referenceId":"grc.asset-register","name":"Asset Register","description":"Inventory of individual assets that other modules can select through a cross-reference. Discovery records in it_assets are left unchanged.","pages":["Asset Identification","Classification and Location","Ownership and Responsibility","Financial and Business Information","Security, Impact and Recovery","Lifecycle and Assessment Results"],"fields":[{"key":"asset_id","label":"Asset ID","type":"text","required":true,"page":"Asset Identification","placeholder":"Stable asset identifier","validation":{"unique":true,"trim":true}},{"key":"asset_name","label":"Asset Name","type":"text","required":true,"page":"Asset Identification","validation":{"trim":true}},{"key":"asset_description","label":"Asset Description","type":"textarea","required":false,"page":"Asset Identification"},{"key":"asset_type","label":"Asset Type","type":"cross-reference","required":true,"page":"Asset Identification"},{"key":"asset_tag","label":"Asset Tag / Inventory Number","type":"text","required":false,"page":"Asset Identification","validation":{"unique":true,"trim":true}},{"key":"serial_number","label":"Serial Number","type":"text","required":false,"page":"Asset Identification"},{"key":"environment","label":"Environment","type":"select","required":true,"page":"Classification and Location","options":["Production","Development","Test","Disaster Recovery","Corporate","Other"]},{"key":"location","label":"Location","type":"text","required":false,"page":"Classification and Location"},{"key":"department","label":"Department / Business Unit","type":"text","required":false,"page":"Classification and Location"},{"key":"parent_asset","label":"Parent Asset","type":"cross-reference","required":false,"page":"Classification and Location"},{"key":"asset_owner","label":"Asset Owner","type":"user-picker","required":true,"page":"Ownership and Responsibility"},{"key":"asset_manager","label":"Asset Manager","type":"user-picker","required":true,"page":"Ownership and Responsibility"},{"key":"assigned_user","label":"Assigned User / Custodian","type":"user-picker","required":false,"page":"Ownership and Responsibility"},{"key":"support_team","label":"Support Team","type":"group-picker","required":false,"page":"Ownership and Responsibility"},{"key":"acquisition_date","label":"Acquisition Date","type":"date","required":false,"page":"Financial and Business Information"},{"key":"acquisition_cost","label":"Acquisition Cost","type":"number","required":false,"page":"Financial and Business Information","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"currency","label":"Currency","type":"select","required":false,"page":"Financial and Business Information","options":["USD","EUR","GBP","INR","AUD","CAD","SGD","AED","JPY","Other"]},{"key":"replacement_cost","label":"Replacement Cost","type":"number","required":false,"page":"Financial and Business Information","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"vendor","label":"Vendor / Supplier","type":"text","required":false,"page":"Financial and Business Information"},{"key":"warranty_expiry_date","label":"Warranty Expiry Date","type":"date","required":false,"page":"Financial and Business Information"},{"key":"cost_of_downtime_per_hour","label":"Cost of Downtime per Hour","type":"number","required":false,"page":"Financial and Business Information","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"estimated_financial_loss","label":"Estimated Financial Loss","type":"number","required":false,"page":"Financial and Business Information","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"business_value_rating","label":"Business Value Rating","type":"select","required":false,"page":"Financial and Business Information","options":["Low","Medium","High","Critical"]},{"key":"financial_impact_of_loss","label":"Financial Impact of Loss","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"operational_impact_of_loss","label":"Operational Impact of Loss","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"regulatory_impact_of_loss","label":"Regulatory Impact of Loss","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"customer_impact_of_loss","label":"Customer Impact of Loss","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"reputational_impact_of_loss","label":"Reputational Impact of Loss","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"confidentiality_impact","label":"Confidentiality Impact","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"integrity_impact","label":"Integrity Impact","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"availability_impact","label":"Availability Impact","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Very Low","Low","Moderate","High","Critical"],"enabled":false},{"key":"data_classification","label":"Data Classification","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Public","Internal","Confidential","Restricted"],"enabled":false},{"key":"contains_personal_data","label":"Contains Personal Data","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"contains_sensitive_data","label":"Contains Sensitive Data","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"internet_accessible","label":"Internet Accessible","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"privileged_access_supported","label":"Privileged Access Supported","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"supports_critical_business_service","label":"Supports Critical Business Service","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"third_party_hosted","label":"Third-Party Hosted","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"single_point_of_failure","label":"Single Point of Failure","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"required_rto","label":"Required RTO","type":"text","required":false,"page":"Security, Impact and Recovery","placeholder":"Include a unit, for example 4 hours","enabled":false},{"key":"required_rpo","label":"Required RPO","type":"text","required":false,"page":"Security, Impact and Recovery","placeholder":"Include a unit, for example 4 hours","enabled":false},{"key":"maximum_tolerable_downtime","label":"Maximum Tolerable Downtime","type":"text","required":false,"page":"Security, Impact and Recovery","placeholder":"Include a unit, for example 4 hours","enabled":false},{"key":"backup_frequency","label":"Backup Frequency","type":"text","required":false,"page":"Security, Impact and Recovery","placeholder":"Include a unit, for example 4 hours","enabled":false},{"key":"backup_available","label":"Backup Available","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"recovery_method","label":"Recovery Method","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Backup and Restore","High Availability / Failover","Disaster Recovery Site","Cloud Recovery","Manual Recovery","Other","Unknown"],"enabled":false},{"key":"redundancy_failover_available","label":"Redundancy / Failover Available","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"recovery_tested","label":"Recovery Tested","type":"select","required":false,"page":"Security, Impact and Recovery","options":["Yes","No","Unknown"],"enabled":false},{"key":"last_recovery_test_date","label":"Last Recovery Test Date","type":"date","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"recovery_dependencies","label":"Recovery Dependencies","type":"textarea","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"business_service","label":"Business Service","type":"text","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"upstream_dependencies","label":"Upstream Dependencies","type":"textarea","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"downstream_dependencies","label":"Downstream Dependencies","type":"textarea","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"external_provider","label":"External Provider / Vendor","type":"text","required":false,"page":"Security, Impact and Recovery","enabled":false},{"key":"asset_lifecycle_status","label":"Asset Lifecycle Status","type":"select","required":true,"page":"Lifecycle and Assessment Results","options":["Planned","Requested","Ordered","In Stock","In Use","Under Maintenance","Suspended","Retired","Disposed"],"defaultValue":"Planned"},{"key":"lifecycle_notes","label":"Lifecycle Notes","type":"textarea","required":false,"page":"Lifecycle and Assessment Results"},{"key":"commissioning_date","label":"Commissioning Date","type":"date","required":false,"page":"Lifecycle and Assessment Results"},{"key":"retirement_date","label":"Retirement Date","type":"date","required":false,"page":"Lifecycle and Assessment Results"},{"key":"asset_assessments","label":"Asset Assessments","type":"cross-reference","required":false,"page":"Lifecycle and Assessment Results"},{"key":"latest_approved_assessment","label":"Latest Approved Assessment","type":"cross-reference","required":false,"page":"Lifecycle and Assessment Results"},{"key":"asset_value_score","label":"Asset Value Score","type":"number","required":false,"page":"Lifecycle and Assessment Results","tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"asset_criticality","label":"Asset Criticality","type":"select","required":false,"page":"Lifecycle and Assessment Results","options":["Low","Medium","High","Critical","Assessment Required"],"tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"suggested_rto","label":"Suggested RTO","type":"text","required":false,"page":"Lifecycle and Assessment Results","placeholder":"Include a unit, for example 4 hours","tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"suggested_rpo","label":"Suggested RPO","type":"text","required":false,"page":"Lifecycle and Assessment Results","placeholder":"Include a unit, for example 4 hours","tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"calculation_timestamp","label":"Calculation Timestamp","type":"datetime","required":false,"page":"Lifecycle and Assessment Results","tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"calculation_rule_version","label":"Calculation Rule Version","type":"text","required":false,"page":"Lifecycle and Assessment Results","tooltip":"Copied from the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"last_assessment_date","label":"Last Assessment Date","type":"date","required":false,"page":"Lifecycle and Assessment Results","tooltip":"Copied from the Assessment Date of the Latest Approved Assessment by a SQL query field.","enabled":false},{"key":"next_review_date","label":"Next Review Date","type":"date","required":false,"page":"Lifecycle and Assessment Results","enabled":false}]},{"referenceId":"grc.asset-assessment-questionnaire","name":"Asset Assessment Questionnaire","description":"An assessment of one Asset Register record. An asset can have many assessments over time.","pages":["Assessment Information","Business Impact","Security and Data Sensitivity","Recovery Requirements","Dependencies and Evidence","Calculated Results and Approval"],"fields":[{"key":"assessment_id","label":"Assessment ID","type":"text","required":true,"page":"Assessment Information","placeholder":"Stable assessment identifier","validation":{"unique":true,"trim":true}},{"key":"assessed_asset","label":"Asset","type":"cross-reference","required":true,"page":"Assessment Information"},{"key":"assessment_owner","label":"Assessment Owner","type":"user-picker","required":true,"page":"Assessment Information"},{"key":"assessment_date","label":"Assessment Date","type":"date","required":true,"page":"Assessment Information"},{"key":"assessment_type","label":"Assessment Type","type":"select","required":true,"page":"Assessment Information","options":["Initial Assessment","Periodic Review","Material Change","Incident-Triggered Review","Reassessment"]},{"key":"assessment_status","label":"Assessment Status","type":"select","required":true,"page":"Assessment Information","options":["Draft","Submitted for Review","Changes Required","Approved","Rejected"],"defaultValue":"Draft"},{"key":"assessment_rationale","label":"Assessment Rationale","type":"textarea","required":true,"page":"Assessment Information"},{"key":"financial_impact_of_loss","label":"Financial Impact of Loss","type":"select","required":false,"page":"Business Impact","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"operational_impact_of_loss","label":"Operational Impact of Loss","type":"select","required":false,"page":"Business Impact","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"regulatory_impact_of_loss","label":"Regulatory Impact of Loss","type":"select","required":false,"page":"Business Impact","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"customer_impact_of_loss","label":"Customer Impact of Loss","type":"select","required":false,"page":"Business Impact","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"reputational_impact_of_loss","label":"Reputational Impact of Loss","type":"select","required":false,"page":"Business Impact","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"business_value_rating","label":"Business Value Rating","type":"select","required":false,"page":"Business Impact","options":["Low","Medium","High","Critical"]},{"key":"estimated_financial_loss","label":"Estimated Financial Loss","type":"number","required":false,"page":"Business Impact","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"cost_of_downtime_per_hour","label":"Cost of Downtime per Hour","type":"number","required":false,"page":"Business Impact","validation":{"min":0,"message":"Amount must be zero or greater."}},{"key":"confidentiality_impact","label":"Confidentiality Impact","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"integrity_impact","label":"Integrity Impact","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"availability_impact","label":"Availability Impact","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Very Low","Low","Moderate","High","Critical"]},{"key":"data_classification","label":"Data Classification","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Public","Internal","Confidential","Restricted"]},{"key":"contains_personal_data","label":"Contains Personal Data","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"contains_sensitive_data","label":"Contains Sensitive Data","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"internet_accessible","label":"Internet Accessible","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"privileged_access_supported","label":"Privileged Access Supported","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"supports_critical_business_service","label":"Supports Critical Business Service","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"third_party_hosted","label":"Third-Party Hosted","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"single_point_of_failure","label":"Single Point of Failure","type":"select","required":false,"page":"Security and Data Sensitivity","options":["Yes","No","Unknown"]},{"key":"required_rto","label":"Required RTO","type":"text","required":false,"page":"Recovery Requirements","placeholder":"Include a unit, for example 4 hours"},{"key":"required_rpo","label":"Required RPO","type":"text","required":false,"page":"Recovery Requirements","placeholder":"Include a unit, for example 4 hours"},{"key":"maximum_tolerable_downtime","label":"Maximum Tolerable Downtime","type":"text","required":false,"page":"Recovery Requirements","placeholder":"Include a unit, for example 4 hours"},{"key":"backup_frequency","label":"Backup Frequency","type":"text","required":false,"page":"Recovery Requirements","placeholder":"Include a unit, for example 4 hours"},{"key":"backup_available","label":"Backup Available","type":"select","required":false,"page":"Recovery Requirements","options":["Yes","No","Unknown"]},{"key":"recovery_method","label":"Recovery Method","type":"select","required":false,"page":"Recovery Requirements","options":["Backup and Restore","High Availability / Failover","Disaster Recovery Site","Cloud Recovery","Manual Recovery","Other","Unknown"]},{"key":"redundancy_failover_available","label":"Redundancy / Failover Available","type":"select","required":false,"page":"Recovery Requirements","options":["Yes","No","Unknown"]},{"key":"recovery_tested","label":"Recovery Tested","type":"select","required":false,"page":"Recovery Requirements","options":["Yes","No","Unknown"]},{"key":"last_recovery_test_date","label":"Last Recovery Test Date","type":"date","required":false,"page":"Recovery Requirements"},{"key":"recovery_dependencies","label":"Recovery Dependencies","type":"textarea","required":false,"page":"Recovery Requirements"},{"key":"business_service","label":"Business Service","type":"text","required":false,"page":"Dependencies and Evidence"},{"key":"upstream_dependencies","label":"Upstream Dependencies","type":"textarea","required":false,"page":"Dependencies and Evidence"},{"key":"downstream_dependencies","label":"Downstream Dependencies","type":"textarea","required":false,"page":"Dependencies and Evidence"},{"key":"external_provider","label":"External Provider / Vendor","type":"text","required":false,"page":"Dependencies and Evidence"},{"key":"assessment_findings","label":"Assessment Findings","type":"textarea","required":false,"page":"Dependencies and Evidence"},{"key":"recommended_actions","label":"Recommended Actions","type":"textarea","required":false,"page":"Dependencies and Evidence"},{"key":"supporting_evidence","label":"Supporting Evidence / Notes","type":"textarea","required":false,"page":"Dependencies and Evidence"},{"key":"asset_value_score","label":"Asset Value Score","type":"number","required":false,"page":"Calculated Results and Approval","tooltip":"Calculated by a SQL query field when this page opens (Asset scoring v1, maximum 100). Each of the eight impact ratings adds Very Low 2, Low 4, Moderate 6, High 8, Critical 10. Data Classification adds Internal 2, Confidential 4, Restricted 6. Business Value Rating adds Medium 2, High 4, Critical 6. Each Yes for personal data, internet access, critical business service, or single point of failure adds 2.","enabled":false},{"key":"asset_criticality","label":"Asset Criticality","type":"select","required":false,"page":"Calculated Results and Approval","options":["Low","Medium","High","Critical","Assessment Required"],"tooltip":"Calculated from Asset Value Score whenever the score changes: 75 and above Critical, 50 to 74 High, 25 to 49 Medium, 1 to 24 Low, otherwise Assessment Required.","enabled":false},{"key":"suggested_rto","label":"Suggested RTO","type":"text","required":false,"page":"Calculated Results and Approval","placeholder":"Include a unit, for example 4 hours","tooltip":"Calculated from Asset Criticality: Critical 4 hours, High 24 hours, Medium 72 hours, Low 7 days.","enabled":false},{"key":"suggested_rpo","label":"Suggested RPO","type":"text","required":false,"page":"Calculated Results and Approval","placeholder":"Include a unit, for example 4 hours","tooltip":"Calculated from Asset Criticality: Critical 1 hour, High 4 hours, Medium 24 hours, Low 72 hours.","enabled":false},{"key":"calculation_timestamp","label":"Calculation Timestamp","type":"datetime","required":false,"page":"Calculated Results and Approval","tooltip":"Set by a SQL query field whenever Asset Value Score is recalculated.","enabled":false},{"key":"calculation_rule_version","label":"Calculation Rule Version","type":"text","required":false,"page":"Calculated Results and Approval","tooltip":"Set by a SQL query field whenever Asset Value Score is recalculated.","enabled":false},{"key":"reviewing_asset_manager","label":"Reviewing Asset Manager","type":"user-picker","required":false,"page":"Calculated Results and Approval"},{"key":"review_comments","label":"Review Comments","type":"textarea","required":false,"page":"Calculated Results and Approval"},{"key":"approval_date","label":"Approval Date","type":"date","required":false,"page":"Calculated Results and Approval"},{"key":"final_approved_rto","label":"Final Approved RTO","type":"text","required":false,"page":"Calculated Results and Approval","placeholder":"Include a unit, for example 4 hours"},{"key":"final_approved_rpo","label":"Final Approved RPO","type":"text","required":false,"page":"Calculated Results and Approval","placeholder":"Include a unit, for example 4 hours"},{"key":"final_approved_asset_criticality","label":"Final Approved Asset Criticality","type":"select","required":false,"page":"Calculated Results and Approval","options":["Low","Medium","High","Critical","Assessment Required"]}]},{"referenceId":"grc.control-objective-register","name":"Control Objective Register","description":"Reusable control objectives. Each objective references one regulatory requirement and the asset types it applies to.","pages":["Control Objective Identification","Control Objective Details","Control Method and Frequency","Asset Type Mapping","Lifecycle and Governance"],"fields":[{"key":"control_objective_id","label":"Control Objective ID","type":"text","required":true,"page":"Control Objective Identification","placeholder":"Stable control objective identifier","validation":{"unique":true,"trim":true}},{"key":"control_objective_name","label":"Control Objective Name","type":"text","required":true,"page":"Control Objective Identification"},{"key":"control_objective_description","label":"Control Objective Description","type":"textarea","required":true,"page":"Control Objective Identification"},{"key":"control_objective_reference","label":"Control Objective Reference","type":"text","required":false,"page":"Control Objective Identification"},{"key":"regulatory_requirement","label":"Regulatory Requirement","type":"cross-reference","required":true,"page":"Control Objective Details"},{"key":"control_rationale","label":"Control Rationale","type":"textarea","required":false,"page":"Control Objective Details"},{"key":"expected_outcome","label":"Expected Outcome","type":"textarea","required":true,"page":"Control Objective Details"},{"key":"implementation_guidance","label":"Implementation Guidance","type":"textarea","required":false,"page":"Control Objective Details"},{"key":"evidence_requirements","label":"Evidence Requirements","type":"textarea","required":false,"page":"Control Objective Details"},{"key":"control_method","label":"Control Method","type":"select","required":true,"page":"Control Method and Frequency","options":["Preventive","Detective","Corrective","Compensating"]},{"key":"control_execution_type","label":"Control Execution Type","type":"select","required":true,"page":"Control Method and Frequency","options":["Manual","Automated","Hybrid"]},{"key":"control_frequency","label":"Control Frequency","type":"select","required":true,"page":"Control Method and Frequency","options":["Continuous","Real-Time","Daily","Weekly","Monthly","Quarterly","Semi-Annual","Annual","Event-Driven","As Required"]},{"key":"control_procedure","label":"Control Procedure","type":"textarea","required":false,"page":"Control Method and Frequency"},{"key":"evidence_expected","label":"Evidence Expected","type":"textarea","required":false,"page":"Control Method and Frequency"},{"key":"applicable_asset_types","label":"Applicable Asset Types","type":"cross-reference","required":true,"page":"Asset Type Mapping"},{"key":"control_objective_status","label":"Control Objective Status","type":"select","required":true,"page":"Lifecycle and Governance","options":["Draft","Active","Under Review","Retired"],"defaultValue":"Draft"},{"key":"effective_date","label":"Effective Date","type":"date","required":false,"page":"Lifecycle and Governance"},{"key":"review_date","label":"Review Date","type":"date","required":false,"page":"Lifecycle and Governance"},{"key":"objective_owner","label":"Objective Owner","type":"user-picker","required":false,"page":"Lifecycle and Governance"},{"key":"governance_notes","label":"Governance Notes","type":"textarea","required":false,"page":"Lifecycle and Governance"}]}]$grccat$::jsonb;
  v_links jsonb := $grclinks$[{"sourceReferenceId":"grc.control-objective-register","libraryKey":"regulatory_requirement","targetReferenceId":"grc.requirement-register","targetFormName":"Regulatory Requirement Register","displayKeys":["requirement_id","requirement_title"]},{"sourceReferenceId":"grc.control-objective-register","libraryKey":"applicable_asset_types","targetReferenceId":"grc.asset-type-register","targetFormName":"Asset Type Register","displayKeys":["asset_type_id","asset_type_name"]},{"sourceReferenceId":"grc.asset-register","libraryKey":"asset_type","targetReferenceId":"grc.asset-type-register","targetFormName":"Asset Type Register","displayKeys":["asset_type_id","asset_type_name","asset_category"]},{"sourceReferenceId":"grc.asset-register","libraryKey":"parent_asset","targetReferenceId":"grc.asset-register","targetFormName":"Asset Register","displayKeys":["asset_id","asset_name"]},{"sourceReferenceId":"grc.asset-register","libraryKey":"asset_assessments","targetReferenceId":"grc.asset-assessment-questionnaire","targetFormName":"Asset Assessment Questionnaire","displayKeys":["assessment_id","assessment_date"]},{"sourceReferenceId":"grc.asset-register","libraryKey":"latest_approved_assessment","targetReferenceId":"grc.asset-assessment-questionnaire","targetFormName":"Asset Assessment Questionnaire","displayKeys":["assessment_id","assessment_status"]},{"sourceReferenceId":"grc.asset-assessment-questionnaire","libraryKey":"assessed_asset","targetReferenceId":"grc.asset-register","targetFormName":"Asset Register","displayKeys":["asset_id","asset_name"]}]$grclinks$::jsonb;
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
