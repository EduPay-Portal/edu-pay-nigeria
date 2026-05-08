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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          access_level: number | null
          created_at: string | null
          department: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level?: number | null
          created_at?: string | null
          department?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: number | null
          created_at?: string | null
          department?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      parent_profiles: {
        Row: {
          created_at: string | null
          created_from_import: boolean | null
          emergency_contact: string | null
          id: string
          notification_preference:
            | Database["public"]["Enums"]["notification_preference"]
            | null
          occupation: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_from_import?: boolean | null
          emergency_contact?: string | null
          id?: string
          notification_preference?:
            | Database["public"]["Enums"]["notification_preference"]
            | null
          occupation?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_from_import?: boolean | null
          emergency_contact?: string | null
          id?: string
          notification_preference?:
            | Database["public"]["Enums"]["notification_preference"]
            | null
          occupation?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      paystack_webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          paystack_reference: string
          processed: boolean | null
          processed_at: string | null
          signature_valid: boolean
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          paystack_reference: string
          processed?: boolean | null
          processed_at?: string | null
          signature_valid: boolean
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          paystack_reference?: string
          processed?: boolean | null
          processed_at?: string | null
          signature_valid?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reconciliation_logs: {
        Row: {
          created_at: string
          expected_amount: number | null
          id: string
          match_type: string
          notes: string | null
          received_amount: number | null
          resolved_at: string | null
          resolved_by: string | null
          student_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          expected_amount?: number | null
          id?: string
          match_type: string
          notes?: string | null
          received_amount?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          student_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          expected_amount?: number | null
          id?: string
          match_type?: string
          notes?: string | null
          received_amount?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          student_id?: string | null
          transaction_id?: string | null
        }
        Relationships: []
      }
      settlements: {
        Row: {
          bank_reference: string | null
          created_at: string
          fees: number
          gross_amount: number
          id: string
          metadata: Json | null
          net_amount: number
          provider: string
          settlement_date: string
          status: string
          transaction_count: number
          updated_at: string
        }
        Insert: {
          bank_reference?: string | null
          created_at?: string
          fees?: number
          gross_amount?: number
          id?: string
          metadata?: Json | null
          net_amount?: number
          provider: string
          settlement_date: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          bank_reference?: string | null
          created_at?: string
          fees?: number
          gross_amount?: number
          id?: string
          metadata?: Json | null
          net_amount?: number
          provider?: string
          settlement_date?: string
          status?: string
          transaction_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          admission_number: string
          boarding_status: string | null
          class_level: string
          created_at: string | null
          created_from_import: boolean | null
          debt: number | null
          debt_balance: number | null
          id: string
          import_batch_id: string | null
          import_notes: string | null
          is_boarder: boolean | null
          is_member: boolean | null
          membership_status: string | null
          parent_id: string | null
          registration_number: string | null
          school_fees: number | null
          section: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admission_number: string
          boarding_status?: string | null
          class_level: string
          created_at?: string | null
          created_from_import?: boolean | null
          debt?: number | null
          debt_balance?: number | null
          id?: string
          import_batch_id?: string | null
          import_notes?: string | null
          is_boarder?: boolean | null
          is_member?: boolean | null
          membership_status?: string | null
          parent_id?: string | null
          registration_number?: string | null
          school_fees?: number | null
          section?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admission_number?: string
          boarding_status?: string | null
          class_level?: string
          created_at?: string | null
          created_from_import?: boolean | null
          debt?: number | null
          debt_balance?: number | null
          id?: string
          import_batch_id?: string | null
          import_notes?: string | null
          is_boarder?: boolean | null
          is_member?: boolean | null
          membership_status?: string | null
          parent_id?: string | null
          registration_number?: string | null
          school_fees?: number | null
          section?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      students_import_staging: {
        Row: {
          CLASS: string | null
          created_at: string | null
          "DAY/BOARDER": string | null
          DEBTS: string | null
          error_message: string | null
          id: string
          "MEMBER/NMEMBER": string | null
          NAMES: string | null
          parent_email: string | null
          parent_id: string | null
          processed: boolean | null
          "REG NO": string | null
          "SCHOOL FEES": string | null
          SN: string | null
          student_id: string | null
          SURNAME: string | null
        }
        Insert: {
          CLASS?: string | null
          created_at?: string | null
          "DAY/BOARDER"?: string | null
          DEBTS?: string | null
          error_message?: string | null
          id?: string
          "MEMBER/NMEMBER"?: string | null
          NAMES?: string | null
          parent_email?: string | null
          parent_id?: string | null
          processed?: boolean | null
          "REG NO"?: string | null
          "SCHOOL FEES"?: string | null
          SN?: string | null
          student_id?: string | null
          SURNAME?: string | null
        }
        Update: {
          CLASS?: string | null
          created_at?: string | null
          "DAY/BOARDER"?: string | null
          DEBTS?: string | null
          error_message?: string | null
          id?: string
          "MEMBER/NMEMBER"?: string | null
          NAMES?: string | null
          parent_email?: string | null
          parent_id?: string | null
          processed?: boolean | null
          "REG NO"?: string | null
          "SCHOOL FEES"?: string | null
          SN?: string | null
          student_id?: string | null
          SURNAME?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["transaction_category"]
          created_at: string | null
          description: string | null
          id: string
          idempotency_key: string | null
          match_status: string | null
          metadata: Json | null
          payer_account_name: string | null
          payer_account_number: string | null
          payer_bank: string | null
          payment_channel: string | null
          payment_method: string | null
          paystack_reference: string | null
          provider: string | null
          provider_reference: string | null
          reference: string
          settlement_id: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
          webhook_data: Json | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["transaction_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          match_status?: string | null
          metadata?: Json | null
          payer_account_name?: string | null
          payer_account_number?: string | null
          payer_bank?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          paystack_reference?: string | null
          provider?: string | null
          provider_reference?: string | null
          reference: string
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
          webhook_data?: Json | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["transaction_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          match_status?: string | null
          metadata?: Json | null
          payer_account_name?: string | null
          payer_account_number?: string | null
          payer_bank?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          paystack_reference?: string | null
          provider?: string | null
          provider_reference?: string | null
          reference?: string
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_accounts: {
        Row: {
          account_name: string
          account_number: string
          assigned_at: string | null
          bank_code: string
          bank_name: string
          created_at: string | null
          environment: string
          id: string
          is_active: boolean | null
          last_payment_at: string | null
          metadata: Json | null
          paystack_customer_code: string | null
          provider: string | null
          provider_account_id: string | null
          provider_customer_id: string | null
          status: string
          student_id: string
          total_received: number | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          assigned_at?: string | null
          bank_code: string
          bank_name: string
          created_at?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          last_payment_at?: string | null
          metadata?: Json | null
          paystack_customer_code?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_customer_id?: string | null
          status?: string
          student_id: string
          total_received?: number | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          assigned_at?: string | null
          bank_code?: string
          bank_name?: string
          created_at?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          last_payment_at?: string | null
          metadata?: Json | null
          paystack_customer_code?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_customer_id?: string | null
          status?: string
          student_id?: string
          total_received?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          ip_address: unknown
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
          provider_reference: string | null
          retry_count: number
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_reference?: string | null
          retry_count?: number
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_reference?: string | null
          retry_count?: number
          signature_valid?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_transaction_reference: { Args: never; Returns: string }
      get_duplicate_transactions: {
        Args: never
        Returns: {
          count: number
          paystack_reference: string
          total_amount: number
          transactions: Json
        }[]
      }
      get_import_staging_stats: {
        Args: never
        Returns: {
          error_records: number
          pending_records: number
          processed_records: number
          total_records: number
          unique_batches: number
        }[]
      }
      get_orphaned_transactions: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          id: string
          paystack_reference: string
          reference: string
          status: string
          user_id: string
        }[]
      }
      get_reconciliation_summary: {
        Args: never
        Returns: {
          count: number
          metric: string
          total_amount: number
        }[]
      }
      get_unmatched_webhooks: {
        Args: never
        Returns: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          paystack_reference: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_staging_processed: {
        Args: {
          error_msg?: string
          p_uuid?: string
          s_uuid: string
          staging_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "parent" | "admin"
      notification_preference: "sms" | "email" | "both"
      transaction_category:
        | "fee_payment"
        | "wallet_topup"
        | "canteen"
        | "books"
        | "transport"
        | "other"
      transaction_status: "pending" | "completed" | "failed" | "reversed"
      transaction_type: "credit" | "debit"
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
      app_role: ["student", "parent", "admin"],
      notification_preference: ["sms", "email", "both"],
      transaction_category: [
        "fee_payment",
        "wallet_topup",
        "canteen",
        "books",
        "transport",
        "other",
      ],
      transaction_status: ["pending", "completed", "failed", "reversed"],
      transaction_type: ["credit", "debit"],
    },
  },
} as const
