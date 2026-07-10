// Auto-generated Supabase database types
// These match the schema in supabase/schema.sql
// After connecting to Supabase, you can regenerate with:
//   npx supabase gen types typescript --project-id <your-project-id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          email: string;
          department: string;
          role: 'admin' | 'employee';
          status: 'Active' | 'Inactive';
          avatar: string;
          phone: string;
          cases_completed: number;
          cases_active: number;
          join_date: string;
          auth_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      hospitals: {
        Row: {
          id: string;
          name: string;
          branch: string;
          address: string;
          city: string;
          contact_person: string;
          phone: string;
          email: string;
          status: 'Active' | 'Inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['hospitals']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['hospitals']['Insert']>;
      };
      doctors: {
        Row: {
          id: string;
          name: string;
          specialization: string;
          hospital_id: string | null;
          phone: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['doctors']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['doctors']['Insert']>;
      };
      departments: {
        Row: {
          id: string;
          name: string;
          description: string;
          color: string;
        };
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
      };
      surgical_kits: {
        Row: {
          id: string;
          name: string;
          type: string;
          serial_number: string;
          status: 'Available' | 'Assigned' | 'In Surgery' | 'Cleaning' | 'Audit' | 'Completed';
          last_used_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['surgical_kits']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['surgical_kits']['Insert']>;
      };
      cases: {
        Row: {
          id: string;
          case_number: string;
          hospital_id: string;
          doctor_id: string | null;
          hospital_snapshot: Json;
          doctor_snapshot: Json;
          surgery_date: string | null;
          implant_required: string;
          implant_type: string;
          priority: 'Critical' | 'High' | 'Medium' | 'Low';
          status: string;
          current_stage: string;
          current_department: string | null;
          assigned_employee_id: string | null;
          assigned_employee_snapshot: Json | null;
          created_by: string;
          due_date: string | null;
          remarks: string;
          stages: Json;
          activity_logs: Json;
          comments: Json;
          invoice_amount: number | null;
          collected_amount: number | null;
          payment_status: 'Pending' | 'Partial' | 'Collected' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cases']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['cases']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          is_read: boolean;
          case_id: string | null;
          recipient_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      approvals: {
        Row: {
          id: string;
          case_id: string;
          case_number: string;
          stage: string;
          submitted_by: string;
          submitted_at: string;
          approved_at: string | null;
          status: 'Pending' | 'Approved' | 'Rejected' | 'Changes Requested';
          notes: string | null;
          admin_notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['approvals']['Row'], 'id' | 'submitted_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['approvals']['Insert']>;
      };
      activity_log: {
        Row: {
          id: string;
          action: string;
          entity_type: 'case' | 'employee' | 'hospital' | 'department' | 'kit' | 'system';
          entity_id: string;
          entity_label: string;
          performed_by: string;
          performed_by_role: 'admin' | 'employee';
          details: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>;
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_employee_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}
