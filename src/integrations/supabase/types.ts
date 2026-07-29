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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agency: {
        Row: {
          address: string | null
          agency_name: string
          business_type: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          late_trade_hours: number
          max_weekly_hours: number
          naics_code: string | null
          phone: string | null
          smart_match_weights: Json
          state: string | null
          tax_id: string | null
          travel_buffer_minutes: number
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          agency_name: string
          business_type?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          late_trade_hours?: number
          max_weekly_hours?: number
          naics_code?: string | null
          phone?: string | null
          smart_match_weights?: Json
          state?: string | null
          tax_id?: string | null
          travel_buffer_minutes?: number
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          agency_name?: string
          business_type?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          late_trade_hours?: number
          max_weekly_hours?: number
          naics_code?: string | null
          phone?: string | null
          smart_match_weights?: Json
          state?: string | null
          tax_id?: string | null
          travel_buffer_minutes?: number
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      care_service_categories: {
        Row: {
          code_prefix: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      care_types: {
        Row: {
          category: string
          category_id: string | null
          code: string
          created_at: string | null
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean | null
          keywords: string | null
          name: string
          price: number | null
          requires_trade_approval: boolean
          updated_at: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          name: string
          price?: number | null
          requires_trade_approval?: boolean
          updated_at?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          name?: string
          price?: number | null
          requires_trade_approval?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "care_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_availability: {
        Row: {
          caregiver_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          caregiver_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          caregiver_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_availability_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "caregiver_availability_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_certifications: {
        Row: {
          caregiver_id: string
          certification_name: string
          certification_number: string | null
          created_at: string | null
          document_url: string | null
          expiry_date: string
          id: string
          is_verified: boolean | null
          issued_date: string | null
          updated_at: string | null
        }
        Insert: {
          caregiver_id: string
          certification_name: string
          certification_number?: string | null
          created_at?: string | null
          document_url?: string | null
          expiry_date: string
          id?: string
          is_verified?: boolean | null
          issued_date?: string | null
          updated_at?: string | null
        }
        Update: {
          caregiver_id?: string
          certification_name?: string
          certification_number?: string | null
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string
          id?: string
          is_verified?: boolean | null
          issued_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_certifications_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "caregiver_certifications_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_registrations: {
        Row: {
          address: string | null
          agency_id: string | null
          availability: Json | null
          care_type_codes: string[]
          city: string | null
          created_at: string | null
          email: string
          employment_type: string | null
          first_name: string
          hourly_rate: number | null
          id: string
          last_name: string
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          agency_id?: string | null
          availability?: Json | null
          care_type_codes?: string[]
          city?: string | null
          created_at?: string | null
          email: string
          employment_type?: string | null
          first_name: string
          hourly_rate?: number | null
          id?: string
          last_name: string
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string | null
          availability?: Json | null
          care_type_codes?: string[]
          city?: string | null
          created_at?: string | null
          email?: string
          employment_type?: string | null
          first_name?: string
          hourly_rate?: number | null
          id?: string
          last_name?: string
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_registrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_skills: {
        Row: {
          care_type_code: string
          caregiver_id: string
          created_at: string | null
          id: string
          is_certified: boolean | null
          proficiency_level: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          care_type_code: string
          caregiver_id: string
          created_at?: string | null
          id?: string
          is_certified?: boolean | null
          proficiency_level?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          care_type_code?: string
          caregiver_id?: string
          created_at?: string | null
          id?: string
          is_certified?: boolean | null
          proficiency_level?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_skills_care_type_code_fkey"
            columns: ["care_type_code"]
            isOneToOne: false
            referencedRelation: "care_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "caregiver_skills_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "caregiver_skills_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          address: string | null
          agency_id: string
          availability: Json | null
          city: string | null
          created_at: string | null
          custom_min_hours: number | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          last_name: string
          location_address: string | null
          location_city: string | null
          location_state: string | null
          location_zip_code: string | null
          performance_rating: number | null
          phone: string
          reliability_score: number | null
          role: Database["public"]["Enums"]["caregiver_role"]
          service_radius_miles: number | null
          service_zipcodes: string[] | null
          state: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          availability?: Json | null
          city?: string | null
          created_at?: string | null
          custom_min_hours?: number | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name: string
          location_address?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip_code?: string | null
          performance_rating?: number | null
          phone: string
          reliability_score?: number | null
          role?: Database["public"]["Enums"]["caregiver_role"]
          service_radius_miles?: number | null
          service_zipcodes?: string[] | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          availability?: Json | null
          city?: string | null
          created_at?: string | null
          custom_min_hours?: number | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          location_address?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip_code?: string | null
          performance_rating?: number | null
          phone?: string
          reliability_score?: number | null
          role?: Database["public"]["Enums"]["caregiver_role"]
          service_radius_miles?: number | null
          service_zipcodes?: string[] | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
      client_care_needs: {
        Row: {
          care_type_code: string
          client_id: string
          created_at: string | null
          id: string
          notes: string | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          care_type_code: string
          client_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          care_type_code?: string
          client_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_care_needs_care_type_code_fkey"
            columns: ["care_type_code"]
            isOneToOne: false
            referencedRelation: "care_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "client_care_needs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_orders: {
        Row: {
          agency_id: string
          archived_at: string | null
          archived_by: string | null
          client_id: string
          created_at: string | null
          days_of_week: string | null
          duration_months: number | null
          end_date: string
          frequency: string
          id: string
          notes: string | null
          order_number: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          archived_at?: string | null
          archived_by?: string | null
          client_id: string
          created_at?: string | null
          days_of_week?: string | null
          duration_months?: number | null
          end_date: string
          frequency?: string
          id?: string
          notes?: string | null
          order_number?: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          archived_at?: string | null
          archived_by?: string | null
          client_id?: string
          created_at?: string | null
          days_of_week?: string | null
          duration_months?: number | null
          end_date?: string
          frequency?: string
          id?: string
          notes?: string | null
          order_number?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_orders_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          agency_id: string
          care_requirements: string[] | null
          city: string
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          medical_conditions: string[] | null
          notes: string | null
          phone: string
          preferred_caregiver_id: string | null
          state: string
          updated_at: string | null
          user_id: string | null
          zip_code: string
        }
        Insert: {
          address: string
          agency_id: string
          care_requirements?: string[] | null
          city: string
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          medical_conditions?: string[] | null
          notes?: string | null
          phone: string
          preferred_caregiver_id?: string | null
          state: string
          updated_at?: string | null
          user_id?: string | null
          zip_code: string
        }
        Update: {
          address?: string
          agency_id?: string
          care_requirements?: string[] | null
          city?: string
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          medical_conditions?: string[] | null
          notes?: string | null
          phone?: string
          preferred_caregiver_id?: string | null
          state?: string
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_caregiver_id_fkey"
            columns: ["preferred_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "clients_preferred_caregiver_id_fkey"
            columns: ["preferred_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_answers: {
        Row: {
          answered_at: string
          created_at: string
          free_text: string | null
          id: string
          is_active: boolean
          node_id: string
          option_ids: string[]
          option_labels: string[]
          score_delta: number
          sequence_index: number
          session_id: string
          skipped: boolean
          updated_at: string
        }
        Insert: {
          answered_at?: string
          created_at?: string
          free_text?: string | null
          id?: string
          is_active?: boolean
          node_id: string
          option_ids?: string[]
          option_labels?: string[]
          score_delta?: number
          sequence_index: number
          session_id: string
          skipped?: boolean
          updated_at?: string
        }
        Update: {
          answered_at?: string
          created_at?: string
          free_text?: string | null
          id?: string
          is_active?: boolean
          node_id?: string
          option_ids?: string[]
          option_labels?: string[]
          score_delta?: number
          sequence_index?: number
          session_id?: string
          skipped?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_answers_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_flows: {
        Row: {
          agency_id: string | null
          audience: Database["public"]["Enums"]["flow_audience"]
          created_at: string
          description: string | null
          draft_of: string | null
          entry_node_id: string | null
          id: string
          is_active: boolean
          name: string
          published_at: string | null
          review_threshold: number
          status: string
          strong_fit_threshold: number
          updated_at: string
          version: number
        }
        Insert: {
          agency_id?: string | null
          audience?: Database["public"]["Enums"]["flow_audience"]
          created_at?: string
          description?: string | null
          draft_of?: string | null
          entry_node_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          published_at?: string | null
          review_threshold?: number
          status?: string
          strong_fit_threshold?: number
          updated_at?: string
          version?: number
        }
        Update: {
          agency_id?: string | null
          audience?: Database["public"]["Enums"]["flow_audience"]
          created_at?: string
          description?: string | null
          draft_of?: string | null
          entry_node_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          published_at?: string | null
          review_threshold?: number
          status?: string
          strong_fit_threshold?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_flows_draft_of_fkey"
            columns: ["draft_of"]
            isOneToOne: false
            referencedRelation: "conversation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_flows_entry_node_fkey"
            columns: ["entry_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          agency_id: string | null
          band: string | null
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          current_node_id: string | null
          flow_id: string
          id: string
          registration_id: string | null
          session_token: string
          started_at: string
          status: Database["public"]["Enums"]["conversation_session_status"]
          total_score: number
          trait_profile: Json
          trait_scores: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          band?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_node_id?: string | null
          flow_id: string
          id?: string
          registration_id?: string | null
          session_token: string
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_session_status"]
          total_score?: number
          trait_profile?: Json
          trait_scores?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          band?: string | null
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          current_node_id?: string | null
          flow_id?: string
          id?: string
          registration_id?: string | null
          session_token?: string
          started_at?: string
          status?: Database["public"]["Enums"]["conversation_session_status"]
          total_score?: number
          trait_profile?: Json
          trait_scores?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "conversation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "caregiver_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          allow_free_text: boolean
          allow_skip: boolean
          created_at: string
          default_next_node_id: string | null
          flow_id: string
          free_text_label: string | null
          helper_text: string | null
          id: string
          node_key: string
          node_type: Database["public"]["Enums"]["flow_node_type"]
          prompt: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_free_text?: boolean
          allow_skip?: boolean
          created_at?: string
          default_next_node_id?: string | null
          flow_id: string
          free_text_label?: string | null
          helper_text?: string | null
          id?: string
          node_key: string
          node_type?: Database["public"]["Enums"]["flow_node_type"]
          prompt: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_free_text?: boolean
          allow_skip?: boolean
          created_at?: string
          default_next_node_id?: string | null
          flow_id?: string
          free_text_label?: string | null
          helper_text?: string | null
          id?: string
          node_key?: string
          node_type?: Database["public"]["Enums"]["flow_node_type"]
          prompt?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_default_next_fkey"
            columns: ["default_next_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "conversation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_options: {
        Row: {
          created_at: string
          id: string
          label: string
          next_node_id: string | null
          node_id: string
          score_weight: number
          sort_order: number
          trait_tag: string | null
          trait_weights: Json
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          next_node_id?: string | null
          node_id: string
          score_weight?: number
          sort_order?: number
          trait_tag?: string | null
          trait_weights?: Json
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          next_node_id?: string | null
          node_id?: string
          score_weight?: number
          sort_order?: number
          trait_tag?: string | null
          trait_weights?: Json
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_options_next_node_id_fkey"
            columns: ["next_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_options_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_services: {
        Row: {
          care_type_code: string
          created_at: string
          days_of_week: number[]
          end_time: string
          frequency: string
          id: string
          is_active: boolean
          notes: string | null
          order_id: string
          start_time: string
          updated_at: string
          week_of_month: number | null
        }
        Insert: {
          care_type_code: string
          created_at?: string
          days_of_week?: number[]
          end_time: string
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          order_id: string
          start_time: string
          updated_at?: string
          week_of_month?: number | null
        }
        Update: {
          care_type_code?: string
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          frequency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          order_id?: string
          start_time?: string
          updated_at?: string
          week_of_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_services_care_type_code_fkey"
            columns: ["care_type_code"]
            isOneToOne: false
            referencedRelation: "care_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "order_services_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_notifications: {
        Row: {
          agency_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          payload: Json
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string
          business_license: string | null
          created_at: string | null
          default_ft_min_hours: number | null
          default_pt_min_hours: number | null
          email: string
          full_name: string | null
          id: string
          overtime_threshold: number | null
          phone: string | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          business_license?: string | null
          created_at?: string | null
          default_ft_min_hours?: number | null
          default_pt_min_hours?: number | null
          email: string
          full_name?: string | null
          id: string
          overtime_threshold?: number | null
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          business_license?: string | null
          created_at?: string | null
          default_ft_min_hours?: number | null
          default_pt_min_hours?: number | null
          email?: string
          full_name?: string | null
          id?: string
          overtime_threshold?: number | null
          phone?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string | null
          id: string
          module_code: string
          role_code: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          module_code: string
          role_code: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          module_code?: string
          role_code?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "system_modules"
            referencedColumns: ["module_code"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          actual_hours_worked: number | null
          assigned_at: string | null
          assignment_method: Database["public"]["Enums"]["assignment_method"]
          caregiver_id: string
          clock_in_location: string | null
          clock_in_time: string | null
          clock_out_location: string | null
          clock_out_time: string | null
          created_at: string | null
          id: string
          is_locked: boolean | null
          mileage: number | null
          notes: string | null
          override_at: string | null
          override_by: string | null
          override_reason: string | null
          shift_id: string
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string | null
        }
        Insert: {
          actual_hours_worked?: number | null
          assigned_at?: string | null
          assignment_method?: Database["public"]["Enums"]["assignment_method"]
          caregiver_id: string
          clock_in_location?: string | null
          clock_in_time?: string | null
          clock_out_location?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          mileage?: number | null
          notes?: string | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          shift_id: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string | null
        }
        Update: {
          actual_hours_worked?: number | null
          assigned_at?: string | null
          assignment_method?: Database["public"]["Enums"]["assignment_method"]
          caregiver_id?: string
          clock_in_location?: string | null
          clock_in_time?: string | null
          clock_out_location?: string | null
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          mileage?: number | null
          notes?: string | null
          override_at?: string | null
          override_by?: string | null
          override_reason?: string | null
          shift_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "shift_assignments_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_ratings: {
        Row: {
          agency_id: string
          caregiver_id: string
          client_id: string
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          rating: number
          shift_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          caregiver_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          rating: number
          shift_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          caregiver_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          rating?: number
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_ratings_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "shift_ratings_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_ratings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_trades: {
        Row: {
          approval_reasons: string[]
          auto_approved: boolean
          created_at: string | null
          decided_by: string | null
          decision_notes: string | null
          eligibility_snapshot: Json | null
          id: string
          new_caregiver_id: string | null
          original_caregiver_id: string
          reason: string | null
          requires_manager_approval: boolean
          resolved_at: string | null
          shift_assignment_id: string
          shift_id: string | null
          status: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount: number | null
          trade_type: Database["public"]["Enums"]["trade_type"]
          updated_at: string
        }
        Insert: {
          approval_reasons?: string[]
          auto_approved?: boolean
          created_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          eligibility_snapshot?: Json | null
          id?: string
          new_caregiver_id?: string | null
          original_caregiver_id: string
          reason?: string | null
          requires_manager_approval?: boolean
          resolved_at?: string | null
          shift_assignment_id: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount?: number | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
        }
        Update: {
          approval_reasons?: string[]
          auto_approved?: boolean
          created_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          eligibility_snapshot?: Json | null
          id?: string
          new_caregiver_id?: string | null
          original_caregiver_id?: string
          reason?: string | null
          requires_manager_approval?: boolean
          resolved_at?: string | null
          shift_assignment_id?: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount?: number | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_trades_new_caregiver_id_fkey"
            columns: ["new_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "shift_trades_new_caregiver_id_fkey"
            columns: ["new_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trades_original_caregiver_id_fkey"
            columns: ["original_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "shift_trades_original_caregiver_id_fkey"
            columns: ["original_caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_trades_shift_assignment_id_fkey"
            columns: ["shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          agency_id: string
          ai_match_score: number | null
          care_type_code: string
          caregiver_id: string | null
          client_id: string
          created_at: string | null
          duration_hours: number
          end_time: string
          id: string
          is_recurring: boolean | null
          order_id: string | null
          order_service_id: string | null
          order_title: string
          pay_rate: number | null
          recurrence_pattern: string | null
          required_skills: string[] | null
          shift_date: string
          special_instructions: string | null
          special_notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["shift_status"] | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          ai_match_score?: number | null
          care_type_code: string
          caregiver_id?: string | null
          client_id: string
          created_at?: string | null
          duration_hours: number
          end_time: string
          id?: string
          is_recurring?: boolean | null
          order_id?: string | null
          order_service_id?: string | null
          order_title?: string
          pay_rate?: number | null
          recurrence_pattern?: string | null
          required_skills?: string[] | null
          shift_date: string
          special_instructions?: string | null
          special_notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          ai_match_score?: number | null
          care_type_code?: string
          caregiver_id?: string | null
          client_id?: string
          created_at?: string | null
          duration_hours?: number
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          order_id?: string | null
          order_service_id?: string | null
          order_title?: string
          pay_rate?: number | null
          recurrence_pattern?: string | null
          required_skills?: string[] | null
          shift_date?: string
          special_instructions?: string | null
          special_notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_care_type_code_fkey"
            columns: ["care_type_code"]
            isOneToOne: false
            referencedRelation: "care_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "shifts_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "shifts_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "client_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_order_service_id_fkey"
            columns: ["order_service_id"]
            isOneToOne: false
            referencedRelation: "order_services"
            referencedColumns: ["id"]
          },
        ]
      }
      system_modules: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          module_code: string
          module_name: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_code: string
          module_name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          module_code?: string
          module_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_roles: {
        Row: {
          access_level: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          role_code: Database["public"]["Enums"]["app_role"]
          role_name: string
          updated_at: string | null
        }
        Insert: {
          access_level?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_code: Database["public"]["Enums"]["app_role"]
          role_name: string
          updated_at?: string | null
        }
        Update: {
          access_level?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_code?: Database["public"]["Enums"]["app_role"]
          role_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          approved_by_user_id: string | null
          caregiver_id: string
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          reason: string | null
          request_type: Database["public"]["Enums"]["request_type"]
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string | null
        }
        Insert: {
          approved_by_user_id?: string | null
          caregiver_id: string
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          reason?: string | null
          request_type: Database["public"]["Enums"]["request_type"]
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string | null
        }
        Update: {
          approved_by_user_id?: string | null
          caregiver_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          reason?: string | null
          request_type?: Database["public"]["Enums"]["request_type"]
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregiver_performance"
            referencedColumns: ["caregiver_id"]
          },
          {
            foreignKeyName: "time_off_requests_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          agency_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      caregiver_performance: {
        Row: {
          agency_id: string | null
          avg_rating: number | null
          caregiver_id: string | null
          completion_rate: number | null
          hours_last_30d: number | null
          lifetime_completed: number | null
          lifetime_hours: number | null
          lifetime_no_shows: number | null
          on_time_rate: number | null
          rating_count: number | null
          shifts_last_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caregivers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agency"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_caregiver_role: {
        Args: { caregiver_email: string }
        Returns: undefined
      }
      create_flow_draft: { Args: { p_flow_id: string }; Returns: string }
      discard_flow_draft: { Args: { p_draft_id: string }; Returns: undefined }
      flow_session_complete: {
        Args: {
          p_band: string
          p_contact_email?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_session_id: string
          p_token: string
          p_total_score: number
          p_trait_scores: Json
        }
        Returns: undefined
      }
      flow_session_link_registration: {
        Args: {
          p_registration_id: string
          p_session_id: string
          p_token: string
        }
        Returns: undefined
      }
      flow_session_progress: {
        Args: { p_node_id: string; p_session_id: string; p_token: string }
        Returns: undefined
      }
      flow_session_trim_answers: {
        Args: {
          p_from_index: number
          p_node_id: string
          p_session_id: string
          p_token: string
        }
        Returns: undefined
      }
      generate_order_number: { Args: never; Returns: string }
      get_caregiver_with_profile: {
        Args: { caregiver_uuid: string }
        Returns: {
          agency_id: string
          email: string
          full_name: string
          hourly_rate: number
          id: string
          is_active: boolean
          performance_rating: number
          phone: string
          role: Database["public"]["Enums"]["caregiver_role"]
          user_id: string
        }[]
      }
      get_client_with_profile: {
        Args: { client_uuid: string }
        Returns: {
          address: string
          agency_id: string
          city: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          medical_conditions: string[]
          phone: string
          state: string
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: {
          _module_code: string
          _permission_type: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      publish_flow_draft: { Args: { p_draft_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "system_admin"
        | "agency_admin"
        | "manager"
        | "scheduler"
        | "hr_staff"
        | "caregiver"
        | "client"
      assignment_method:
        | "manual"
        | "ai_suggested"
        | "auto_assigned"
        | "traded"
        | "picked_up"
      assignment_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "no_show"
        | "cancelled"
      care_type:
        | "personal_care"
        | "companionship"
        | "medication"
        | "mobility"
        | "dementia_care"
        | "hospice"
      caregiver_role: "full_time" | "part_time" | "on_call"
      conversation_session_status: "in_progress" | "completed" | "abandoned"
      flow_audience: "caregiver_screening" | "family_intake" | "general"
      flow_node_type:
        | "single_select"
        | "multi_select"
        | "info"
        | "contact_capture"
        | "terminal"
      request_status: "pending" | "approved" | "denied" | "cancelled"
      request_type: "vacation" | "medical" | "personal" | "emergency"
      shift_status:
        | "open"
        | "assigned"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "unassigned"
      trade_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "expired"
      trade_type: "trade_board" | "direct_trade" | "agency_coverage"
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
      app_role: [
        "system_admin",
        "agency_admin",
        "manager",
        "scheduler",
        "hr_staff",
        "caregiver",
        "client",
      ],
      assignment_method: [
        "manual",
        "ai_suggested",
        "auto_assigned",
        "traded",
        "picked_up",
      ],
      assignment_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "no_show",
        "cancelled",
      ],
      care_type: [
        "personal_care",
        "companionship",
        "medication",
        "mobility",
        "dementia_care",
        "hospice",
      ],
      caregiver_role: ["full_time", "part_time", "on_call"],
      conversation_session_status: ["in_progress", "completed", "abandoned"],
      flow_audience: ["caregiver_screening", "family_intake", "general"],
      flow_node_type: [
        "single_select",
        "multi_select",
        "info",
        "contact_capture",
        "terminal",
      ],
      request_status: ["pending", "approved", "denied", "cancelled"],
      request_type: ["vacation", "medical", "personal", "emergency"],
      shift_status: [
        "open",
        "assigned",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "unassigned",
      ],
      trade_status: ["pending", "accepted", "declined", "cancelled", "expired"],
      trade_type: ["trade_board", "direct_trade", "agency_coverage"],
    },
  },
} as const
