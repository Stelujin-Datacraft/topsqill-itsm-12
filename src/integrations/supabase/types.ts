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
          first_name: string
          id: string
          last_name: string
          message: string | null
          organization_id: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          email: string
          first_name: string
          id?: string
          last_name: string
          message?: string | null
          organization_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          message?: string | null
          organization_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      reports: {
        Row: {
          created_at: string
          created_by: string
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
          started_at: string
          status: string
          submitter_id: string | null
          trigger_data: Json | null
          trigger_form_id: string | null
          trigger_submission_id: string | null
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
          started_at?: string
          status?: string
          submitter_id?: string | null
          trigger_data?: Json | null
          trigger_form_id?: string | null
          trigger_submission_id?: string | null
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
          started_at?: string
          status?: string
          submitter_id?: string | null
          trigger_data?: Json | null
          trigger_form_id?: string | null
          trigger_submission_id?: string | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_project_invitation: {
        Args: { invitation_id_param: string }
        Returns: Json
      }
      can_create_asset_in_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_user_create_project: { Args: { org_id: string }; Returns: boolean }
      can_view_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      generate_reference_id: {
        Args: { name_text: string; table_name: string }
        Returns: string
      }
      generate_submission_ref_id: {
        Args: { form_ref_id: string }
        Returns: string
      }
      get_chart_data:
        | {
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
        | {
            Args: {
              p_aggregation?: string
              p_dimensions?: string[]
              p_drilldown_path?: string[]
              p_drilldown_values?: string[]
              p_filters?: Json
              p_form_id: string
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
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
