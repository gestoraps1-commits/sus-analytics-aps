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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_users: {
        Row: {
          acesso: boolean
          auth_user_id: string
          cns: string | null
          cpf: string | null
          created_at: string
          email: string
          health_unit_id: string | null
          id: string
          is_master_admin: boolean
          job_function_id: string | null
          municipality_id: string | null
          nome_completo: string
          precisa_trocar_senha: boolean
          profile_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          acesso?: boolean
          auth_user_id: string
          cns?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          health_unit_id?: string | null
          id?: string
          is_master_admin?: boolean
          job_function_id?: string | null
          municipality_id?: string | null
          nome_completo: string
          precisa_trocar_senha?: boolean
          profile_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          acesso?: boolean
          auth_user_id?: string
          cns?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          health_unit_id?: string | null
          id?: string
          is_master_admin?: boolean
          job_function_id?: string | null
          municipality_id?: string | null
          nome_completo?: string
          precisa_trocar_senha?: boolean
          profile_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_health_unit_id_fkey"
            columns: ["health_unit_id"]
            isOneToOne: false
            referencedRelation: "health_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_logs: {
        Row: {
          action: string
          app_user_id: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string
        }
        Insert: {
          action: string
          app_user_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          app_user_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_logs_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_entries: {
        Row: {
          catalog_id: string
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_key: string
          id: string
          label: string
          metadata: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          catalog_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_key: string
          id?: string
          label: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_key?: string
          id?: string
          label?: string
          metadata?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_entries_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_entries_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "dictionary_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      db_connections: {
        Row: {
          created_at: string
          database_name: string
          db_password: string
          db_user: string
          host: string
          id: string
          is_active: boolean
          last_test_success: boolean | null
          last_tested_at: string | null
          name: string
          owner_user_id: string
          port: number
          ssl_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          database_name: string
          db_password: string
          db_user: string
          host: string
          id?: string
          is_active?: boolean
          last_test_success?: boolean | null
          last_tested_at?: string | null
          name: string
          owner_user_id: string
          port?: number
          ssl_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          database_name?: string
          db_password?: string
          db_user?: string
          host?: string
          id?: string
          is_active?: boolean
          last_test_success?: boolean | null
          last_tested_at?: string | null
          name?: string
          owner_user_id?: string
          port?: number
          ssl_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dictionary_catalogs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["catalog_kind"]
          name: string
          slug: string
          source_label: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["catalog_kind"]
          name: string
          slug: string
          source_label?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["catalog_kind"]
          name?: string
          slug?: string
          source_label?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      extraction_configs: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          description: string | null
          ficha_definition_id: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          description?: string | null
          ficha_definition_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          ficha_definition_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_configs_ficha_definition_id_fkey"
            columns: ["ficha_definition_id"]
            isOneToOne: false
            referencedRelation: "ficha_definition_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_configs_ficha_definition_id_fkey"
            columns: ["ficha_definition_id"]
            isOneToOne: false
            referencedRelation: "ficha_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_runs: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          extraction_config_id: string
          finished_at: string | null
          id: string
          run_summary: Json
          started_at: string | null
          status: Database["public"]["Enums"]["extraction_run_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          extraction_config_id: string
          finished_at?: string | null
          id?: string
          run_summary?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["extraction_run_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          extraction_config_id?: string
          finished_at?: string | null
          id?: string
          run_summary?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["extraction_run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "extraction_runs_extraction_config_id_fkey"
            columns: ["extraction_config_id"]
            isOneToOne: false
            referencedRelation: "extraction_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_extension: string | null
          id: string
          is_active: boolean
          name: string
          serialization_protocol: string | null
          slug: string
          technical_name: string | null
          transport_type_code: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_extension?: string | null
          id?: string
          is_active?: boolean
          name: string
          serialization_protocol?: string | null
          slug: string
          technical_name?: string | null
          transport_type_code?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_extension?: string | null
          id?: string
          is_active?: boolean
          name?: string
          serialization_protocol?: string | null
          slug?: string
          technical_name?: string | null
          transport_type_code?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      ficha_fields: {
        Row: {
          created_at: string
          created_by: string | null
          data_type: string
          ficha_definition_id: string
          field_key: string
          field_label: string
          field_path: string | null
          id: string
          max_length: number | null
          min_length: number | null
          references_catalog_id: string | null
          required: boolean
          rules: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_type: string
          ficha_definition_id: string
          field_key: string
          field_label: string
          field_path?: string | null
          id?: string
          max_length?: number | null
          min_length?: number | null
          references_catalog_id?: string | null
          required?: boolean
          rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_type?: string
          ficha_definition_id?: string
          field_key?: string
          field_label?: string
          field_path?: string | null
          id?: string
          max_length?: number | null
          min_length?: number | null
          references_catalog_id?: string | null
          required?: boolean
          rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_fields_ficha_definition_id_fkey"
            columns: ["ficha_definition_id"]
            isOneToOne: false
            referencedRelation: "ficha_definition_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_fields_ficha_definition_id_fkey"
            columns: ["ficha_definition_id"]
            isOneToOne: false
            referencedRelation: "ficha_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_fields_references_catalog_id_fkey"
            columns: ["references_catalog_id"]
            isOneToOne: false
            referencedRelation: "catalog_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_fields_references_catalog_id_fkey"
            columns: ["references_catalog_id"]
            isOneToOne: false
            referencedRelation: "dictionary_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      health_units: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          municipality_id: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          municipality_id: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          municipality_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_units_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c2_flag_cache: {
        Row: {
          completed: boolean
          created_at: string
          detail: string
          earned_points: number
          flag_key: string
          id: string
          metric: string
          owner_user_id: string
          patient_cache_id: string
          points: number
          source_snapshot: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key: string
          id?: string
          metric?: string
          owner_user_id: string
          patient_cache_id: string
          points?: number
          source_snapshot?: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key?: string
          id?: string
          metric?: string
          owner_user_id?: string
          patient_cache_id?: string
          points?: number
          source_snapshot?: Json
          status?: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c2_flag_cache_patient_cache_id_fkey"
            columns: ["patient_cache_id"]
            isOneToOne: false
            referencedRelation: "indicator_c2_patient_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c2_flag_status: {
        Row: {
          completed: boolean
          created_at: string
          detail: string
          earned_points: number
          flag_key: string
          id: string
          metric: string
          nominal_patient_id: string
          owner_user_id: string
          patient_status_id: string
          points: number
          source_snapshot: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key: string
          id?: string
          metric?: string
          nominal_patient_id: string
          owner_user_id: string
          patient_status_id: string
          points?: number
          source_snapshot?: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key?: string
          id?: string
          metric?: string
          nominal_patient_id?: string
          owner_user_id?: string
          patient_status_id?: string
          points?: number
          source_snapshot?: Json
          status?: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c2_flag_status_nominal_patient_id_fkey"
            columns: ["nominal_patient_id"]
            isOneToOne: false
            referencedRelation: "indicator_nominal_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c2_flag_status_patient_status_id_fkey"
            columns: ["patient_status_id"]
            isOneToOne: false
            referencedRelation: "indicator_c2_patient_status"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c2_patient_cache: {
        Row: {
          calculated_at: string
          classification: Database["public"]["Enums"]["indicator_classification"]
          cns: string
          completed_flags: number
          cpf: string
          created_at: string
          equipe: string
          id: string
          idade_em_meses: number
          nascimento: string | null
          nome: string
          owner_user_id: string
          patient_index: number
          patient_key: string
          pending_flags: number
          reference_upload_id: string
          reference_upload_row_id: string | null
          sexo: string
          source_snapshot: Json
          total_points: number
          tracking_flags: number
          unidade: string
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          cns?: string
          completed_flags?: number
          cpf?: string
          created_at?: string
          equipe?: string
          id?: string
          idade_em_meses?: number
          nascimento?: string | null
          nome?: string
          owner_user_id: string
          patient_index: number
          patient_key: string
          pending_flags?: number
          reference_upload_id: string
          reference_upload_row_id?: string | null
          sexo?: string
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          cns?: string
          completed_flags?: number
          cpf?: string
          created_at?: string
          equipe?: string
          id?: string
          idade_em_meses?: number
          nascimento?: string | null
          nome?: string
          owner_user_id?: string
          patient_index?: number
          patient_key?: string
          pending_flags?: number
          reference_upload_id?: string
          reference_upload_row_id?: string | null
          sexo?: string
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c2_patient_cache_reference_upload_id_fkey"
            columns: ["reference_upload_id"]
            isOneToOne: false
            referencedRelation: "reference_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c2_patient_cache_reference_upload_row_id_fkey"
            columns: ["reference_upload_row_id"]
            isOneToOne: false
            referencedRelation: "reference_upload_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c2_patient_status: {
        Row: {
          calculated_at: string
          classification: Database["public"]["Enums"]["indicator_classification"]
          completed_flags: number
          created_at: string
          id: string
          idade_em_meses: number
          indicator_upload_id: string
          nominal_patient_id: string
          owner_user_id: string
          pending_flags: number
          refresh_id: string | null
          source_snapshot: Json
          total_points: number
          tracking_flags: number
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          completed_flags?: number
          created_at?: string
          id?: string
          idade_em_meses?: number
          indicator_upload_id: string
          nominal_patient_id: string
          owner_user_id: string
          pending_flags?: number
          refresh_id?: string | null
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          completed_flags?: number
          created_at?: string
          id?: string
          idade_em_meses?: number
          indicator_upload_id?: string
          nominal_patient_id?: string
          owner_user_id?: string
          pending_flags?: number
          refresh_id?: string | null
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c2_patient_status_indicator_upload_id_fkey"
            columns: ["indicator_upload_id"]
            isOneToOne: false
            referencedRelation: "indicator_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c2_patient_status_nominal_patient_id_fkey"
            columns: ["nominal_patient_id"]
            isOneToOne: true
            referencedRelation: "indicator_nominal_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c2_patient_status_refresh_id_fkey"
            columns: ["refresh_id"]
            isOneToOne: false
            referencedRelation: "indicator_procedure_refreshes"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c3_flag_status: {
        Row: {
          completed: boolean
          created_at: string
          detail: string
          earned_points: number
          flag_key: string
          id: string
          metric: string
          nominal_patient_id: string
          owner_user_id: string
          patient_status_id: string
          points: number
          source_snapshot: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key: string
          id?: string
          metric?: string
          nominal_patient_id: string
          owner_user_id: string
          patient_status_id: string
          points?: number
          source_snapshot?: Json
          status: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          detail?: string
          earned_points?: number
          flag_key?: string
          id?: string
          metric?: string
          nominal_patient_id?: string
          owner_user_id?: string
          patient_status_id?: string
          points?: number
          source_snapshot?: Json
          status?: Database["public"]["Enums"]["indicator_flag_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c3_flag_status_nominal_patient_id_fkey"
            columns: ["nominal_patient_id"]
            isOneToOne: false
            referencedRelation: "indicator_nominal_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c3_flag_status_patient_status_id_fkey"
            columns: ["patient_status_id"]
            isOneToOne: false
            referencedRelation: "indicator_c3_patient_status"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_c3_patient_status: {
        Row: {
          calculated_at: string
          classification: Database["public"]["Enums"]["indicator_classification"]
          completed_flags: number
          created_at: string
          id: string
          idade_em_meses: number
          indicator_upload_id: string
          nominal_patient_id: string
          owner_user_id: string
          pending_flags: number
          refresh_id: string | null
          source_snapshot: Json
          total_points: number
          tracking_flags: number
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          completed_flags?: number
          created_at?: string
          id?: string
          idade_em_meses?: number
          indicator_upload_id: string
          nominal_patient_id: string
          owner_user_id: string
          pending_flags?: number
          refresh_id?: string | null
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          classification?: Database["public"]["Enums"]["indicator_classification"]
          completed_flags?: number
          created_at?: string
          id?: string
          idade_em_meses?: number
          indicator_upload_id?: string
          nominal_patient_id?: string
          owner_user_id?: string
          pending_flags?: number
          refresh_id?: string | null
          source_snapshot?: Json
          total_points?: number
          tracking_flags?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_c3_patient_status_indicator_upload_id_fkey"
            columns: ["indicator_upload_id"]
            isOneToOne: false
            referencedRelation: "indicator_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c3_patient_status_nominal_patient_id_fkey"
            columns: ["nominal_patient_id"]
            isOneToOne: true
            referencedRelation: "indicator_nominal_patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_c3_patient_status_refresh_id_fkey"
            columns: ["refresh_id"]
            isOneToOne: false
            referencedRelation: "indicator_procedure_refreshes"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_nominal_patients: {
        Row: {
          acs: string
          backend_cns: string
          backend_cpf: string
          backend_equipe: string
          backend_nome: string
          backend_sexo: string
          backend_unidade: string
          cns: string
          cpf: string
          created_at: string
          id: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id: string
          nascimento: string | null
          nome: string
          owner_user_id: string
          patient_index: number
          patient_key: string
          sexo: string
          sheet_name: string
          source_snapshot: Json
          updated_at: string
        }
        Insert: {
          acs?: string
          backend_cns?: string
          backend_cpf?: string
          backend_equipe?: string
          backend_nome?: string
          backend_sexo?: string
          backend_unidade?: string
          cns?: string
          cpf?: string
          created_at?: string
          id?: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id: string
          nascimento?: string | null
          nome?: string
          owner_user_id: string
          patient_index: number
          patient_key: string
          sexo?: string
          sheet_name: string
          source_snapshot?: Json
          updated_at?: string
        }
        Update: {
          acs?: string
          backend_cns?: string
          backend_cpf?: string
          backend_equipe?: string
          backend_nome?: string
          backend_sexo?: string
          backend_unidade?: string
          cns?: string
          cpf?: string
          created_at?: string
          id?: string
          indicator_code?: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id?: string
          nascimento?: string | null
          nome?: string
          owner_user_id?: string
          patient_index?: number
          patient_key?: string
          sexo?: string
          sheet_name?: string
          source_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_nominal_patients_indicator_upload_id_fkey"
            columns: ["indicator_upload_id"]
            isOneToOne: false
            referencedRelation: "indicator_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_procedure_refreshes: {
        Row: {
          created_at: string
          id: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id: string
          owner_user_id: string
          refresh_scope: string
          status: string
          summary: Json
        }
        Insert: {
          created_at?: string
          id?: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id: string
          owner_user_id: string
          refresh_scope?: string
          status?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          id?: string
          indicator_code?: Database["public"]["Enums"]["indicator_code"]
          indicator_upload_id?: string
          owner_user_id?: string
          refresh_scope?: string
          status?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "indicator_procedure_refreshes_indicator_upload_id_fkey"
            columns: ["indicator_upload_id"]
            isOneToOne: false
            referencedRelation: "indicator_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_uploads: {
        Row: {
          created_at: string
          id: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          is_active: boolean
          name: string
          original_file_name: string
          owner_user_id: string
          reference_upload_id: string | null
          replaced_at: string | null
          selected_sheet_name: string | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicator_code: Database["public"]["Enums"]["indicator_code"]
          is_active?: boolean
          name: string
          original_file_name: string
          owner_user_id: string
          reference_upload_id?: string | null
          replaced_at?: string | null
          selected_sheet_name?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          indicator_code?: Database["public"]["Enums"]["indicator_code"]
          is_active?: boolean
          name?: string
          original_file_name?: string
          owner_user_id?: string
          reference_upload_id?: string | null
          replaced_at?: string | null
          selected_sheet_name?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_uploads_reference_upload_id_fkey"
            columns: ["reference_upload_id"]
            isOneToOne: false
            referencedRelation: "reference_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["section_access"]
          created_at: string
          id: string
          profile_id: string
          section_key: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["section_access"]
          created_at?: string
          id?: string
          profile_id: string
          section_key: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["section_access"]
          created_at?: string
          id?: string
          profile_id?: string
          section_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_upload_rows: {
        Row: {
          backend_match: Json
          created_at: string
          id: string
          match_found: boolean
          match_source: string | null
          owner_user_id: string
          raw_data: Json
          reference_upload_id: string
          reference_upload_sheet_id: string
          row_index: number
          search_birth_date: string | null
          search_cns: string | null
          search_cpf: string | null
          search_name: string | null
          updated_at: string
        }
        Insert: {
          backend_match?: Json
          created_at?: string
          id?: string
          match_found?: boolean
          match_source?: string | null
          owner_user_id: string
          raw_data?: Json
          reference_upload_id: string
          reference_upload_sheet_id: string
          row_index: number
          search_birth_date?: string | null
          search_cns?: string | null
          search_cpf?: string | null
          search_name?: string | null
          updated_at?: string
        }
        Update: {
          backend_match?: Json
          created_at?: string
          id?: string
          match_found?: boolean
          match_source?: string | null
          owner_user_id?: string
          raw_data?: Json
          reference_upload_id?: string
          reference_upload_sheet_id?: string
          row_index?: number
          search_birth_date?: string | null
          search_cns?: string | null
          search_cpf?: string | null
          search_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_upload_rows_reference_upload_id_fkey"
            columns: ["reference_upload_id"]
            isOneToOne: false
            referencedRelation: "reference_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_upload_rows_reference_upload_sheet_id_fkey"
            columns: ["reference_upload_sheet_id"]
            isOneToOne: false
            referencedRelation: "reference_upload_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_upload_sheets: {
        Row: {
          column_names: string[]
          created_at: string
          id: string
          owner_user_id: string
          reference_upload_id: string
          row_count: number
          sheet_name: string
          updated_at: string
          upload_mode: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Insert: {
          column_names?: string[]
          created_at?: string
          id?: string
          owner_user_id: string
          reference_upload_id: string
          row_count?: number
          sheet_name: string
          updated_at?: string
          upload_mode: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Update: {
          column_names?: string[]
          created_at?: string
          id?: string
          owner_user_id?: string
          reference_upload_id?: string
          row_count?: number
          sheet_name?: string
          updated_at?: string
          upload_mode?: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "reference_upload_sheets_reference_upload_id_fkey"
            columns: ["reference_upload_id"]
            isOneToOne: false
            referencedRelation: "reference_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_uploads: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          original_file_name: string
          owner_user_id: string
          replaced_at: string | null
          updated_at: string
          upload_mode: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          original_file_name: string
          owner_user_id: string
          replaced_at?: string | null
          updated_at?: string
          upload_mode: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          original_file_name?: string
          owner_user_id?: string
          replaced_at?: string | null
          updated_at?: string
          upload_mode?: Database["public"]["Enums"]["reference_upload_mode"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      catalog_summary: {
        Row: {
          entry_count: number | null
          id: string | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["catalog_kind"] | null
          name: string | null
          slug: string | null
          source_label: string | null
          version: string | null
        }
        Relationships: []
      }
      ficha_definition_summary: {
        Row: {
          description: string | null
          field_count: number | null
          file_extension: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          slug: string | null
          technical_name: string | null
          transport_type_code: string | null
          version: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_extraction_config: {
        Args: { _config_owner: string }
        Returns: boolean
      }
      can_manage_dictionary: { Args: never; Returns: boolean }
      can_manage_extraction_config: {
        Args: { _config_owner: string }
        Returns: boolean
      }
      can_read_dictionary: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_app_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "analyst"
      catalog_kind:
        | "transport_header"
        | "record_type"
        | "code_dictionary"
        | "reference"
      extraction_run_status: "queued" | "running" | "completed" | "failed"
      indicator_classification: "regular" | "suficiente" | "bom" | "otimo"
      indicator_code: "c2_development_child" | "c3_gestation_puerperium"
      indicator_flag_status: "done" | "attention" | "tracking"
      reference_upload_mode: "citizen" | "professional"
      section_access: "sem_acesso" | "visualizacao" | "edicao" | "admin_total"
      user_status:
        | "pendente_aprovacao"
        | "aprovado"
        | "bloqueado"
        | "reprovado"
        | "inativo"
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
      app_role: ["admin", "analyst"],
      catalog_kind: [
        "transport_header",
        "record_type",
        "code_dictionary",
        "reference",
      ],
      extraction_run_status: ["queued", "running", "completed", "failed"],
      indicator_classification: ["regular", "suficiente", "bom", "otimo"],
      indicator_code: ["c2_development_child", "c3_gestation_puerperium"],
      indicator_flag_status: ["done", "attention", "tracking"],
      reference_upload_mode: ["citizen", "professional"],
      section_access: ["sem_acesso", "visualizacao", "edicao", "admin_total"],
      user_status: [
        "pendente_aprovacao",
        "aprovado",
        "bloqueado",
        "reprovado",
        "inativo",
      ],
    },
  },
} as const
