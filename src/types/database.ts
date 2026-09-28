export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          login_id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          login_id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          login_id?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          phone: string;
          notes: string;
          payouts?: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          phone?: string;
          notes?: string;
          payouts?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          phone?: string;
          notes?: string;
          payouts?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      cloths: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          customer_name: string;
          customer_phone: string;
          garment: string;
          garment_type: string;
          gender: string;
          fabric_color: string;
          size: string;
          measurements: Json;
          measurement_checks: Json;
          measurement_image: string | null;
          notes: string;
          status: 'cutting' | 'ready_to_sew' | 'sewing' | 'completed';
          cutter_id: string | null;
          tailor_id: string | null;
          total_amount: number;
          discount_amount: number;
          advance_amount: number;
          final_payment_amount: number;
          cutter_pay_amount: number;
          cutter_pay_advance: number;
          cutter_pay_final: number;
          cutter_pay_remarks: string;
          tailor_pay_amount: number;
          tailor_pay_advance: number;
          tailor_pay_final: number;
          tailor_pay_remarks: string;
          given_date: string | null;
          cutter_expected_date: string | null;
          tailor_expected_date: string | null;
          expected_date?: string | null;
          order_code?: string;
          created_at: string;
          updated_at: string;
          staff_jobs?: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          customer_name: string;
          customer_phone?: string;
          garment: string;
          garment_type?: string;
          gender?: string;
          fabric_color: string;
          size?: string;
          measurements?: Json;
          measurement_checks?: Json;
          measurement_image?: string | null;
          notes?: string;
          status?: 'cutting' | 'ready_to_sew' | 'sewing' | 'completed';
          cutter_id?: string | null;
          tailor_id?: string | null;
          total_amount?: number;
          discount_amount?: number;
          advance_amount?: number;
          final_payment_amount?: number;
          cutter_pay_amount?: number;
          cutter_pay_advance?: number;
          cutter_pay_final?: number;
          cutter_pay_remarks?: string;
          tailor_pay_amount?: number;
          tailor_pay_advance?: number;
          tailor_pay_final?: number;
          tailor_pay_remarks?: string;
          given_date?: string | null;
          cutter_expected_date?: string | null;
          tailor_expected_date?: string | null;
          expected_date?: string | null;
          order_code?: string;
          created_at?: string;
          updated_at?: string;
          staff_jobs?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          customer_name?: string;
          customer_phone?: string;
          garment?: string;
          garment_type?: string;
          gender?: string;
          fabric_color?: string;
          size?: string;
          measurements?: Json;
          measurement_checks?: Json;
          measurement_image?: string | null;
          notes?: string;
          status?: 'cutting' | 'ready_to_sew' | 'sewing' | 'completed';
          cutter_id?: string | null;
          tailor_id?: string | null;
          total_amount?: number;
          discount_amount?: number;
          advance_amount?: number;
          final_payment_amount?: number;
          cutter_pay_amount?: number;
          cutter_pay_advance?: number;
          cutter_pay_final?: number;
          cutter_pay_remarks?: string;
          tailor_pay_amount?: number;
          tailor_pay_advance?: number;
          tailor_pay_final?: number;
          tailor_pay_remarks?: string;
          given_date?: string | null;
          cutter_expected_date?: string | null;
          tailor_expected_date?: string | null;
          expected_date?: string | null;
          order_code?: string;
          created_at?: string;
          updated_at?: string;
          staff_jobs?: Json;
        };
        Relationships: [];
      };
      garment_types: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          label: string;
          gender: string;
          fields: Json;
          sort_order: number;
          created_at: string;
          staff_rates?: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          label: string;
          gender: string;
          fields?: Json;
          sort_order?: number;
          created_at?: string;
          staff_rates?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          label?: string;
          gender?: string;
          fields?: Json;
          sort_order?: number;
          created_at?: string;
          staff_rates?: Json;
        };
        Relationships: [];
      };
      staff_types: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          label: string;
          is_system: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          label: string;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          label?: string;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      staff_type: 'cutter' | 'tailor';
      cloth_status: 'cutting' | 'ready_to_sew' | 'sewing' | 'completed';
    };
    CompositeTypes: Record<string, never>;
  };
}
