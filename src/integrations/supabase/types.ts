export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          allowed_ips: string[] | null
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          permissions: Json
          project_id: string | null
          rate_limit_per_minute: number | null
          updated_at: string
        }
        Insert: {
          allowed_ips?: string[] | null
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          permissions?: Json
          project_id?: string | null
          rate_limit_per_minute?: number | null
          updated_at?: string
        }
        Update: {
          allowed_ips?: string[] | null
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          permissions?: Json
          project_id?: string | null
          rate_limit_per_minute?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          organization_id: string
          request_body: Json | null
          response_status: number | null
          response_time_ms: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          organization_id: string
          request_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          organization_id?: string
          request_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_permissions: {
        Row: {
          asset_id: string
          asset_type: string
          granted_at: string
          granted_by: string | null
          id: string
          permission_type: string
          project_id: string
          user_id: string
        }
        Insert: {
          asset_id: string
          asset_type: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_type: string
          project_id: string
          user_id: string
        }
        Update: {
          asset_id?: string
          asset_type?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_type?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          assigned_to: string | null
          audit_id: string
          closed_at: string | null
          closed_by: string | null
          control_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          finding_ref: string | null
          finding_type: string
          id: string
          management_response: string | null
          policy_id: string | null
          recommendation: string | null
          remediation_plan: string | null
          root_cause: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          audit_id: string
          closed_at?: string | null
          closed_by?: string | null
          control_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          finding_ref?: string | null
          finding_type?: string
          id?: string
          management_response?: string | null
          policy_id?: string | null
          recommendation?: string | null
          remediation_plan?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          audit_id?: string
          closed_at?: string | null
          closed_by?: string | null
          control_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          finding_ref?: string | null
          finding_type?: string
          id?: string
          management_response?: string | null
          policy_id?: string | null
          recommendation?: string | null
          remediation_plan?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          created_at: string
          description: string | null
          event_category: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_category: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_programs: {
        Row: {
          audit_type: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          folder_id: string | null
          framework_id: string | null
          id: string
          lead_auditor_id: string | null
          name: string
          objectives: string | null
          organization_id: string | null
          project_id: string
          scope: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audit_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          framework_id?: string | null
          id?: string
          lead_auditor_id?: string | null
          name: string
          objectives?: string | null
          organization_id?: string | null
          project_id: string
          scope?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          folder_id?: string | null
          framework_id?: string | null
          id?: string
          lead_auditor_id?: string | null
          name?: string
          objectives?: string | null
          organization_id?: string | null
          project_id?: string
          scope?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_programs_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_programs_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "compliance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_programs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_holidays: {
        Row: {
          created_at: string | null
          created_by: string
          holiday_date: string
          id: string
          is_recurring: boolean | null
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          holiday_date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          holiday_date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_controls: {
        Row: {
          category: string | null
          control_id_ref: string
          created_at: string
          description: string | null
          effectiveness: string | null
          framework_id: string
          id: string
          implementation_status: string
          notes: string | null
          owner_id: string | null
          parent_control_id: string | null
          risk_level: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          control_id_ref: string
          created_at?: string
          description?: string | null
          effectiveness?: string | null
          framework_id: string
          id?: string
          implementation_status?: string
          notes?: string | null
          owner_id?: string | null
          parent_control_id?: string | null
          risk_level?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          control_id_ref?: string
          created_at?: string
          description?: string | null
          effectiveness?: string | null
          framework_id?: string
          id?: string
          implementation_status?: string
          notes?: string | null
          owner_id?: string | null
          parent_control_id?: string | null
          risk_level?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "compliance_frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_controls_parent_control_id_fkey"
            columns: ["parent_control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_frameworks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          framework_type: string
          id: string
          name: string
          organization_id: string | null
          project_id: string
          status: string
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          framework_type?: string
          id?: string
          name: string
          organization_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          framework_type?: string
          id?: string
          name?: string
          organization_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_frameworks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_frameworks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      control_tests: {
        Row: {
          actual_result: string | null
          control_id: string
          created_at: string
          created_by: string
          expected_result: string | null
          id: string
          next_test_date: string | null
          notes: string | null
          project_id: string
          test_description: string | null
          test_name: string
          test_procedure: string | null
          test_result: string
          test_type: string
          tested_at: string | null
          tested_by: string | null
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          control_id: string
          created_at?: string
          created_by: string
          expected_result?: string | null
          id?: string
          next_test_date?: string | null
          notes?: string | null
          project_id: string
          test_description?: string | null
          test_name: string
          test_procedure?: string | null
          test_result?: string
          test_type?: string
          tested_at?: string | null
          tested_by?: string | null
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          control_id?: string
          created_at?: string
          created_by?: string
          expected_result?: string | null
          id?: string
          next_test_date?: string | null
          notes?: string | null
          project_id?: string
          test_description?: string | null
          test_name?: string
          test_procedure?: string | null
          test_result?: string
          test_type?: string
          tested_at?: string | null
          tested_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_tests_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_tests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean | null
          is_public: boolean | null
          layout: Json | null
          name: string
          organization_id: string | null
          project_id: string
          reference_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          layout?: Json | null
          name: string
          organization_id?: string | null
          project_id: string
          reference_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          layout?: Json | null
          name?: string
          organization_id?: string | null
          project_id?: string
          reference_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      data_feed_runs: {
        Row: {
          completed_at: string | null
          data_feed_id: string
          error_details: Json | null
          errors_count: number | null
          id: string
          records_created: number | null
          records_processed: number | null
          records_skipped: number | null
          records_updated: number | null
          run_log: Json | null
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          data_feed_id: string
          error_details?: Json | null
          errors_count?: number | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          run_log?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          data_feed_id?: string
          error_details?: Json | null
          errors_count?: number | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          run_log?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_feed_runs_data_feed_id_fkey"
            columns: ["data_feed_id"]
            isOneToOne: false
            referencedRelation: "data_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      data_feeds: {
        Row: {
          created_at: string
          created_by: string
          cross_ref_match_logic: string | null
          cross_ref_match_rules: Json | null
          cross_ref_record_selection: string | null
          cross_reference_field_id: string | null
          data_source_connection_id: string | null
          description: string | null
          external_source_config: Json | null
          field_mappings: Json
          id: string
          is_active: boolean
          last_run_at: string | null
          last_run_stats: Json | null
          last_run_status: string | null
          matching_logic: string | null
          matching_rules: Json | null
          matching_type: string
          name: string
          nested_cross_ref_mappings: Json | null
          no_match_behavior: string
          organization_id: string | null
          project_id: string
          schedule: string | null
          source_filter_logic: string | null
          source_filters: Json | null
          source_form_id: string
          source_type: string | null
          target_form_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          cross_ref_match_logic?: string | null
          cross_ref_match_rules?: Json | null
          cross_ref_record_selection?: string | null
          cross_reference_field_id?: string | null
          data_source_connection_id?: string | null
          description?: string | null
          external_source_config?: Json | null
          field_mappings?: Json
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_stats?: Json | null
          last_run_status?: string | null
          matching_logic?: string | null
          matching_rules?: Json | null
          matching_type?: string
          name: string
          nested_cross_ref_mappings?: Json | null
          no_match_behavior?: string
          organization_id?: string | null
          project_id: string
          schedule?: string | null
          source_filter_logic?: string | null
          source_filters?: Json | null
          source_form_id: string
          source_type?: string | null
          target_form_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          cross_ref_match_logic?: string | null
          cross_ref_match_rules?: Json | null
          cross_ref_record_selection?: string | null
          cross_reference_field_id?: string | null
          data_source_connection_id?: string | null
          description?: string | null
          external_source_config?: Json | null
          field_mappings?: Json
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_run_stats?: Json | null
          last_run_status?: string | null
          matching_logic?: string | null
          matching_rules?: Json | null
          matching_type?: string
          name?: string
          nested_cross_ref_mappings?: Json | null
          no_match_behavior?: string
          organization_id?: string | null
          project_id?: string
          schedule?: string | null
          source_filter_logic?: string | null
          source_filters?: Json | null
          source_form_id?: string
          source_type?: string | null
          target_form_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_feeds_cross_reference_field_id_fkey"
            columns: ["cross_reference_field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_feeds_data_source_connection_id_fkey"
            columns: ["data_source_connection_id"]
            isOneToOne: false
            referencedRelation: "data_source_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_feeds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_feeds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_feeds_source_form_id_fkey"
            columns: ["source_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_feeds_target_form_id_fkey"
            columns: ["target_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_connections: {
        Row: {
          connection_type: string
          created_at: string
          created_by: string
          db_connection_string: string | null
          db_query: string | null
          db_type: string | null
          description: string | null
          discovered_fields: Json | null
          file_sheet_name: string | null
          file_type: string | null
          file_url: string | null
          http_auth_config: Json | null
          http_auth_type: string | null
          http_headers: Json | null
          http_method: string | null
          http_response_path: string | null
          http_url: string | null
          id: string
          is_active: boolean | null
          last_field_discovery_at: string | null
          name: string
          organization_id: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          connection_type: string
          created_at?: string
          created_by: string
          db_connection_string?: string | null
          db_query?: string | null
          db_type?: string | null
          description?: string | null
          discovered_fields?: Json | null
          file_sheet_name?: string | null
          file_type?: string | null
          file_url?: string | null
          http_auth_config?: Json | null
          http_auth_type?: string | null
          http_headers?: Json | null
          http_method?: string | null
          http_response_path?: string | null
          http_url?: string | null
          id?: string
          is_active?: boolean | null
          last_field_discovery_at?: string | null
          name: string
          organization_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          connection_type?: string
          created_at?: string
          created_by?: string
          db_connection_string?: string | null
          db_query?: string | null
          db_type?: string | null
          description?: string | null
          discovered_fields?: Json | null
          file_sheet_name?: string | null
          file_type?: string | null
          file_url?: string | null
          http_auth_config?: Json | null
          http_auth_type?: string | null
          http_headers?: Json | null
          http_method?: string | null
          http_response_path?: string | null
          http_url?: string | null
          id?: string
          is_active?: boolean | null
          last_field_discovery_at?: string | null
          name?: string
          organization_id?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_source_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_source_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_history: {
        Row: {
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          form_id: string
          form_name: string
          generated_at: string
          generated_by: string
          generated_by_email: string | null
          id: string
          notes: string | null
          organization_id: string | null
          selected_fields: Json
          submission_count: number
          version: number
        }
        Insert: {
          document_type?: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          form_id: string
          form_name: string
          generated_at?: string
          generated_by: string
          generated_by_email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          selected_fields?: Json
          submission_count?: number
          version?: number
        }
        Update: {
          document_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          form_id?: string
          form_name?: string
          generated_at?: string
          generated_by?: string
          generated_by_email?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          selected_fields?: Json
          submission_count?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_history_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          content: string | null
          created_at: string
          error_message: string | null
          from_email: string
          id: string
          organization_id: string
          project_id: string | null
          sent_at: string | null
          smtp_config_id: string | null
          status: string
          subject: string
          template_id: string | null
          to_email: string
          trigger_context: Json | null
          triggered_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          error_message?: string | null
          from_email: string
          id?: string
          organization_id: string
          project_id?: string | null
          sent_at?: string | null
          smtp_config_id?: string | null
          status?: string
          subject: string
          template_id?: string | null
          to_email: string
          trigger_context?: Json | null
          triggered_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string
          id?: string
          organization_id?: string
          project_id?: string | null
          sent_at?: string | null
          smtp_config_id?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          to_email?: string
          trigger_context?: Json | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string
          custom_params: Json
          description: string | null
          html_content: string
          id: string
          is_active: boolean
          name: string
          project_id: string
          recipients: Json | null
          subject: string
          template_variables: Json
          text_content: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          custom_params?: Json
          description?: string | null
          html_content: string
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          recipients?: Json | null
          subject: string
          template_variables?: Json
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          custom_params?: Json
          description?: string | null
          html_content?: string
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          recipients?: Json | null
          subject?: string
          template_variables?: Json
          text_content?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      escalation_chains: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_chains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_chains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_events: {
        Row: {
          actions_taken: Json | null
          created_at: string | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          event_type: string
          id: string
          message: string | null
          notified_groups: string[] | null
          notified_users: string[] | null
          sla_instance_id: string
          triggered_by: string | null
        }
        Insert: {
          actions_taken?: Json | null
          created_at?: string | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          event_type: string
          id?: string
          message?: string | null
          notified_groups?: string[] | null
          notified_users?: string[] | null
          sla_instance_id: string
          triggered_by?: string | null
        }
        Update: {
          actions_taken?: Json | null
          created_at?: string | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          event_type?: string
          id?: string
          message?: string | null
          notified_groups?: string[] | null
          notified_users?: string[] | null
          sla_instance_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_events_sla_instance_id_fkey"
            columns: ["sla_instance_id"]
            isOneToOne: false
            referencedRelation: "sla_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_levels: {
        Row: {
          auto_reassign: boolean | null
          chain_id: string
          change_priority: boolean | null
          created_at: string | null
          custom_message: string | null
          escalate_to_group_id: string | null
          escalate_to_role: string | null
          escalate_to_user_id: string | null
          hours_after_breach: number
          id: string
          level: Database["public"]["Enums"]["escalation_level"]
          level_order: number
          new_priority: string | null
          send_email: boolean | null
          send_notification: boolean | null
          send_sms: boolean | null
        }
        Insert: {
          auto_reassign?: boolean | null
          chain_id: string
          change_priority?: boolean | null
          created_at?: string | null
          custom_message?: string | null
          escalate_to_group_id?: string | null
          escalate_to_role?: string | null
          escalate_to_user_id?: string | null
          hours_after_breach?: number
          id?: string
          level: Database["public"]["Enums"]["escalation_level"]
          level_order?: number
          new_priority?: string | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_sms?: boolean | null
        }
        Update: {
          auto_reassign?: boolean | null
          chain_id?: string
          change_priority?: boolean | null
          created_at?: string | null
          custom_message?: string | null
          escalate_to_group_id?: string | null
          escalate_to_role?: string | null
          escalate_to_user_id?: string | null
          hours_after_breach?: number
          id?: string
          level?: Database["public"]["Enums"]["escalation_level"]
          level_order?: number
          new_priority?: string | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_sms?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_levels_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "escalation_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_levels_escalate_to_group_id_fkey"
            columns: ["escalate_to_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          audit_id: string | null
          collection_date: string | null
          control_id: string | null
          created_at: string
          description: string | null
          evidence_type: string
          expiry_date: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_url: string | null
          finding_id: string | null
          id: string
          mime_type: string | null
          name: string
          organization_id: string | null
          policy_id: string | null
          project_id: string
          status: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          audit_id?: string | null
          collection_date?: string | null
          control_id?: string | null
          created_at?: string
          description?: string | null
          evidence_type?: string
          expiry_date?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          finding_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          organization_id?: string | null
          policy_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          audit_id?: string | null
          collection_date?: string | null
          control_id?: string | null
          created_at?: string
          description?: string | null
          evidence_type?: string
          expiry_date?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          finding_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string | null
          policy_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audit_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      form_access_requests: {
        Row: {
          created_at: string
          form_id: string
          id: string
          message: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          message?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          message?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_access_requests_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_by_user_id: string | null
          assigned_to_email: string | null
          assigned_to_user_id: string | null
          assignment_type: string
          created_at: string | null
          due_date: string | null
          form_id: string
          id: string
          notes: string | null
          project_id: string | null
          status: string
          updated_at: string | null
          workflow_execution_id: string | null
        }
        Insert: {
          assigned_by_user_id?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          assignment_type?: string
          created_at?: string | null
          due_date?: string | null
          form_id: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string | null
          workflow_execution_id?: string | null
        }
        Update: {
          assigned_by_user_id?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          assignment_type?: string
          created_at?: string | null
          due_date?: string | null
          form_id?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string | null
          workflow_execution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_audit_logs: {
        Row: {
          changes: Json | null
          created_at: string
          description: string | null
          event_type: string
          field_id: string | null
          field_label: string | null
          form_id: string | null
          form_name: string | null
          id: string
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          changes?: Json | null
          created_at?: string
          description?: string | null
          event_type: string
          field_id?: string | null
          field_label?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          changes?: Json | null
          created_at?: string
          description?: string | null
          event_type?: string
          field_id?: string | null
          field_label?: string | null
          form_id?: string | null
          form_name?: string | null
          id?: string
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_audit_logs_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_sla_config: {
        Row: {
          chain_id: string | null
          created_at: string | null
          field_id: string
          form_id: string
          id: string
          is_active: boolean | null
          stage_overrides: Json | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          chain_id?: string | null
          created_at?: string | null
          field_id: string
          form_id: string
          id?: string
          is_active?: boolean | null
          stage_overrides?: Json | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          chain_id?: string | null
          created_at?: string | null
          field_id?: string
          form_id?: string
          id?: string
          is_active?: boolean | null
          stage_overrides?: Json | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_field_sla_config_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "escalation_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_field_sla_config_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_field_sla_config_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sla_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          current_value: string | null
          custom_config: Json | null
          default_value: string | null
          error_message: string | null
          field_order: number | null
          field_type: string
          form_id: string | null
          id: string
          is_enabled: boolean | null
          is_visible: boolean | null
          label: string
          options: Json | null
          permissions: Json | null
          placeholder: string | null
          required: boolean | null
          tooltip: string | null
          triggers: Json | null
          updated_at: string
          validation: Json | null
        }
        Insert: {
          created_at?: string
          current_value?: string | null
          custom_config?: Json | null
          default_value?: string | null
          error_message?: string | null
          field_order?: number | null
          field_type: string
          form_id?: string | null
          id?: string
          is_enabled?: boolean | null
          is_visible?: boolean | null
          label: string
          options?: Json | null
          permissions?: Json | null
          placeholder?: string | null
          required?: boolean | null
          tooltip?: string | null
          triggers?: Json | null
          updated_at?: string
          validation?: Json | null
        }
        Update: {
          created_at?: string
          current_value?: string | null
          custom_config?: Json | null
          default_value?: string | null
          error_message?: string | null
          field_order?: number | null
          field_type?: string
          form_id?: string | null
          id?: string
          is_enabled?: boolean | null
          is_visible?: boolean | null
          label?: string
          options?: Json | null
          permissions?: Json | null
          placeholder?: string | null
          required?: boolean | null
          tooltip?: string | null
          triggers?: Json | null
          updated_at?: string
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approval_timestamp: string | null
          approved_by: string | null
          form_id: string | null
          id: string
          ip_address: unknown
          submission_data: Json
          submission_ref_id: string | null
          submitted_at: string
          submitted_by: string | null
          user_agent: string | null
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string | null
          approval_timestamp?: string | null
          approved_by?: string | null
          form_id?: string | null
          id?: string
          ip_address?: unknown
          submission_data: Json
          submission_ref_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          user_agent?: string | null
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string | null
          approval_timestamp?: string | null
          approved_by?: string | null
          form_id?: string | null
          id?: string
          ip_address?: unknown
          submission_data?: Json
          submission_ref_id?: string | null
          submitted_at?: string
          submitted_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_user_access: {
        Row: {
          created_at: string
          form_id: string
          granted_at: string | null
          granted_by: string | null
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_user_access_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          field_rules: Json | null
          form_rules: Json | null
          id: string
          is_public: boolean | null
          layout: Json | null
          name: string
          organization_id: string | null
          pages: Json | null
          permissions: Json | null
          project_id: string
          reference_id: string | null
          share_settings: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          field_rules?: Json | null
          form_rules?: Json | null
          id?: string
          is_public?: boolean | null
          layout?: Json | null
          name: string
          organization_id?: string | null
          pages?: Json | null
          permissions?: Json | null
          project_id: string
          reference_id?: string | null
          share_settings?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          field_rules?: Json | null
          form_rules?: Json | null
          id?: string
          is_public?: boolean | null
          layout?: Json | null
          name?: string
          organization_id?: string | null
          pages?: Json | null
          permissions?: Json | null
          project_id?: string
          reference_id?: string | null
          share_settings?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          added_at: string
          added_by: string
          group_id: string
          id: string
          member_id: string
          member_type: string
        }
        Insert: {
          added_at?: string
          added_by: string
          group_id: string
          id?: string
          member_id: string
          member_type: string
        }
        Update: {
          added_at?: string
          added_by?: string
          group_id?: string
          id?: string
          member_id?: string
          member_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_roles: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          role_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_folder_access: {
        Row: {
          access_type: string
          created_at: string
          folder_id: string
          granted_by: string | null
          grantee_id: string
          id: string
          permission: string
        }
        Insert: {
          access_type?: string
          created_at?: string
          folder_id: string
          granted_by?: string | null
          grantee_id: string
          id?: string
          permission?: string
        }
        Update: {
          access_type?: string
          created_at?: string
          folder_id?: string
          granted_by?: string | null
          grantee_id?: string
          id?: string
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_folder_access_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_folders: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_configurations: {
        Row: {
          allow_self_signed_certs: boolean | null
          auto_provision_users: boolean | null
          base_dn: string
          bind_dn: string | null
          bind_password_encrypted: string | null
          connection_timeout_seconds: number | null
          created_at: string
          created_by: string
          display_name_attribute: string | null
          email_attribute: string | null
          fallback_to_local_auth: boolean | null
          first_name_attribute: string | null
          group_search_base: string | null
          group_search_filter: string | null
          id: string
          is_enabled: boolean
          last_name_attribute: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          member_of_attribute: string | null
          name: string
          organization_id: string
          server_url: string
          sync_enabled: boolean | null
          sync_interval_minutes: number | null
          sync_user_status: boolean | null
          updated_at: string
          use_ssl: boolean | null
          use_starttls: boolean | null
          user_search_base: string | null
          user_search_filter: string | null
          username_attribute: string | null
        }
        Insert: {
          allow_self_signed_certs?: boolean | null
          auto_provision_users?: boolean | null
          base_dn: string
          bind_dn?: string | null
          bind_password_encrypted?: string | null
          connection_timeout_seconds?: number | null
          created_at?: string
          created_by: string
          display_name_attribute?: string | null
          email_attribute?: string | null
          fallback_to_local_auth?: boolean | null
          first_name_attribute?: string | null
          group_search_base?: string | null
          group_search_filter?: string | null
          id?: string
          is_enabled?: boolean
          last_name_attribute?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          member_of_attribute?: string | null
          name?: string
          organization_id: string
          server_url: string
          sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          sync_user_status?: boolean | null
          updated_at?: string
          use_ssl?: boolean | null
          use_starttls?: boolean | null
          user_search_base?: string | null
          user_search_filter?: string | null
          username_attribute?: string | null
        }
        Update: {
          allow_self_signed_certs?: boolean | null
          auto_provision_users?: boolean | null
          base_dn?: string
          bind_dn?: string | null
          bind_password_encrypted?: string | null
          connection_timeout_seconds?: number | null
          created_at?: string
          created_by?: string
          display_name_attribute?: string | null
          email_attribute?: string | null
          fallback_to_local_auth?: boolean | null
          first_name_attribute?: string | null
          group_search_base?: string | null
          group_search_filter?: string | null
          id?: string
          is_enabled?: boolean
          last_name_attribute?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          member_of_attribute?: string | null
          name?: string
          organization_id?: string
          server_url?: string
          sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          sync_user_status?: boolean | null
          updated_at?: string
          use_ssl?: boolean | null
          use_starttls?: boolean | null
          user_search_base?: string | null
          user_search_filter?: string | null
          username_attribute?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ldap_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_group_mappings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          ldap_config_id: string
          ldap_group_dn: string
          ldap_group_name: string
          mapped_group_id: string | null
          mapped_role: string | null
          mapped_security_template_id: string | null
          organization_id: string
          priority: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          ldap_config_id: string
          ldap_group_dn: string
          ldap_group_name: string
          mapped_group_id?: string | null
          mapped_role?: string | null
          mapped_security_template_id?: string | null
          organization_id: string
          priority?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          ldap_config_id?: string
          ldap_group_dn?: string
          ldap_group_name?: string
          mapped_group_id?: string | null
          mapped_role?: string | null
          mapped_security_template_id?: string | null
          organization_id?: string
          priority?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ldap_group_mappings_ldap_config_id_fkey"
            columns: ["ldap_config_id"]
            isOneToOne: false
            referencedRelation: "ldap_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ldap_group_mappings_mapped_group_id_fkey"
            columns: ["mapped_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ldap_group_mappings_mapped_security_template_id_fkey"
            columns: ["mapped_security_template_id"]
            isOneToOne: false
            referencedRelation: "security_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ldap_group_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_sync_logs: {
        Row: {
          completed_at: string | null
          error_details: Json | null
          errors_count: number | null
          groups_synced: number | null
          id: string
          ldap_config_id: string
          organization_id: string
          started_at: string
          status: string
          sync_log: Json | null
          triggered_by: string | null
          users_created: number | null
          users_disabled: number | null
          users_found: number | null
          users_updated: number | null
        }
        Insert: {
          completed_at?: string | null
          error_details?: Json | null
          errors_count?: number | null
          groups_synced?: number | null
          id?: string
          ldap_config_id: string
          organization_id: string
          started_at?: string
          status?: string
          sync_log?: Json | null
          triggered_by?: string | null
          users_created?: number | null
          users_disabled?: number | null
          users_found?: number | null
          users_updated?: number | null
        }
        Update: {
          completed_at?: string | null
          error_details?: Json | null
          errors_count?: number | null
          groups_synced?: number | null
          id?: string
          ldap_config_id?: string
          organization_id?: string
          started_at?: string
          status?: string
          sync_log?: Json | null
          triggered_by?: string | null
          users_created?: number | null
          users_disabled?: number | null
          users_found?: number | null
          users_updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ldap_sync_logs_ldap_config_id_fkey"
            columns: ["ldap_config_id"]
            isOneToOne: false
            referencedRelation: "ldap_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ldap_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_user_links: {
        Row: {
          created_at: string
          id: string
          last_ldap_login_at: string | null
          last_synced_at: string | null
          ldap_config_id: string
          ldap_dn: string
          ldap_groups: Json | null
          ldap_uid: string | null
          ldap_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_ldap_login_at?: string | null
          last_synced_at?: string | null
          ldap_config_id: string
          ldap_dn: string
          ldap_groups?: Json | null
          ldap_uid?: string | null
          ldap_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_ldap_login_at?: string | null
          last_synced_at?: string | null
          ldap_config_id?: string
          ldap_dn?: string
          ldap_groups?: Json | null
          ldap_uid?: string | null
          ldap_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ldap_user_links_ldap_config_id_fkey"
            columns: ["ldap_config_id"]
            isOneToOne: false
            referencedRelation: "ldap_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ldap_user_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          comment: string | null
          duration_in_previous_stage: string | null
          field_id: string
          from_stage: string | null
          id: string
          submission_id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          duration_in_previous_stage?: string | null
          field_id: string
          from_stage?: string | null
          id?: string
          submission_id: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          duration_in_previous_stage?: string | null
          field_id?: string
          from_stage?: string | null
          id?: string
          submission_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_stage_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          method: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          method?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          method?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      organization_requests: {
        Row: {
          email: string
          expires_at: string | null
          first_name: string
          gender: string | null
          id: string
          invitation_token: string | null
          invitation_type: string | null
          last_name: string
          message: string | null
          mobile: string | null
          nationality: string | null
          organization_id: string | null
          password_hash: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string | null
          security_template_id: string | null
          status: string
          timezone: string | null
        }
        Insert: {
          email: string
          expires_at?: string | null
          first_name: string
          gender?: string | null
          id?: string
          invitation_token?: string | null
          invitation_type?: string | null
          last_name: string
          message?: string | null
          mobile?: string | null
          nationality?: string | null
          organization_id?: string | null
          password_hash?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          security_template_id?: string | null
          status?: string
          timezone?: string | null
        }
        Update: {
          email?: string
          expires_at?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          invitation_token?: string | null
          invitation_type?: string | null
          last_name?: string
          message?: string | null
          mobile?: string | null
          nationality?: string | null
          organization_id?: string | null
          password_hash?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          security_template_id?: string | null
          status?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_requests_security_template_id_fkey"
            columns: ["security_template_id"]
            isOneToOne: false
            referencedRelation: "security_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_security_defaults: {
        Row: {
          access_end_time: string | null
          access_start_time: string | null
          allowed_days: string[] | null
          created_at: string
          created_by: string | null
          id: string
          lockout_duration_minutes: number | null
          max_concurrent_sessions: number | null
          max_failed_login_attempts: number | null
          mfa_max_attempts: number | null
          mfa_method: string | null
          mfa_pin_expiry_minutes: number | null
          mfa_required: boolean | null
          organization_id: string
          password_change_min_hours: number | null
          password_expiry_days: number | null
          password_expiry_warning_days: number | null
          password_history_count: number | null
          password_min_length: number | null
          password_require_lowercase: boolean | null
          password_require_numbers: boolean | null
          password_require_special: boolean | null
          password_require_uppercase: boolean | null
          session_timeout_minutes: number | null
          session_timeout_warning_seconds: number | null
          static_session_timeout: boolean | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_end_time?: string | null
          access_start_time?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          organization_id: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_end_time?: string | null
          access_start_time?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          organization_id?: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          admin_email: string
          created_at: string
          description: string | null
          domain: string
          id: string
          logo_url: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_email: string
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          logo_url?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_email?: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          logo_url?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          id: string
          permission_details: Json
          permission_type: string
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          id?: string
          permission_details?: Json
          permission_type: string
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          id?: string
          permission_details?: Json
          permission_type?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          permissions: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          permissions?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          acknowledgment_required: boolean | null
          attachments: Json | null
          category: string
          compliance_reference: string | null
          compliance_standard: string | null
          content: Json
          created_at: string
          created_by: string
          current_version: number
          department: string | null
          description: string | null
          effective_date: string | null
          exception_allowed: boolean | null
          expiry_date: string | null
          folder_id: string | null
          form_id: string | null
          id: string
          item_type: string
          name: string
          next_review_date: string | null
          organization_id: string | null
          owner_id: string
          owner_type: string
          policy_number: string | null
          priority: string | null
          project_id: string
          published_at: string | null
          reference_id: string | null
          retired_at: string | null
          review_cycle_days: number | null
          status: string
          tags: string[] | null
          template_id: string | null
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          acknowledgment_required?: boolean | null
          attachments?: Json | null
          category?: string
          compliance_reference?: string | null
          compliance_standard?: string | null
          content?: Json
          created_at?: string
          created_by: string
          current_version?: number
          department?: string | null
          description?: string | null
          effective_date?: string | null
          exception_allowed?: boolean | null
          expiry_date?: string | null
          folder_id?: string | null
          form_id?: string | null
          id?: string
          item_type?: string
          name: string
          next_review_date?: string | null
          organization_id?: string | null
          owner_id: string
          owner_type?: string
          policy_number?: string | null
          priority?: string | null
          project_id: string
          published_at?: string | null
          reference_id?: string | null
          retired_at?: string | null
          review_cycle_days?: number | null
          status?: string
          tags?: string[] | null
          template_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          acknowledgment_required?: boolean | null
          attachments?: Json | null
          category?: string
          compliance_reference?: string | null
          compliance_standard?: string | null
          content?: Json
          created_at?: string
          created_by?: string
          current_version?: number
          department?: string | null
          description?: string | null
          effective_date?: string | null
          exception_allowed?: boolean | null
          expiry_date?: string | null
          folder_id?: string | null
          form_id?: string | null
          id?: string
          item_type?: string
          name?: string
          next_review_date?: string | null
          organization_id?: string | null
          owner_id?: string
          owner_type?: string
          policy_number?: string | null
          priority?: string | null
          project_id?: string
          published_at?: string | null
          reference_id?: string | null
          retired_at?: string | null
          review_cycle_days?: number | null
          status?: string
          tags?: string[] | null
          template_id?: string | null
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "policy_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgments: {
        Row: {
          acknowledged_at: string
          comments: string | null
          id: string
          ip_address: string | null
          policy_id: string
          user_id: string
          version_acknowledged: number
        }
        Insert: {
          acknowledged_at?: string
          comments?: string | null
          id?: string
          ip_address?: string | null
          policy_id: string
          user_id: string
          version_acknowledged?: number
        }
        Update: {
          acknowledged_at?: string
          comments?: string | null
          id?: string
          ip_address?: string | null
          policy_id?: string
          user_id?: string
          version_acknowledged?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_approvals: {
        Row: {
          approved_at: string | null
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          policy_id: string
          status: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          policy_id: string
          status?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          policy_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_approvals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_control_mappings: {
        Row: {
          control_id: string
          coverage_status: string | null
          created_at: string
          created_by: string
          id: string
          mapping_notes: string | null
          policy_id: string
        }
        Insert: {
          control_id: string
          coverage_status?: string | null
          created_at?: string
          created_by: string
          id?: string
          mapping_notes?: string | null
          policy_id: string
        }
        Update: {
          control_id?: string
          coverage_status?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mapping_notes?: string | null
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_control_mappings_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "compliance_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_control_mappings_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_exceptions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          compensating_controls: string | null
          created_at: string
          end_date: string
          id: string
          justification: string | null
          policy_id: string
          reason: string
          requested_by: string
          risk_assessment: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          compensating_controls?: string | null
          created_at?: string
          end_date: string
          id?: string
          justification?: string | null
          policy_id: string
          reason: string
          requested_by: string
          risk_assessment?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          compensating_controls?: string | null
          created_at?: string
          end_date?: string
          id?: string
          justification?: string | null
          policy_id?: string
          reason?: string
          requested_by?: string
          risk_assessment?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_exceptions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_linkages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          link_description: string | null
          linked_entity_id: string
          linked_entity_type: string
          policy_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          link_description?: string | null
          linked_entity_id: string
          linked_entity_type: string
          policy_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          link_description?: string | null
          linked_entity_id?: string
          linked_entity_type?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_linkages_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_ratings: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          policy_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          policy_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          policy_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_ratings_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_review_cycles: {
        Row: {
          completed_at: string | null
          created_at: string
          findings: string | null
          id: string
          outcome: string | null
          policy_id: string
          review_date: string
          reviewer_id: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          outcome?: string | null
          policy_id: string
          review_date: string
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          findings?: string | null
          id?: string
          outcome?: string | null
          policy_id?: string
          review_date?: string
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_review_cycles_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_templates: {
        Row: {
          category: string
          content_structure: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_system_template: boolean
          name: string
          organization_id: string | null
          project_id: string | null
          template_file_path: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          content_structure?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_system_template?: boolean
          name: string
          organization_id?: string | null
          project_id?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          content_structure?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_system_template?: boolean
          name?: string
          organization_id?: string | null
          project_id?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          attachments: Json | null
          category: string | null
          change_summary: string | null
          changed_at: string
          changed_by: string
          content: Json
          department: string | null
          description: string | null
          id: string
          name: string
          policy_id: string
          version_number: number
        }
        Insert: {
          attachments?: Json | null
          category?: string | null
          change_summary?: string | null
          changed_at?: string
          changed_by: string
          content?: Json
          department?: string | null
          description?: string | null
          id?: string
          name: string
          policy_id: string
          version_number: number
        }
        Update: {
          attachments?: Json | null
          category?: string | null
          change_summary?: string | null
          changed_at?: string
          changed_by?: string
          content?: Json
          department?: string | null
          description?: string | null
          id?: string
          name?: string
          policy_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string
          message: string | null
          project_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          message?: string | null
          project_id: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          message?: string | null
          project_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission_level: string
          project_id: string
          resource_type: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_level: string
          project_id: string
          resource_type: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission_level?: string
          project_id?: string
          resource_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_top_level_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          created_at: string
          created_by: string
          entity_type: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by: string
          entity_type: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          created_at?: string
          created_by?: string
          entity_type?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_top_level_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_users: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_field_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          field_id: string | null
          field_label: string
          id: string
          new_value: string | null
          old_value: string | null
          submission_id: string
        }
        Insert: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_id?: string | null
          field_label: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          submission_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_id?: string | null
          field_label?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_field_history_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_field_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          finding_id: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          finding_id: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          finding_id?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remediation_tasks_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      report_components: {
        Row: {
          config: Json
          created_at: string
          id: string
          layout: Json
          report_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          layout?: Json
          report_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          layout?: Json
          report_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_components_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_media: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          display_order: number | null
          file_path: string | null
          id: string
          layout: Json | null
          media_type: string
          metadata: Json | null
          report_id: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number | null
          file_path?: string | null
          id?: string
          layout?: Json | null
          media_type: string
          metadata?: Json | null
          report_id: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number | null
          file_path?: string | null
          id?: string
          layout?: Json | null
          media_type?: string
          metadata?: Json | null
          report_id?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_media_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by: string
          dashboard_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          organization_id: string | null
          project_id: string
          reference_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dashboard_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          organization_id?: string | null
          project_id: string
          reference_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dashboard_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          organization_id?: string | null
          project_id?: string
          reference_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_type: string
          resource_id: string | null
          resource_type: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_type: string
          resource_id?: string | null
          resource_type: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_type?: string
          resource_id?: string | null
          resource_type?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          top_level_access: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          top_level_access?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          top_level_access?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          filter_data: Json
          form_id: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_data?: Json
          form_id: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_data?: Json
          form_id?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_queries: {
        Row: {
          created_at: string | null
          id: string
          name: string
          query: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          query: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          query?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_templates: {
        Row: {
          access_end_time: string | null
          access_start_time: string | null
          allowed_days: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          lockout_duration_minutes: number | null
          max_concurrent_sessions: number | null
          max_failed_login_attempts: number | null
          mfa_max_attempts: number | null
          mfa_method: string | null
          mfa_pin_expiry_minutes: number | null
          mfa_required: boolean | null
          name: string
          organization_id: string
          password_change_min_hours: number | null
          password_expiry_days: number | null
          password_expiry_warning_days: number | null
          password_history_count: number | null
          password_min_length: number | null
          password_require_lowercase: boolean | null
          password_require_numbers: boolean | null
          password_require_special: boolean | null
          password_require_uppercase: boolean | null
          session_timeout_minutes: number | null
          session_timeout_warning_seconds: number | null
          static_session_timeout: boolean | null
          updated_at: string
        }
        Insert: {
          access_end_time?: string | null
          access_start_time?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          name: string
          organization_id: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
        }
        Update: {
          access_end_time?: string | null
          access_start_time?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          name?: string
          organization_id?: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      sla_instances: {
        Row: {
          assigned_to: string | null
          breach_at: string | null
          chain_id: string | null
          completed_at: string | null
          created_at: string | null
          current_escalation_level:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          current_stage: string
          escalation_count: number | null
          field_id: string
          form_id: string
          id: string
          last_escalation_at: string | null
          metadata: Json | null
          paused_at: string | null
          priority: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["sla_status"] | null
          submission_id: string
          template_id: string | null
          total_paused_minutes: number | null
          updated_at: string | null
          warning_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          breach_at?: string | null
          chain_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          current_stage: string
          escalation_count?: number | null
          field_id: string
          form_id: string
          id?: string
          last_escalation_at?: string | null
          metadata?: Json | null
          paused_at?: string | null
          priority?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sla_status"] | null
          submission_id: string
          template_id?: string | null
          total_paused_minutes?: number | null
          updated_at?: string | null
          warning_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          breach_at?: string | null
          chain_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_escalation_level?:
            | Database["public"]["Enums"]["escalation_level"]
            | null
          current_stage?: string
          escalation_count?: number | null
          field_id?: string
          form_id?: string
          id?: string
          last_escalation_at?: string | null
          metadata?: Json | null
          paused_at?: string | null
          priority?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sla_status"] | null
          submission_id?: string
          template_id?: string | null
          total_paused_minutes?: number | null
          updated_at?: string | null
          warning_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_instances_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "escalation_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_instances_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_instances_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sla_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_templates: {
        Row: {
          breach_hours: number
          business_days: string[] | null
          business_end_time: string | null
          business_start_time: string | null
          created_at: string | null
          created_by: string
          description: string | null
          exclude_holidays: boolean | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          priority_multipliers: Json | null
          project_id: string | null
          updated_at: string | null
          use_business_hours: boolean | null
          warning_hours: number
        }
        Insert: {
          breach_hours?: number
          business_days?: string[] | null
          business_end_time?: string | null
          business_start_time?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          exclude_holidays?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          priority_multipliers?: Json | null
          project_id?: string | null
          updated_at?: string | null
          use_business_hours?: boolean | null
          warning_hours?: number
        }
        Update: {
          breach_hours?: number
          business_days?: string[] | null
          business_end_time?: string | null
          business_start_time?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          exclude_holidays?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          priority_multipliers?: Json | null
          project_id?: string | null
          updated_at?: string | null
          use_business_hours?: boolean | null
          warning_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_configs: {
        Row: {
          created_at: string
          created_by: string
          from_email: string
          from_name: string | null
          host: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          password: string
          port: number
          updated_at: string
          use_tls: boolean
          username: string
        }
        Insert: {
          created_at?: string
          created_by: string
          from_email: string
          from_name?: string | null
          host: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          password: string
          port?: number
          updated_at?: string
          use_tls?: boolean
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string
          from_email?: string
          from_name?: string | null
          host?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          password?: string
          port?: number
          updated_at?: string
          use_tls?: boolean
          username?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          mobile: string | null
          nationality: string | null
          organization_id: string | null
          password: string | null
          role: string
          status: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          gender?: string | null
          id: string
          last_name?: string | null
          mobile?: string | null
          nationality?: string | null
          organization_id?: string | null
          password?: string | null
          role?: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          nationality?: string | null
          organization_id?: string | null
          password?: string | null
          role?: string
          status?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security_parameters: {
        Row: {
          access_end_time: string | null
          access_start_time: string | null
          account_locked_until: string | null
          allowed_days: string[] | null
          created_at: string
          created_by: string | null
          current_password_hash: string | null
          failed_login_count: number | null
          id: string
          ip_blacklist: string[] | null
          ip_whitelist: string[] | null
          last_failed_login: string | null
          last_login: string | null
          last_password_change: string | null
          lockout_duration_minutes: number | null
          max_concurrent_sessions: number | null
          max_failed_login_attempts: number | null
          mfa_max_attempts: number | null
          mfa_method: string | null
          mfa_pin_expiry_minutes: number | null
          mfa_required: boolean | null
          organization_id: string
          password_change_min_hours: number | null
          password_expiry_days: number | null
          password_expiry_warning_days: number | null
          password_history_count: number | null
          password_min_length: number | null
          password_require_lowercase: boolean | null
          password_require_numbers: boolean | null
          password_require_special: boolean | null
          password_require_uppercase: boolean | null
          security_template_id: string | null
          session_timeout_minutes: number | null
          session_timeout_warning_seconds: number | null
          static_session_timeout: boolean | null
          updated_at: string
          updated_by: string | null
          use_template_settings: boolean | null
          user_id: string
        }
        Insert: {
          access_end_time?: string | null
          access_start_time?: string | null
          account_locked_until?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          current_password_hash?: string | null
          failed_login_count?: number | null
          id?: string
          ip_blacklist?: string[] | null
          ip_whitelist?: string[] | null
          last_failed_login?: string | null
          last_login?: string | null
          last_password_change?: string | null
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          organization_id: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          security_template_id?: string | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
          updated_by?: string | null
          use_template_settings?: boolean | null
          user_id: string
        }
        Update: {
          access_end_time?: string | null
          access_start_time?: string | null
          account_locked_until?: string | null
          allowed_days?: string[] | null
          created_at?: string
          created_by?: string | null
          current_password_hash?: string | null
          failed_login_count?: number | null
          id?: string
          ip_blacklist?: string[] | null
          ip_whitelist?: string[] | null
          last_failed_login?: string | null
          last_login?: string | null
          last_password_change?: string | null
          lockout_duration_minutes?: number | null
          max_concurrent_sessions?: number | null
          max_failed_login_attempts?: number | null
          mfa_max_attempts?: number | null
          mfa_method?: string | null
          mfa_pin_expiry_minutes?: number | null
          mfa_required?: boolean | null
          organization_id?: string
          password_change_min_hours?: number | null
          password_expiry_days?: number | null
          password_expiry_warning_days?: number | null
          password_history_count?: number | null
          password_min_length?: number | null
          password_require_lowercase?: boolean | null
          password_require_numbers?: boolean | null
          password_require_special?: boolean | null
          password_require_uppercase?: boolean | null
          security_template_id?: string | null
          session_timeout_minutes?: number | null
          session_timeout_warning_seconds?: number | null
          static_session_timeout?: boolean | null
          updated_at?: string
          updated_by?: string | null
          use_template_settings?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_parameters_security_template_id_fkey"
            columns: ["security_template_id"]
            isOneToOne: false
            referencedRelation: "security_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_activity: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_activity?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workflow_connections: {
        Row: {
          condition_type: string | null
          created_at: string
          id: string
          source_handle: string | null
          source_node_id: string
          target_handle: string | null
          target_node_id: string
          workflow_id: string
        }
        Insert: {
          condition_type?: string | null
          created_at?: string
          id?: string
          source_handle?: string | null
          source_node_id: string
          target_handle?: string | null
          target_node_id: string
          workflow_id: string
        }
        Update: {
          condition_type?: string | null
          created_at?: string
          id?: string
          source_handle?: string | null
          source_node_id?: string
          target_handle?: string | null
          target_node_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_connections_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          current_node_id: string | null
          error_message: string | null
          execution_data: Json | null
          form_owner_id: string | null
          form_submission_id: string | null
          id: string
          scheduled_resume_at: string | null
          started_at: string
          status: string
          submitter_id: string | null
          trigger_data: Json | null
          trigger_form_id: string | null
          trigger_submission_id: string | null
          wait_config: Json | null
          wait_node_id: string | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          current_node_id?: string | null
          error_message?: string | null
          execution_data?: Json | null
          form_owner_id?: string | null
          form_submission_id?: string | null
          id?: string
          scheduled_resume_at?: string | null
          started_at?: string
          status?: string
          submitter_id?: string | null
          trigger_data?: Json | null
          trigger_form_id?: string | null
          trigger_submission_id?: string | null
          wait_config?: Json | null
          wait_node_id?: string | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          current_node_id?: string | null
          error_message?: string | null
          execution_data?: Json | null
          form_owner_id?: string | null
          form_submission_id?: string | null
          id?: string
          scheduled_resume_at?: string | null
          started_at?: string
          status?: string
          submitter_id?: string | null
          trigger_data?: Json | null
          trigger_form_id?: string | null
          trigger_submission_id?: string | null
          wait_config?: Json | null
          wait_node_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workflow_executions_form_submission"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_trigger_form_id_fkey"
            columns: ["trigger_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_trigger_submission_id_fkey"
            columns: ["trigger_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_wait_node_id_fkey"
            columns: ["wait_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_logs: {
        Row: {
          action_details: Json | null
          action_result: Json | null
          action_type: string | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_id: string
          execution_order: number | null
          id: string
          input_data: Json | null
          node_id: string
          node_label: string | null
          node_type: string
          output_data: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_details?: Json | null
          action_result?: Json | null
          action_type?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_id: string
          execution_order?: number | null
          id?: string
          input_data?: Json | null
          node_id: string
          node_label?: string | null
          node_type: string
          output_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_details?: Json | null
          action_result?: Json | null
          action_type?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string
          execution_order?: number | null
          id?: string
          input_data?: Json | null
          node_id?: string
          node_label?: string | null
          node_type?: string
          output_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_node_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_id: string
          execution_order: number | null
          id: string
          node_id: string
          output_data: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id: string
          execution_order?: number | null
          id?: string
          node_id: string
          output_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string
          execution_order?: number | null
          id?: string
          node_id?: string
          output_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_node_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_node_executions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_nodes: {
        Row: {
          config: Json
          created_at: string
          id: string
          label: string
          node_type: string
          position_x: number
          position_y: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          label: string
          node_type: string
          position_x?: number
          position_y?: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          label?: string
          node_type?: string
          position_x?: number
          position_y?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_nodes_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          execution_id: string | null
          id: string
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          organization_id: string | null
          priority: number
          project_id: string | null
          retry_count: number
          started_at: string | null
          status: string
          submission_id: string | null
          trigger_data: Json
          trigger_ref: string | null
          trigger_source: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          execution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          organization_id?: string | null
          priority?: number
          project_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          submission_id?: string | null
          trigger_data?: Json
          trigger_ref?: string | null
          trigger_source?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          execution_id?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          organization_id?: string | null
          priority?: number
          project_id?: string | null
          retry_count?: number
          started_at?: string | null
          status?: string
          submission_id?: string | null
          trigger_data?: Json
          trigger_ref?: string | null
          trigger_source?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_queue_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_queue_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_queue_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_triggers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          organization_id: string
          permissions: Json | null
          source_form_id: string | null
          target_workflow_id: string
          trigger_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id: string
          permissions?: Json | null
          source_form_id?: string | null
          target_workflow_id: string
          trigger_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          organization_id?: string
          permissions?: Json | null
          source_form_id?: string | null
          target_workflow_id?: string
          trigger_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_triggers_source_form_id_fkey"
            columns: ["source_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_triggers_target_workflow_id_fkey"
            columns: ["target_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          enrollment_cooldown_hours: number | null
          enrollment_mode: string
          id: string
          name: string
          organization_id: string | null
          project_id: string
          reference_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          enrollment_cooldown_hours?: number | null
          enrollment_mode?: string
          id?: string
          name: string
          organization_id?: string | null
          project_id: string
          reference_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          enrollment_cooldown_hours?: number | null
          enrollment_mode?: string
          id?: string
          name?: string
          organization_id?: string | null
          project_id?: string
          reference_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { invitation_token_param: string }
        Returns: Json
      }
      accept_project_invitation: {
        Args: { invitation_id_param: string }
        Returns: Json
      }
      bulk_update_submission_field: {
        Args: { _field_id: string; _form_id: string; _new_value: Json }
        Returns: number
      }
      calculate_business_hours: {
        Args: {
          business_days?: string[]
          business_end?: string
          business_start?: string
          end_time: string
          org_id?: string
          start_time: string
        }
        Returns: number
      }
      can_access_compliance_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_form: {
        Args: { _form_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_forms_row: {
        Args: {
          _created_by: string
          _is_public: boolean
          _org_id: string
          _project_id: string
          _user_id: string
        }
        Returns: boolean
      }
      can_create_asset_in_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_modify_form: {
        Args: { _form_id: string; _user_id: string }
        Returns: boolean
      }
      can_modify_forms_row: {
        Args: { _created_by: string; _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_update_form_submission_via_workflow: {
        Args: { _form_id: string; _user_id: string }
        Returns: boolean
      }
      can_user_create_project: { Args: { org_id: string }; Returns: boolean }
      can_view_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_organization_invitation: {
        Args: { invitation_id_param: string }
        Returns: Json
      }
      create_default_security_templates: {
        Args: { creator_id: string; org_id: string }
        Returns: undefined
      }
      generate_reference_id: {
        Args: { name_text: string; table_name: string }
        Returns: string
      }
      generate_submission_ref_id: {
        Args: { form_ref_id: string }
        Returns: string
      }
      get_chart_data: {
        Args: {
          p_aggregation?: string
          p_dimensions?: string[]
          p_drilldown_path?: string[]
          p_drilldown_values?: string[]
          p_filters?: Json
          p_form_id: string
          p_group_by_field?: string
          p_metric_aggregations?: Json
          p_metrics?: string[]
        }
        Returns: {
          additional_data: Json
          name: string
          value: number
        }[]
      }
      get_current_user_org_id: { Args: never; Returns: string }
      get_current_user_organization_id: { Args: never; Returns: string }
      get_group_members: {
        Args: { _group_id: string }
        Returns: {
          member_email: string
          member_id: string
          member_name: string
          member_type: string
        }[]
      }
      get_next_execution_order: { Args: { exec_id: string }; Returns: number }
      get_org_ldap_config: {
        Args: { org_id: string }
        Returns: {
          allow_self_signed_certs: boolean | null
          auto_provision_users: boolean | null
          base_dn: string
          bind_dn: string | null
          bind_password_encrypted: string | null
          connection_timeout_seconds: number | null
          created_at: string
          created_by: string
          display_name_attribute: string | null
          email_attribute: string | null
          fallback_to_local_auth: boolean | null
          first_name_attribute: string | null
          group_search_base: string | null
          group_search_filter: string | null
          id: string
          is_enabled: boolean
          last_name_attribute: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          member_of_attribute: string | null
          name: string
          organization_id: string
          server_url: string
          sync_enabled: boolean | null
          sync_interval_minutes: number | null
          sync_user_status: boolean | null
          updated_at: string
          use_ssl: boolean | null
          use_starttls: boolean | null
          user_search_base: string | null
          user_search_filter: string | null
          username_attribute: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ldap_configurations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_organization_users: {
        Args: { org_id: string }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
          role: string
        }[]
      }
      get_project_users_form_permissions: {
        Args: { _form_id: string; _project_id: string }
        Returns: {
          email: string
          first_name: string
          has_explicit_permissions: boolean
          last_name: string
          permissions: Json
          project_role: string
          user_id: string
        }[]
      }
      get_project_users_with_permissions: {
        Args: { project_id_param: string }
        Returns: {
          asset_permissions: Json
          assigned_at: string
          assigned_by: string
          effective_permissions: Json
          email: string
          first_name: string
          last_activity: string
          last_name: string
          project_permissions: Json
          role: string
          user_id: string
        }[]
      }
      get_user_effective_permissions: {
        Args: {
          _resource_id?: string
          _resource_type: string
          _user_id: string
        }
        Returns: {
          permission_type: string
        }[]
      }
      get_user_effective_security_params: {
        Args: { target_user_id: string }
        Returns: Json
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      get_user_form_permissions: {
        Args: { _form_id: string; _project_id: string; _user_id: string }
        Returns: {
          granted_explicitly: boolean
          permission_type: string
        }[]
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_project_invitations: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          invited_at: string
          invited_by: string
          inviter_name: string
          message: string
          project_id: string
          project_name: string
          role: string
          status: string
        }[]
      }
      has_asset_permission: {
        Args: {
          _asset_id: string
          _asset_type: string
          _permission_type: string
          _project_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_effective_permission: {
        Args: {
          _entity_type: string
          _permission_type: string
          _project_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_project_permission: {
        Args: {
          _project_id: string
          _required_level: string
          _resource_type: string
          _user_id: string
        }
        Returns: boolean
      }
      initialize_default_top_level_permissions: {
        Args: { _created_by: string; _project_id: string; _user_id: string }
        Returns: undefined
      }
      invite_user_to_project: {
        Args: {
          email_param: string
          message_param?: string
          project_id_param: string
          role_param: string
        }
        Returns: string
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_admin_of_org: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_form_public: { Args: { _form_id: string }; Returns: boolean }
      is_ldap_user: { Args: { target_user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      log_api_request: {
        Args: {
          p_api_key_id: string
          p_endpoint: string
          p_error_message?: string
          p_ip_address: string
          p_method: string
          p_organization_id: string
          p_request_body: Json
          p_response_status: number
          p_response_time_ms: number
          p_user_agent: string
        }
        Returns: string
      }
      reject_project_invitation: {
        Args: { invitation_id_param: string }
        Returns: Json
      }
      user_has_role_permission: {
        Args: {
          _permission_type: string
          _resource_id?: string
          _resource_type: string
          _user_id: string
        }
        Returns: boolean
      }
      validate_api_key: {
        Args: { key_hash_param: string }
        Returns: {
          allowed_ips: string[]
          api_key_id: string
          organization_id: string
          permissions: Json
          project_id: string
          rate_limit: number
        }[]
      }
    }
    Enums: {
      escalation_level: "L1" | "L2" | "L3" | "L4"
      sla_status: "on_track" | "warning" | "breached" | "completed" | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      escalation_level: ["L1", "L2", "L3", "L4"],
      sla_status: ["on_track", "warning", "breached", "completed", "paused"],
    },
  },
} as const
