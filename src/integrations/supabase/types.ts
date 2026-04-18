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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      booking_agent_config: {
        Row: {
          color: string
          created_at: string
          enabled: boolean
          followup_values: string
          id: string
          last_contact_col: string
          link_col: string
          name_col: string
          next_followup_col: string
          notes_col: string
          reachout_values: string
          sheet_id: string
          sheet_url: string
          status_col: string
          tab_gid: string
          type_col: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          enabled?: boolean
          followup_values?: string
          id?: string
          last_contact_col?: string
          link_col?: string
          name_col?: string
          next_followup_col?: string
          notes_col?: string
          reachout_values?: string
          sheet_id?: string
          sheet_url?: string
          status_col?: string
          tab_gid?: string
          type_col?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          enabled?: boolean
          followup_values?: string
          id?: string
          last_contact_col?: string
          link_col?: string
          name_col?: string
          next_followup_col?: string
          notes_col?: string
          reachout_values?: string
          sheet_id?: string
          sheet_url?: string
          status_col?: string
          tab_gid?: string
          type_col?: string
          updated_at?: string
        }
        Relationships: []
      }
      claude_log: {
        Row: {
          context: string
          created_at: string
          id: string
          machine: string
          next_steps: string
          summary: string
          tags: string[]
          timestamp: string
        }
        Insert: {
          context?: string
          created_at?: string
          id?: string
          machine?: string
          next_steps?: string
          summary: string
          tags?: string[]
          timestamp?: string
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          machine?: string
          next_steps?: string
          summary?: string
          tags?: string[]
          timestamp?: string
        }
        Relationships: []
      }
      djep_events_cache: {
        Row: {
          cache_key: string
          created_at: string
          events: Json
          expires_at: string
          id: string
          raw: Json | null
          refreshed_at: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          events?: Json
          expires_at: string
          id?: string
          raw?: Json | null
          refreshed_at?: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          events?: Json
          expires_at?: string
          id?: string
          raw?: Json | null
          refreshed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          account_email: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monday_calendar_sources: {
        Row: {
          board_id: string
          color: string
          created_at: string
          date_column_id: string
          enabled: boolean
          fallback_date_column_ids: string
          id: string
          label: string
          person_column_id: string | null
          person_id: string | null
          skip_groups: string
          updated_at: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          date_column_id: string
          enabled?: boolean
          fallback_date_column_ids?: string
          id?: string
          label: string
          person_column_id?: string | null
          person_id?: string | null
          skip_groups?: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          date_column_id?: string
          enabled?: boolean
          fallback_date_column_ids?: string
          id?: string
          label?: string
          person_column_id?: string | null
          person_id?: string | null
          skip_groups?: string
          updated_at?: string
        }
        Relationships: []
      }
      posting_times_cache: {
        Row: {
          change_note: string
          created_at: string
          heatmap: Json
          id: string
          platform: string
          refreshed_at: string
          sources: string[]
          top_windows: Json
          updated_at: string
        }
        Insert: {
          change_note?: string
          created_at?: string
          heatmap?: Json
          id?: string
          platform: string
          refreshed_at?: string
          sources?: string[]
          top_windows?: Json
          updated_at?: string
        }
        Update: {
          change_note?: string
          created_at?: string
          heatmap?: Json
          id?: string
          platform?: string
          refreshed_at?: string
          sources?: string[]
          top_windows?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rehearsal_responses: {
        Row: {
          created_at: string
          id: string
          option_id: string
          player_name: string
          rehearsal_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          player_name: string
          rehearsal_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          player_name?: string
          rehearsal_id?: string
          status?: string
        }
        Relationships: []
      }
      social_brands: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          platforms: string[]
          slug: string
          sort_order: number
          updated_at: string
          voice_notes: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          platforms?: string[]
          slug: string
          sort_order?: number
          updated_at?: string
          voice_notes?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          platforms?: string[]
          slug?: string
          sort_order?: number
          updated_at?: string
          voice_notes?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          asset_urls: string[]
          brand_id: string
          captions: Json
          created_at: string
          id: string
          notes: string
          platform_status: Json
          posted_at: string | null
          scheduled_for: string | null
          sort_order: number
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          asset_urls?: string[]
          brand_id: string
          captions?: Json
          created_at?: string
          id?: string
          notes?: string
          platform_status?: Json
          posted_at?: string | null
          scheduled_for?: string | null
          sort_order?: number
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          asset_urls?: string[]
          brand_id?: string
          captions?: Json
          created_at?: string
          id?: string
          notes?: string
          platform_status?: Json
          posted_at?: string | null
          scheduled_for?: string | null
          sort_order?: number
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "social_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "social_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      social_sources: {
        Row: {
          active: boolean
          brand_id: string
          cadence: string | null
          created_at: string
          day_of_week: number | null
          description: string
          event_date: string | null
          id: string
          kind: string
          last_generated_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_id: string
          cadence?: string | null
          created_at?: string
          day_of_week?: number | null
          description?: string
          event_date?: string | null
          id?: string
          kind: string
          last_generated_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string
          cadence?: string | null
          created_at?: string
          day_of_week?: number | null
          description?: string
          event_date?: string | null
          id?: string
          kind?: string
          last_generated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_sources_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "social_brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
