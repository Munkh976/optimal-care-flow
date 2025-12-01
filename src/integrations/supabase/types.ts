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
          naics_code: string | null
          phone: string | null
          state: string | null
          tax_id: string | null
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
          naics_code?: string | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
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
          naics_code?: string | null
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      care_types: {
        Row: {
          category: string
          code: string
          created_at: string | null
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean | null
          keywords: string | null
          name: string
          price: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          name: string
          price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string | null
          name?: string
          price?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          client_id: string
          created_at: string | null
          days_of_week: string | null
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
          client_id: string
          created_at?: string | null
          days_of_week?: string | null
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
          client_id?: string
          created_at?: string | null
          days_of_week?: string | null
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
            referencedRelation: "caregivers"
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
          shift_id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string | null
        }
        Relationships: [
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
      shift_trades: {
        Row: {
          created_at: string | null
          id: string
          new_caregiver_id: string | null
          original_caregiver_id: string
          reason: string | null
          resolved_at: string | null
          shift_assignment_id: string
          status: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount: number | null
          trade_type: Database["public"]["Enums"]["trade_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_caregiver_id?: string | null
          original_caregiver_id: string
          reason?: string | null
          resolved_at?: string | null
          shift_assignment_id: string
          status?: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount?: number | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          new_caregiver_id?: string | null
          original_caregiver_id?: string
          reason?: string | null
          resolved_at?: string | null
          shift_assignment_id?: string
          status?: Database["public"]["Enums"]["trade_status"]
          surge_pay_amount?: number | null
          trade_type?: Database["public"]["Enums"]["trade_type"]
        }
        Relationships: [
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
      [_ in never]: never
    }
    Functions: {
      assign_caregiver_role: {
        Args: { caregiver_email: string }
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
