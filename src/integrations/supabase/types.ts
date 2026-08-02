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
      act_epk_assets: {
        Row: {
          act_id: string
          asset_id: string
          asset_source: string
          created_at: string
          id: string
          role: string | null
          sort_order: number
        }
        Insert: {
          act_id: string
          asset_id: string
          asset_source: string
          created_at?: string
          id?: string
          role?: string | null
          sort_order?: number
        }
        Update: {
          act_id?: string
          asset_id?: string
          asset_source?: string
          created_at?: string
          id?: string
          role?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "act_epk_assets_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "acts"
            referencedColumns: ["id"]
          },
        ]
      }
      acts: {
        Row: {
          bio_long: string | null
          bio_short: string | null
          booking_email: string | null
          booking_phone: string | null
          commission_pct: number | null
          created_at: string
          epk_is_public: boolean
          id: string
          kind: string
          legacy_venture_tags: string[]
          listen_smart_link_slug: string | null
          name: string
          notes: string | null
          one_liner: string | null
          slug: string
          socials: Json
          sort_order: number
          status: string
          updated_at: string
          voice_locked: boolean
          website_url: string | null
        }
        Insert: {
          bio_long?: string | null
          bio_short?: string | null
          booking_email?: string | null
          booking_phone?: string | null
          commission_pct?: number | null
          created_at?: string
          epk_is_public?: boolean
          id?: string
          kind?: string
          legacy_venture_tags?: string[]
          listen_smart_link_slug?: string | null
          name: string
          notes?: string | null
          one_liner?: string | null
          slug: string
          socials?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          voice_locked?: boolean
          website_url?: string | null
        }
        Update: {
          bio_long?: string | null
          bio_short?: string | null
          booking_email?: string | null
          booking_phone?: string | null
          commission_pct?: number | null
          created_at?: string
          epk_is_public?: boolean
          id?: string
          kind?: string
          legacy_venture_tags?: string[]
          listen_smart_link_slug?: string | null
          name?: string
          notes?: string | null
          one_liner?: string | null
          slug?: string
          socials?: Json
          sort_order?: number
          status?: string
          updated_at?: string
          voice_locked?: boolean
          website_url?: string | null
        }
        Relationships: []
      }
      agent_jobs: {
        Row: {
          agent_id: string
          blocked_reason: string | null
          created_at: string
          created_by: string
          finished_at: string | null
          id: string
          instruction: string
          result_md: string | null
          source_ref: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          blocked_reason?: string | null
          created_at?: string
          created_by?: string
          finished_at?: string | null
          id?: string
          instruction: string
          result_md?: string | null
          source_ref?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          blocked_reason?: string | null
          created_at?: string
          created_by?: string
          finished_at?: string | null
          id?: string
          instruction?: string
          result_md?: string | null
          source_ref?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_teammates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          agent_id: string
          body: string
          created_at: string
          id: string
          job_id: string | null
          kind: string
          role: string
          ticket_ref: string | null
        }
        Insert: {
          agent_id: string
          body: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          role: string
          ticket_ref?: string | null
        }
        Update: {
          agent_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          role?: string
          ticket_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_teammates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_teammates: {
        Row: {
          charter_ref: string | null
          color: string
          created_at: string
          current_action: string | null
          emoji: string
          field: string
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
          system_prompt: string
          tagline: string
          updated_at: string
        }
        Insert: {
          charter_ref?: string | null
          color?: string
          created_at?: string
          current_action?: string | null
          emoji?: string
          field: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          system_prompt: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          charter_ref?: string | null
          color?: string
          created_at?: string
          current_action?: string | null
          emoji?: string
          field?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          system_prompt?: string
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_event_hashes: {
        Row: {
          content_hash: string
          file_size_bytes: number | null
          hash_algorithm: string
          hashed_at: string
          hashed_by: string | null
          source: string
          source_id: string
        }
        Insert: {
          content_hash: string
          file_size_bytes?: number | null
          hash_algorithm?: string
          hashed_at?: string
          hashed_by?: string | null
          source: string
          source_id: string
        }
        Update: {
          content_hash?: string
          file_size_bytes?: number | null
          hash_algorithm?: string
          hashed_at?: string
          hashed_by?: string | null
          source?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_event_hashes_source_source_id_fkey"
            columns: ["source", "source_id"]
            isOneToOne: true
            referencedRelation: "archive_events"
            referencedColumns: ["source", "source_id"]
          },
        ]
      }
      archive_event_tags: {
        Row: {
          confidence: number
          created_at: string
          event_id: string
          inferred_by: string
          tag_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          event_id: string
          inferred_by?: string
          tag_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_id?: string
          inferred_by?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_event_tags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "archive_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_event_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "archive_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_events: {
        Row: {
          created_at: string
          id: string
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          occurred_at: string
          occurred_end: string | null
          raw_metadata: Json
          source: string
          source_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          occurred_at: string
          occurred_end?: string | null
          raw_metadata?: Json
          source: string
          source_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          occurred_at?: string
          occurred_end?: string | null
          raw_metadata?: Json
          source?: string
          source_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      archive_tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      availability_cache: {
        Row: {
          created_at: string
          date: string
          expires_at: string
          id: string
          refreshed_at: string
          report: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          expires_at: string
          id?: string
          refreshed_at?: string
          report?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          expires_at?: string
          id?: string
          refreshed_at?: string
          report?: Json
          updated_at?: string
        }
        Relationships: []
      }
      band_members: {
        Row: {
          active: boolean
          bio_short: string | null
          created_at: string
          headshot_url: string | null
          id: string
          instagram_handle: string | null
          name: string
          reference_image_path: string | null
          role: string
          tier: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio_short?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          instagram_handle?: string | null
          name: string
          reference_image_path?: string | null
          role: string
          tier?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio_short?: string | null
          created_at?: string
          headshot_url?: string | null
          id?: string
          instagram_handle?: string | null
          name?: string
          reference_image_path?: string | null
          role?: string
          tier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
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
          venue_tab_gid: string
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
          venue_tab_gid?: string
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
          venue_tab_gid?: string
        }
        Relationships: []
      }
      booking_pipeline_buckets: {
        Row: {
          bucket: string
          row_index: number
          sheet_id: string
          updated_at: string
        }
        Insert: {
          bucket: string
          row_index: number
          sheet_id: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          row_index?: number
          sheet_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_collaborators: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          engagement_status: string
          found_via: string | null
          id: string
          name: string
          notes: string | null
          rate_note: string | null
          roles: string[]
          skill_level: string | null
          updated_at: string
          ventures: string[]
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          engagement_status?: string
          found_via?: string | null
          id?: string
          name: string
          notes?: string | null
          rate_note?: string | null
          roles?: string[]
          skill_level?: string | null
          updated_at?: string
          ventures?: string[]
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          engagement_status?: string
          found_via?: string | null
          id?: string
          name?: string
          notes?: string | null
          rate_note?: string | null
          roles?: string[]
          skill_level?: string | null
          updated_at?: string
          ventures?: string[]
        }
        Relationships: []
      }
      brand_releases: {
        Row: {
          blockers: string | null
          collaborator_ids: string[] | null
          created_at: string
          id: string
          kind: string
          notes: string | null
          release_date: string | null
          status: string
          title: string
          updated_at: string
          venture: string
        }
        Insert: {
          blockers?: string | null
          collaborator_ids?: string[] | null
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          release_date?: string | null
          status?: string
          title: string
          updated_at?: string
          venture: string
        }
        Update: {
          blockers?: string | null
          collaborator_ids?: string[] | null
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          release_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          venture?: string
        }
        Relationships: []
      }
      canonical_events: {
        Row: {
          attire: string | null
          client: Json
          contact: Json
          created_at: string
          end_date: string | null
          ensemble: string | null
          event_date: string
          event_type: string | null
          extracted_at: string
          extractor_version: string | null
          guests: Json
          id: string
          last_rendered_at: string | null
          last_rendered_outputs: string[] | null
          logistics: Json
          name: string
          normalized_name: string | null
          organization: string | null
          personnel: Json
          preferences: Json
          song_sections: Json
          source_files: Json
          timeline: Json
          updated_at: string
          vendors: Json
          venue: Json
          venue_name: string | null
        }
        Insert: {
          attire?: string | null
          client?: Json
          contact?: Json
          created_at?: string
          end_date?: string | null
          ensemble?: string | null
          event_date: string
          event_type?: string | null
          extracted_at?: string
          extractor_version?: string | null
          guests?: Json
          id?: string
          last_rendered_at?: string | null
          last_rendered_outputs?: string[] | null
          logistics?: Json
          name: string
          normalized_name?: string | null
          organization?: string | null
          personnel?: Json
          preferences?: Json
          song_sections?: Json
          source_files?: Json
          timeline?: Json
          updated_at?: string
          vendors?: Json
          venue?: Json
          venue_name?: string | null
        }
        Update: {
          attire?: string | null
          client?: Json
          contact?: Json
          created_at?: string
          end_date?: string | null
          ensemble?: string | null
          event_date?: string
          event_type?: string | null
          extracted_at?: string
          extractor_version?: string | null
          guests?: Json
          id?: string
          last_rendered_at?: string | null
          last_rendered_outputs?: string[] | null
          logistics?: Json
          name?: string
          normalized_name?: string | null
          organization?: string | null
          personnel?: Json
          preferences?: Json
          song_sections?: Json
          source_files?: Json
          timeline?: Json
          updated_at?: string
          vendors?: Json
          venue?: Json
          venue_name?: string | null
        }
        Relationships: []
      }
      chart_index: {
        Row: {
          composer: string | null
          created_at: string
          difficulty: string | null
          drive_account_email: string | null
          drive_id: string | null
          drive_uploaded_at: string | null
          drive_web_view_link: string | null
          duration: string | null
          file_size: number | null
          filename: string
          folder_path: string
          genre: string | null
          id: string
          ireal_pro: string[]
          key_signature: string | null
          keywords: string | null
          last_synced_at: string
          metadata_csv_row: Json | null
          rating: string | null
          reference: string | null
          search_tsv: unknown
          setlists: string[]
          sha256: string | null
          sheet_type: string | null
          storage_path: string | null
          tags: string[]
          time_signature: string | null
          title: string
          title_search: string | null
          updated_at: string
        }
        Insert: {
          composer?: string | null
          created_at?: string
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename: string
          folder_path: string
          genre?: string | null
          id?: string
          ireal_pro?: string[]
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[]
          sha256?: string | null
          sheet_type?: string | null
          storage_path?: string | null
          tags?: string[]
          time_signature?: string | null
          title: string
          title_search?: string | null
          updated_at?: string
        }
        Update: {
          composer?: string | null
          created_at?: string
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename?: string
          folder_path?: string
          genre?: string | null
          id?: string
          ireal_pro?: string[]
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[]
          sha256?: string | null
          sheet_type?: string | null
          storage_path?: string | null
          tags?: string[]
          time_signature?: string | null
          title?: string
          title_search?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chart_index_backup_20260705: {
        Row: {
          composer: string | null
          created_at: string | null
          difficulty: string | null
          drive_account_email: string | null
          drive_id: string | null
          drive_uploaded_at: string | null
          drive_web_view_link: string | null
          duration: string | null
          file_size: number | null
          filename: string | null
          folder_path: string | null
          genre: string | null
          id: string | null
          ireal_pro: string[] | null
          key_signature: string | null
          keywords: string | null
          last_synced_at: string | null
          metadata_csv_row: Json | null
          rating: string | null
          reference: string | null
          search_tsv: unknown
          setlists: string[] | null
          sha256: string | null
          storage_path: string | null
          tags: string[] | null
          time_signature: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          composer?: string | null
          created_at?: string | null
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename?: string | null
          folder_path?: string | null
          genre?: string | null
          id?: string | null
          ireal_pro?: string[] | null
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string | null
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[] | null
          sha256?: string | null
          storage_path?: string | null
          tags?: string[] | null
          time_signature?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          composer?: string | null
          created_at?: string | null
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename?: string | null
          folder_path?: string | null
          genre?: string | null
          id?: string | null
          ireal_pro?: string[] | null
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string | null
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[] | null
          sha256?: string | null
          storage_path?: string | null
          tags?: string[] | null
          time_signature?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chart_index_quarantine: {
        Row: {
          composer: string | null
          created_at: string
          difficulty: string | null
          drive_account_email: string | null
          drive_id: string | null
          drive_uploaded_at: string | null
          drive_web_view_link: string | null
          duration: string | null
          file_size: number | null
          filename: string
          folder_path: string
          genre: string | null
          id: string
          ireal_pro: string[]
          key_signature: string | null
          keywords: string | null
          last_synced_at: string
          metadata_csv_row: Json | null
          rating: string | null
          reference: string | null
          search_tsv: unknown
          setlists: string[]
          sha256: string | null
          storage_path: string | null
          tags: string[]
          time_signature: string | null
          title: string
          updated_at: string
        }
        Insert: {
          composer?: string | null
          created_at?: string
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename: string
          folder_path: string
          genre?: string | null
          id?: string
          ireal_pro?: string[]
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[]
          sha256?: string | null
          storage_path?: string | null
          tags?: string[]
          time_signature?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          composer?: string | null
          created_at?: string
          difficulty?: string | null
          drive_account_email?: string | null
          drive_id?: string | null
          drive_uploaded_at?: string | null
          drive_web_view_link?: string | null
          duration?: string | null
          file_size?: number | null
          filename?: string
          folder_path?: string
          genre?: string | null
          id?: string
          ireal_pro?: string[]
          key_signature?: string | null
          keywords?: string | null
          last_synced_at?: string
          metadata_csv_row?: Json | null
          rating?: string | null
          reference?: string | null
          search_tsv?: unknown
          setlists?: string[]
          sha256?: string | null
          storage_path?: string | null
          tags?: string[]
          time_signature?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      claude_action_queue: {
        Row: {
          agent_id: string | null
          card_desc: string | null
          card_name: string
          card_url: string
          completed_at: string | null
          created_at: string
          id: string
          list_name: string
          picked_up_at: string | null
          picked_up_by: string | null
          result_artifact: string | null
          status: string
          status_notes: string | null
          trello_card_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          card_desc?: string | null
          card_name: string
          card_url: string
          completed_at?: string | null
          created_at?: string
          id?: string
          list_name: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          result_artifact?: string | null
          status?: string
          status_notes?: string | null
          trello_card_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          card_desc?: string | null
          card_name?: string
          card_url?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          list_name?: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          result_artifact?: string | null
          status?: string
          status_notes?: string | null
          trello_card_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claude_action_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_teammates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claude_action_queue_trello_card_id_fkey"
            columns: ["trello_card_id"]
            isOneToOne: true
            referencedRelation: "trello_card_routes"
            referencedColumns: ["trello_card_id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          followup: boolean
          followup_note: string | null
          id: string
          name: string
          notes: string | null
          org: string | null
          phone: string | null
          role: string | null
          sheet_synced: boolean
          source: string
          tags: string[] | null
          trello_card_id: string | null
          updated_at: string
          venture: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          followup?: boolean
          followup_note?: string | null
          id?: string
          name: string
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean
          source?: string
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string
          venture?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          followup?: boolean
          followup_note?: string | null
          id?: string
          name?: string
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean
          source?: string
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string
          venture?: string | null
        }
        Relationships: []
      }
      contacts_backup_20260728: {
        Row: {
          created_at: string | null
          email: string | null
          followup: boolean | null
          followup_note: string | null
          id: string | null
          name: string | null
          notes: string | null
          org: string | null
          phone: string | null
          role: string | null
          sheet_synced: boolean | null
          source: string | null
          tags: string[] | null
          trello_card_id: string | null
          updated_at: string | null
          venture: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      contacts_backup_20260728_lanes: {
        Row: {
          created_at: string | null
          email: string | null
          followup: boolean | null
          followup_note: string | null
          id: string | null
          name: string | null
          notes: string | null
          org: string | null
          phone: string | null
          role: string | null
          sheet_synced: boolean | null
          source: string | null
          tags: string[] | null
          trello_card_id: string | null
          updated_at: string | null
          venture: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      contacts_echo_purge_20260801: {
        Row: {
          created_at: string | null
          email: string | null
          followup: boolean | null
          followup_note: string | null
          id: string | null
          name: string | null
          notes: string | null
          org: string | null
          phone: string | null
          role: string | null
          sheet_synced: boolean | null
          source: string | null
          tags: string[] | null
          trello_card_id: string | null
          updated_at: string | null
          venture: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          followup?: boolean | null
          followup_note?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          org?: string | null
          phone?: string | null
          role?: string | null
          sheet_synced?: boolean | null
          source?: string | null
          tags?: string[] | null
          trello_card_id?: string | null
          updated_at?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      contacts_merge_log: {
        Row: {
          id: string
          loser_id: string
          loser_row: Json
          merged_at: string
          reason: string
          survivor_id: string
        }
        Insert: {
          id?: string
          loser_id: string
          loser_row: Json
          merged_at?: string
          reason: string
          survivor_id: string
        }
        Update: {
          id?: string
          loser_id?: string
          loser_row?: Json
          merged_at?: string
          reason?: string
          survivor_id?: string
        }
        Relationships: []
      }
      content_ingest_log: {
        Row: {
          action: string | null
          application: string | null
          caption: string | null
          collection_name: string | null
          confidence: number | null
          deadline: string | null
          deadline_raw: string | null
          duration_sec: number | null
          id: string
          ingested_at: string
          platform: string
          process_insight: string | null
          processed_at: string | null
          purpose: string | null
          realms: string[] | null
          recurring: boolean | null
          route: string | null
          routed_ref: string | null
          shortcode: string
          source_account: string | null
          status: string
          summary: string | null
          tags: string[]
          time_sensitivity: string | null
          transcript: string | null
          uploader: string | null
          url: string
          venture: string | null
        }
        Insert: {
          action?: string | null
          application?: string | null
          caption?: string | null
          collection_name?: string | null
          confidence?: number | null
          deadline?: string | null
          deadline_raw?: string | null
          duration_sec?: number | null
          id?: string
          ingested_at?: string
          platform?: string
          process_insight?: string | null
          processed_at?: string | null
          purpose?: string | null
          realms?: string[] | null
          recurring?: boolean | null
          route?: string | null
          routed_ref?: string | null
          shortcode: string
          source_account?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          time_sensitivity?: string | null
          transcript?: string | null
          uploader?: string | null
          url: string
          venture?: string | null
        }
        Update: {
          action?: string | null
          application?: string | null
          caption?: string | null
          collection_name?: string | null
          confidence?: number | null
          deadline?: string | null
          deadline_raw?: string | null
          duration_sec?: number | null
          id?: string
          ingested_at?: string
          platform?: string
          process_insight?: string | null
          processed_at?: string | null
          purpose?: string | null
          realms?: string[] | null
          recurring?: boolean | null
          route?: string | null
          routed_ref?: string | null
          shortcode?: string
          source_account?: string | null
          status?: string
          summary?: string | null
          tags?: string[]
          time_sensitivity?: string | null
          transcript?: string | null
          uploader?: string | null
          url?: string
          venture?: string | null
        }
        Relationships: []
      }
      content_smart_goals: {
        Row: {
          created_at: string
          definition_of_done: string | null
          earliest_deadline: string | null
          id: string
          measure: string | null
          member_count: number | null
          member_shortcodes: string[]
          priority: number | null
          rationale: string | null
          status: string
          suggested_due_date: string | null
          title: string
          trello_url: string | null
          urgency: string | null
          venture: string | null
        }
        Insert: {
          created_at?: string
          definition_of_done?: string | null
          earliest_deadline?: string | null
          id?: string
          measure?: string | null
          member_count?: number | null
          member_shortcodes?: string[]
          priority?: number | null
          rationale?: string | null
          status?: string
          suggested_due_date?: string | null
          title: string
          trello_url?: string | null
          urgency?: string | null
          venture?: string | null
        }
        Update: {
          created_at?: string
          definition_of_done?: string | null
          earliest_deadline?: string | null
          id?: string
          measure?: string | null
          member_count?: number | null
          member_shortcodes?: string[]
          priority?: number | null
          rationale?: string | null
          status?: string
          suggested_due_date?: string | null
          title?: string
          trello_url?: string | null
          urgency?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      cron_secrets: {
        Row: {
          created_at: string
          description: string | null
          name: string
          secret: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          name: string
          secret: string
        }
        Update: {
          created_at?: string
          description?: string | null
          name?: string
          secret?: string
        }
        Relationships: []
      }
      curriculum_items: {
        Row: {
          course_code: string
          credits: number | null
          description: string | null
          id: string
          mentorship_note: string | null
          program: string
          readings: Json | null
          semester: number
          sort: number | null
          title: string
          variants: Json | null
          weeks: Json | null
        }
        Insert: {
          course_code: string
          credits?: number | null
          description?: string | null
          id?: string
          mentorship_note?: string | null
          program: string
          readings?: Json | null
          semester: number
          sort?: number | null
          title: string
          variants?: Json | null
          weeks?: Json | null
        }
        Update: {
          course_code?: string
          credits?: number | null
          description?: string | null
          id?: string
          mentorship_note?: string | null
          program?: string
          readings?: Json | null
          semester?: number
          sort?: number | null
          title?: string
          variants?: Json | null
          weeks?: Json | null
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          brief_date: string
          brief_md: string
          created_at: string
          id: string
          source: string
        }
        Insert: {
          brief_date: string
          brief_md: string
          created_at?: string
          id?: string
          source?: string
        }
        Update: {
          brief_date?: string
          brief_md?: string
          created_at?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      djep_events_cache: {
        Row: {
          cache_key: string
          created_at: string
          event_details: Json
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
          event_details?: Json
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
          event_details?: Json
          events?: Json
          expires_at?: string
          id?: string
          raw?: Json | null
          refreshed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      epk_components: {
        Row: {
          act_id: string
          component: string
          id: string
          link: string | null
          note: string | null
          sort_order: number
          source_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          act_id: string
          component: string
          id?: string
          link?: string | null
          note?: string | null
          sort_order?: number
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          act_id?: string
          component?: string
          id?: string
          link?: string | null
          note?: string | null
          sort_order?: number
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "epk_components_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "acts"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_broadcasts: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          failed: number
          id: string
          recipients: number
          segment: string
          sent: number
          status: string
          subject: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          recipients?: number
          segment: string
          sent?: number
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          recipients?: number
          segment?: string
          sent?: number
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      fan_signups: {
        Row: {
          consent: boolean
          consent_text: string | null
          contact_id: string | null
          contact_norm: string
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          referrer: string | null
          slug: string
          source: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          welcome_status: string | null
          welcomed_at: string | null
        }
        Insert: {
          consent?: boolean
          consent_text?: string | null
          contact_id?: string | null
          contact_norm: string
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          referrer?: string | null
          slug: string
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          welcome_status?: string | null
          welcomed_at?: string | null
        }
        Update: {
          consent?: boolean
          consent_text?: string | null
          contact_id?: string | null
          contact_norm?: string
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          referrer?: string | null
          slug?: string
          source?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          welcome_status?: string | null
          welcomed_at?: string | null
        }
        Relationships: []
      }
      feed_items: {
        Row: {
          blurb: string | null
          consumed: boolean
          created_at: string
          id: string
          kind: string
          link: string | null
          note: string | null
          source: string
          title: string
          trello_card_id: string | null
          updated_at: string
          url: string | null
          venture: string | null
        }
        Insert: {
          blurb?: string | null
          consumed?: boolean
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          note?: string | null
          source?: string
          title: string
          trello_card_id?: string | null
          updated_at?: string
          url?: string | null
          venture?: string | null
        }
        Update: {
          blurb?: string | null
          consumed?: boolean
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          note?: string | null
          source?: string
          title?: string
          trello_card_id?: string | null
          updated_at?: string
          url?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      finance_accounts: {
        Row: {
          active: boolean | null
          created_at: string | null
          drive_folder_id: string | null
          id: string
          institution: string | null
          kind: string | null
          last4: string | null
          name: string
          notes: string | null
          venture_default: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          institution?: string | null
          kind?: string | null
          last4?: string | null
          name: string
          notes?: string | null
          venture_default?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          drive_folder_id?: string | null
          id?: string
          institution?: string | null
          kind?: string | null
          last4?: string | null
          name?: string
          notes?: string | null
          venture_default?: string | null
        }
        Relationships: []
      }
      finance_statements: {
        Row: {
          account_id: string | null
          created_at: string | null
          drive_file_id: string | null
          file_name: string | null
          id: string
          ingest_status: string | null
          ingested_at: string | null
          period_date: string | null
          transaction_count: number | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          file_name?: string | null
          id?: string
          ingest_status?: string | null
          ingested_at?: string | null
          period_date?: string | null
          transaction_count?: number | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          drive_file_id?: string | null
          file_name?: string | null
          id?: string
          ingest_status?: string | null
          ingested_at?: string | null
          period_date?: string | null
          transaction_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_id: string | null
          amount: number | null
          category: string | null
          created_at: string | null
          description: string | null
          direction: string | null
          id: string
          merchant_normalized: string | null
          notes: string | null
          raw_description: string | null
          statement_id: string | null
          sub_category: string | null
          txn_date: string | null
          venture: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          merchant_normalized?: string | null
          notes?: string | null
          raw_description?: string | null
          statement_id?: string | null
          sub_category?: string | null
          txn_date?: string | null
          venture?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          merchant_normalized?: string | null
          notes?: string | null
          raw_description?: string | null
          statement_id?: string | null
          sub_category?: string | null
          txn_date?: string | null
          venture?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "finance_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_vendors: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          normalized_name: string | null
          notes: string | null
          raw_name: string | null
          recurring: boolean | null
          status: string | null
          sub_category: string | null
          venture: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          normalized_name?: string | null
          notes?: string | null
          raw_name?: string | null
          recurring?: boolean | null
          status?: string | null
          sub_category?: string | null
          venture?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          normalized_name?: string | null
          notes?: string | null
          raw_name?: string | null
          recurring?: boolean | null
          status?: string | null
          sub_category?: string | null
          venture?: string | null
        }
        Relationships: []
      }
      gmail_needs_action_cache: {
        Row: {
          account_email: string
          expires_at: string
          fetched_at: string
          id: string
          payload: Json
        }
        Insert: {
          account_email: string
          expires_at: string
          fetched_at?: string
          id?: string
          payload: Json
        }
        Update: {
          account_email?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          account_email: string | null
          created_at: string
          expires_at: string
          gmail_scope_granted: boolean
          id: string
          last_refresh_at: string | null
          last_refresh_error: string | null
          needs_reconnect: boolean
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          created_at?: string
          expires_at: string
          gmail_scope_granted?: boolean
          id?: string
          last_refresh_at?: string | null
          last_refresh_error?: string | null
          needs_reconnect?: boolean
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          created_at?: string
          expires_at?: string
          gmail_scope_granted?: boolean
          id?: string
          last_refresh_at?: string | null
          last_refresh_error?: string | null
          needs_reconnect?: boolean
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      grants: {
        Row: {
          act: string | null
          award_range: string | null
          brain_ref: string | null
          created_at: string
          deadline: string | null
          deadline_note: string | null
          fit: string | null
          id: string
          materials_status: string | null
          name: string
          notes: string | null
          sort_order: number
          status: string
          updated_at: string
          url: string | null
        }
        Insert: {
          act?: string | null
          award_range?: string | null
          brain_ref?: string | null
          created_at?: string
          deadline?: string | null
          deadline_note?: string | null
          fit?: string | null
          id?: string
          materials_status?: string | null
          name: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          act?: string | null
          award_range?: string | null
          brain_ref?: string | null
          created_at?: string
          deadline?: string | null
          deadline_note?: string | null
          fit?: string | null
          id?: string
          materials_status?: string | null
          name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      instrument_classifier_rules: {
        Row: {
          active: boolean
          classify_as: string | null
          created_at: string
          default_hours: number | null
          genre_hint: string | null
          id: string
          kind: string
          match_priority: number
          notes: string
          pattern: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          classify_as?: string | null
          created_at?: string
          default_hours?: number | null
          genre_hint?: string | null
          id?: string
          kind: string
          match_priority?: number
          notes?: string
          pattern: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          classify_as?: string | null
          created_at?: string
          default_hours?: number | null
          genre_hint?: string | null
          id?: string
          kind?: string
          match_priority?: number
          notes?: string
          pattern?: string
          updated_at?: string
        }
        Relationships: []
      }
      instrument_event_classifications: {
        Row: {
          block_hours: number
          classified_as: string
          confidence: string
          created_at: string
          estimated_hours: number
          estimation_source: string
          event_color_id: string | null
          event_description: string
          event_end: string
          event_start: string
          event_title: string
          gcal_account_email: string
          gcal_calendar_id: string
          gcal_event_id: string
          id: string
          last_resampled_at: string | null
          matched_rule_id: string | null
          matched_rule_pattern: string | null
          notes: string
          review_status: string
          reviewed_at: string | null
          updated_at: string
        }
        Insert: {
          block_hours: number
          classified_as: string
          confidence: string
          created_at?: string
          estimated_hours: number
          estimation_source?: string
          event_color_id?: string | null
          event_description?: string
          event_end: string
          event_start: string
          event_title: string
          gcal_account_email: string
          gcal_calendar_id: string
          gcal_event_id: string
          id?: string
          last_resampled_at?: string | null
          matched_rule_id?: string | null
          matched_rule_pattern?: string | null
          notes?: string
          review_status?: string
          reviewed_at?: string | null
          updated_at?: string
        }
        Update: {
          block_hours?: number
          classified_as?: string
          confidence?: string
          created_at?: string
          estimated_hours?: number
          estimation_source?: string
          event_color_id?: string | null
          event_description?: string
          event_end?: string
          event_start?: string
          event_title?: string
          gcal_account_email?: string
          gcal_calendar_id?: string
          gcal_event_id?: string
          id?: string
          last_resampled_at?: string | null
          matched_rule_id?: string | null
          matched_rule_pattern?: string | null
          notes?: string
          review_status?: string
          reviewed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_event_classifications_matched_rule_id_fkey"
            columns: ["matched_rule_id"]
            isOneToOne: false
            referencedRelation: "instrument_classifier_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health_history: {
        Row: {
          checked_at: string
          created_at: string
          detail: string | null
          id: string
          integration: string
          metric_value: string | null
          status: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          detail?: string | null
          id?: string
          integration: string
          metric_value?: string | null
          status: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          detail?: string | null
          id?: string
          integration?: string
          metric_value?: string | null
          status?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          budget: string | null
          created_at: string
          email: string | null
          event_date: string | null
          event_type: string | null
          first_seen: string | null
          genres: string | null
          gmail_thread_id: string | null
          guest_count: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          source: string
          status: string
          updated_at: string
          venture: string | null
          venue: string | null
        }
        Insert: {
          budget?: string | null
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          first_seen?: string | null
          genres?: string | null
          gmail_thread_id?: string | null
          guest_count?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          venture?: string | null
          venue?: string | null
        }
        Update: {
          budget?: string | null
          created_at?: string
          email?: string | null
          event_date?: string | null
          event_type?: string | null
          first_seen?: string | null
          genres?: string | null
          gmail_thread_id?: string | null
          guest_count?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          venture?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          ai_caption: string | null
          ai_tags: Json | null
          captured_on: string | null
          content_hash: string | null
          description: string | null
          duration_sec: number | null
          exif: Json | null
          ext: string | null
          file_mtime: string | null
          filename: string
          first_seen_at: string
          full_path: string
          height: number | null
          id: string
          location_kind: string | null
          media_type: string
          reachable_from: string | null
          rel_path: string | null
          size_bytes: number | null
          source_root: string
          status: string
          status_note: string | null
          suggested_output: string | null
          thumbnail_path: string | null
          updated_at: string
          venture: string | null
          venue: string | null
          width: number | null
        }
        Insert: {
          ai_caption?: string | null
          ai_tags?: Json | null
          captured_on?: string | null
          content_hash?: string | null
          description?: string | null
          duration_sec?: number | null
          exif?: Json | null
          ext?: string | null
          file_mtime?: string | null
          filename: string
          first_seen_at?: string
          full_path: string
          height?: number | null
          id?: string
          location_kind?: string | null
          media_type?: string
          reachable_from?: string | null
          rel_path?: string | null
          size_bytes?: number | null
          source_root: string
          status?: string
          status_note?: string | null
          suggested_output?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          venture?: string | null
          venue?: string | null
          width?: number | null
        }
        Update: {
          ai_caption?: string | null
          ai_tags?: Json | null
          captured_on?: string | null
          content_hash?: string | null
          description?: string | null
          duration_sec?: number | null
          exif?: Json | null
          ext?: string | null
          file_mtime?: string | null
          filename?: string
          first_seen_at?: string
          full_path?: string
          height?: number | null
          id?: string
          location_kind?: string | null
          media_type?: string
          reachable_from?: string | null
          rel_path?: string | null
          size_bytes?: number | null
          source_root?: string
          status?: string
          status_note?: string | null
          suggested_output?: string | null
          thumbnail_path?: string | null
          updated_at?: string
          venture?: string | null
          venue?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_folders: {
        Row: {
          audio_count: number
          context_md: string | null
          date_max: string | null
          date_min: string | null
          editor: string | null
          event_date: string | null
          event_name: string | null
          file_count: number
          first_seen_at: string
          folder_class: string
          folder_path: string
          id: string
          image_count: number
          name: string
          sidecar_path: string | null
          sidecar_written_at: string | null
          source_root: string | null
          sphere: string | null
          status: string
          status_note: string | null
          top_venture: string | null
          total_bytes: number
          updated_at: string
          ventures: string[] | null
          video_count: number
        }
        Insert: {
          audio_count?: number
          context_md?: string | null
          date_max?: string | null
          date_min?: string | null
          editor?: string | null
          event_date?: string | null
          event_name?: string | null
          file_count?: number
          first_seen_at?: string
          folder_class?: string
          folder_path: string
          id?: string
          image_count?: number
          name: string
          sidecar_path?: string | null
          sidecar_written_at?: string | null
          source_root?: string | null
          sphere?: string | null
          status?: string
          status_note?: string | null
          top_venture?: string | null
          total_bytes?: number
          updated_at?: string
          ventures?: string[] | null
          video_count?: number
        }
        Update: {
          audio_count?: number
          context_md?: string | null
          date_max?: string | null
          date_min?: string | null
          editor?: string | null
          event_date?: string | null
          event_name?: string | null
          file_count?: number
          first_seen_at?: string
          folder_class?: string
          folder_path?: string
          id?: string
          image_count?: number
          name?: string
          sidecar_path?: string | null
          sidecar_written_at?: string | null
          source_root?: string | null
          sphere?: string | null
          status?: string
          status_note?: string | null
          top_venture?: string | null
          total_bytes?: number
          updated_at?: string
          ventures?: string[] | null
          video_count?: number
        }
        Relationships: []
      }
      meta_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          ig_user_id: string
          last_error: string | null
          provider: string
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          ig_user_id: string
          last_error?: string | null
          provider?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          ig_user_id?: string
          last_error?: string | null
          provider?: string
          updated_at?: string
          username?: string | null
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
      outreach_targets: {
        Row: {
          act: string | null
          created_at: string
          id: number
          next_action: string | null
          sort: number
          source: string | null
          status: string
          target: string
          type: string | null
          why: string | null
        }
        Insert: {
          act?: string | null
          created_at?: string
          id?: never
          next_action?: string | null
          sort?: number
          source?: string | null
          status?: string
          target: string
          type?: string | null
          why?: string | null
        }
        Update: {
          act?: string | null
          created_at?: string
          id?: never
          next_action?: string | null
          sort?: number
          source?: string | null
          status?: string
          target?: string
          type?: string | null
          why?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean
          band_member_id: string | null
          bio_short: string | null
          capacities: string[]
          contact_email: string | null
          contact_id: string | null
          contact_phone: string | null
          created_at: string
          engagement_status: string
          found_via: string | null
          headshot_url: string | null
          id: string
          instagram_handle: string | null
          instruments: string[] | null
          name: string
          notes: string | null
          rate_note: string | null
          reference_image_path: string | null
          roles: string[] | null
          skill_level: string | null
          tier: number | null
          updated_at: string
          ventures: string[] | null
        }
        Insert: {
          active?: boolean
          band_member_id?: string | null
          bio_short?: string | null
          capacities?: string[]
          contact_email?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          engagement_status?: string
          found_via?: string | null
          headshot_url?: string | null
          id?: string
          instagram_handle?: string | null
          instruments?: string[] | null
          name: string
          notes?: string | null
          rate_note?: string | null
          reference_image_path?: string | null
          roles?: string[] | null
          skill_level?: string | null
          tier?: number | null
          updated_at?: string
          ventures?: string[] | null
        }
        Update: {
          active?: boolean
          band_member_id?: string | null
          bio_short?: string | null
          capacities?: string[]
          contact_email?: string | null
          contact_id?: string | null
          contact_phone?: string | null
          created_at?: string
          engagement_status?: string
          found_via?: string | null
          headshot_url?: string | null
          id?: string
          instagram_handle?: string | null
          instruments?: string[] | null
          name?: string
          notes?: string | null
          rate_note?: string | null
          reference_image_path?: string | null
          roles?: string[] | null
          skill_level?: string | null
          tier?: number | null
          updated_at?: string
          ventures?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "people_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          style: string
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
          style?: string
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
          style?: string
          top_windows?: Json
          updated_at?: string
        }
        Relationships: []
      }
      posting_times_sources: {
        Row: {
          created_at: string
          id: string
          platform: string
          raw_markdown: string
          scrape_error: string | null
          scraped_at: string
          source_label: string
          source_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          raw_markdown: string
          scrape_error?: string | null
          scraped_at?: string
          source_label: string
          source_url: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          raw_markdown?: string
          scrape_error?: string | null
          scraped_at?: string
          source_label?: string
          source_url?: string
        }
        Relationships: []
      }
      practice_items: {
        Row: {
          archived_at: string | null
          artist: string
          color_level: number
          color_level_updated_at: string | null
          created_at: string
          id: string
          image_path: string | null
          key: string
          kind: string
          last_practiced_at: string | null
          notes: string
          source_item_id: string | null
          times_practiced: number
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          artist?: string
          color_level?: number
          color_level_updated_at?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          key?: string
          kind: string
          last_practiced_at?: string | null
          notes?: string
          source_item_id?: string | null
          times_practiced?: number
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          artist?: string
          color_level?: number
          color_level_updated_at?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          key?: string
          kind?: string
          last_practiced_at?: string | null
          notes?: string
          source_item_id?: string | null
          times_practiced?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_items_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "practice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_preset_segments: {
        Row: {
          bpm: number | null
          category: string
          created_at: string
          id: string
          label: string
          notes: string
          preset_id: string
          sort_order: number
          target_minutes: number
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          category: string
          created_at?: string
          id?: string
          label?: string
          notes?: string
          preset_id: string
          sort_order?: number
          target_minutes?: number
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          category?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string
          preset_id?: string
          sort_order?: number
          target_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_preset_segments_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "practice_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_presets: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          target_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          target_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          target_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      practice_segment_details: {
        Row: {
          bpm: number | null
          created_at: string
          dim2_id: string | null
          dim3_id: string | null
          id: string
          keys_covered: string | null
          keys_worked: string[] | null
          lh_id: string | null
          maintenance: boolean
          method_id: string | null
          range_from: number | null
          range_to: number | null
          segment_id: string
          sort_order: number
          triad_interval: string | null
          triad_qualities: string | null
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          dim2_id?: string | null
          dim3_id?: string | null
          id?: string
          keys_covered?: string | null
          keys_worked?: string[] | null
          lh_id?: string | null
          maintenance?: boolean
          method_id?: string | null
          range_from?: number | null
          range_to?: number | null
          segment_id: string
          sort_order?: number
          triad_interval?: string | null
          triad_qualities?: string | null
        }
        Update: {
          bpm?: number | null
          created_at?: string
          dim2_id?: string | null
          dim3_id?: string | null
          id?: string
          keys_covered?: string | null
          keys_worked?: string[] | null
          lh_id?: string | null
          maintenance?: boolean
          method_id?: string | null
          range_from?: number | null
          range_to?: number | null
          segment_id?: string
          sort_order?: number
          triad_interval?: string | null
          triad_qualities?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_segment_details_dim2_id_fkey"
            columns: ["dim2_id"]
            isOneToOne: false
            referencedRelation: "practice_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_segment_details_dim3_id_fkey"
            columns: ["dim3_id"]
            isOneToOne: false
            referencedRelation: "practice_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_segment_details_lh_id_fkey"
            columns: ["lh_id"]
            isOneToOne: false
            referencedRelation: "practice_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_segment_details_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "practice_taxonomy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_segment_details_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "practice_session_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_session_segments: {
        Row: {
          actual_seconds: number
          bpm: number | null
          category: string
          completed: boolean
          created_at: string
          id: string
          label: string
          metronome_bpm_end: number | null
          metronome_bpm_start: number | null
          metronome_seconds: number | null
          metronome_time_sig: string | null
          notes: string
          session_id: string
          skipped: boolean
          sort_order: number
          target_minutes: number
          what_practiced: string
        }
        Insert: {
          actual_seconds?: number
          bpm?: number | null
          category: string
          completed?: boolean
          created_at?: string
          id?: string
          label?: string
          metronome_bpm_end?: number | null
          metronome_bpm_start?: number | null
          metronome_seconds?: number | null
          metronome_time_sig?: string | null
          notes?: string
          session_id: string
          skipped?: boolean
          sort_order?: number
          target_minutes?: number
          what_practiced?: string
        }
        Update: {
          actual_seconds?: number
          bpm?: number | null
          category?: string
          completed?: boolean
          created_at?: string
          id?: string
          label?: string
          metronome_bpm_end?: number | null
          metronome_bpm_start?: number | null
          metronome_seconds?: number | null
          metronome_time_sig?: string | null
          notes?: string
          session_id?: string
          skipped?: boolean
          sort_order?: number
          target_minutes?: number
          what_practiced?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_session_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          notes: string
          preset_id: string | null
          preset_name: string
          song_of_the_day: string
          started_at: string
          status: string
          total_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string
          preset_id?: string | null
          preset_name?: string
          song_of_the_day?: string
          started_at?: string
          status?: string
          total_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string
          preset_id?: string | null
          preset_name?: string
          song_of_the_day?: string
          started_at?: string
          status?: string
          total_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "practice_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_songs: {
        Row: {
          artist: string
          created_at: string
          id: string
          key: string
          last_practiced_at: string | null
          learned_at: string | null
          notes: string
          status: string
          times_practiced: number
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string
          created_at?: string
          id?: string
          key?: string
          last_practiced_at?: string | null
          learned_at?: string | null
          notes?: string
          status?: string
          times_practiced?: number
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string
          created_at?: string
          id?: string
          key?: string
          last_practiced_at?: string | null
          learned_at?: string | null
          notes?: string
          status?: string
          times_practiced?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_taxonomy: {
        Row: {
          active: boolean
          applies_to: string[]
          created_at: string
          dim2: string | null
          dim3: string | null
          dimension: string
          id: string
          label: string
          notes: string | null
          parent_id: string | null
          sort_order: number
          value: string
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          created_at?: string
          dim2?: string | null
          dim3?: string | null
          dimension: string
          id?: string
          label: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          value: string
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          created_at?: string
          dim2?: string | null
          dim3?: string | null
          dimension?: string
          id?: string
          label?: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_taxonomy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "practice_taxonomy"
            referencedColumns: ["id"]
          },
        ]
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
      release_singles: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          release_date: string | null
          single_no: number
          status: string
          working_title: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          notes?: string | null
          release_date?: string | null
          single_no: number
          status?: string
          working_title?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          notes?: string | null
          release_date?: string | null
          single_no?: number
          status?: string
          working_title?: string | null
        }
        Relationships: []
      }
      release_tasks: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          phase: string | null
          single_no: number | null
          sort: number
          status: string
          target_date: string | null
          task: string
        }
        Insert: {
          created_at?: string
          id?: never
          notes?: string | null
          phase?: string | null
          single_no?: number | null
          sort?: number
          status?: string
          target_date?: string | null
          task: string
        }
        Update: {
          created_at?: string
          id?: never
          notes?: string | null
          phase?: string | null
          single_no?: number | null
          sort?: number
          status?: string
          target_date?: string | null
          task?: string
        }
        Relationships: []
      }
      run_of_show: {
        Row: {
          canonical_event_id: string | null
          created_at: string
          details: Json
          event_date: string
          event_name: string | null
          id: string
          organization: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          canonical_event_id?: string | null
          created_at?: string
          details?: Json
          event_date: string
          event_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          canonical_event_id?: string | null
          created_at?: string
          details?: Json
          event_date?: string
          event_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_of_show_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "canonical_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_holds: {
        Row: {
          agency: string | null
          calendar_event_id: string | null
          created_at: string
          event_date: string | null
          event_label: string | null
          followup_cadence: string | null
          hold_status: string | null
          id: string
          last_checked_at: string | null
          last_told_musician_at: string | null
          musician: string | null
          musician_status: string | null
          next_check_at: string | null
          notes: string | null
          role: string | null
          sales_rep: string | null
          updated_at: string
        }
        Insert: {
          agency?: string | null
          calendar_event_id?: string | null
          created_at?: string
          event_date?: string | null
          event_label?: string | null
          followup_cadence?: string | null
          hold_status?: string | null
          id?: string
          last_checked_at?: string | null
          last_told_musician_at?: string | null
          musician?: string | null
          musician_status?: string | null
          next_check_at?: string | null
          notes?: string | null
          role?: string | null
          sales_rep?: string | null
          updated_at?: string
        }
        Update: {
          agency?: string | null
          calendar_event_id?: string | null
          created_at?: string
          event_date?: string | null
          event_label?: string | null
          followup_cadence?: string | null
          hold_status?: string | null
          id?: string
          last_checked_at?: string | null
          last_told_musician_at?: string | null
          musician?: string | null
          musician_status?: string | null
          next_check_at?: string | null
          notes?: string | null
          role?: string | null
          sales_rep?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setlist_builds: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string | null
          event_name: string
          gig_slug: string
          id: string
          manifest: Json
          materialized_at: string | null
          materialized_path: string | null
          materialized_summary: Json | null
          raw_input: string
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_name: string
          gig_slug: string
          id?: string
          manifest: Json
          materialized_at?: string | null
          materialized_path?: string | null
          materialized_summary?: Json | null
          raw_input: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_name?: string
          gig_slug?: string
          id?: string
          manifest?: Json
          materialized_at?: string | null
          materialized_path?: string | null
          materialized_summary?: Json | null
          raw_input?: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      setlists: {
        Row: {
          created_at: string
          created_by: string
          event_date: string | null
          event_name: string | null
          id: string
          name: string
          notes: string | null
          org: string
          song_ids: string[]
          song_snapshot: Json
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          name: string
          notes?: string | null
          org: string
          song_ids?: string[]
          song_snapshot?: Json
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          event_date?: string | null
          event_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          org?: string
          song_ids?: string[]
          song_snapshot?: Json
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      smart_link_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: number
          kind: string
          platform: string | null
          referrer: string | null
          region: string | null
          slug: string
          ua: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: never
          kind?: string
          platform?: string | null
          referrer?: string | null
          region?: string | null
          slug: string
          ua?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: never
          kind?: string
          platform?: string | null
          referrer?: string | null
          region?: string | null
          slug?: string
          ua?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      smart_links: {
        Row: {
          accent: string | null
          artist: string
          artwork_url: string | null
          created_at: string
          id: string
          is_active: boolean
          pixel_id: string | null
          platforms: Json
          release_date: string | null
          slug: string
          subtitle: string | null
          title: string
          tracks: Json
          updated_at: string
        }
        Insert: {
          accent?: string | null
          artist?: string
          artwork_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          platforms?: Json
          release_date?: string | null
          slug: string
          subtitle?: string | null
          title: string
          tracks?: Json
          updated_at?: string
        }
        Update: {
          accent?: string | null
          artist?: string
          artwork_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id?: string | null
          platforms?: Json
          release_date?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
          tracks?: Json
          updated_at?: string
        }
        Relationships: []
      }
      smart_task_enrichments: {
        Row: {
          agent_id: string | null
          blockers: string | null
          board_bucket: string | null
          board_venture: string | null
          created_at: string
          definition_of_done: string | null
          due_date: string | null
          effort: string | null
          followup_cadence_days: number | null
          followup_frequency: string | null
          followup_last_surfaced_at: string | null
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          google_task_id: string | null
          id: string
          last_followup_at: string | null
          measure: string | null
          next_followup_at: string | null
          raw_input: string
          recurring_followup: boolean
          revised_title: string | null
          trello_card_id: string | null
          trello_card_url: string | null
        }
        Insert: {
          agent_id?: string | null
          blockers?: string | null
          board_bucket?: string | null
          board_venture?: string | null
          created_at?: string
          definition_of_done?: string | null
          due_date?: string | null
          effort?: string | null
          followup_cadence_days?: number | null
          followup_frequency?: string | null
          followup_last_surfaced_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_task_id?: string | null
          id?: string
          last_followup_at?: string | null
          measure?: string | null
          next_followup_at?: string | null
          raw_input: string
          recurring_followup?: boolean
          revised_title?: string | null
          trello_card_id?: string | null
          trello_card_url?: string | null
        }
        Update: {
          agent_id?: string | null
          blockers?: string | null
          board_bucket?: string | null
          board_venture?: string | null
          created_at?: string
          definition_of_done?: string | null
          due_date?: string | null
          effort?: string | null
          followup_cadence_days?: number | null
          followup_frequency?: string | null
          followup_last_surfaced_at?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          google_task_id?: string | null
          id?: string
          last_followup_at?: string | null
          measure?: string | null
          next_followup_at?: string | null
          raw_input?: string
          recurring_followup?: boolean
          revised_title?: string | null
          trello_card_id?: string | null
          trello_card_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_task_enrichments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_teammates"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_task_queue: {
        Row: {
          card_desc: string | null
          card_name: string
          card_url: string
          completed_at: string | null
          created_at: string
          id: string
          list_name: string
          picked_up_at: string | null
          picked_up_by: string | null
          result_artifact: string | null
          status: string
          status_notes: string | null
          trello_card_id: string
          updated_at: string
        }
        Insert: {
          card_desc?: string | null
          card_name: string
          card_url: string
          completed_at?: string | null
          created_at?: string
          id?: string
          list_name: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          result_artifact?: string | null
          status?: string
          status_notes?: string | null
          trello_card_id: string
          updated_at?: string
        }
        Update: {
          card_desc?: string | null
          card_name?: string
          card_url?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          list_name?: string
          picked_up_at?: string | null
          picked_up_by?: string | null
          result_artifact?: string | null
          status?: string
          status_notes?: string | null
          trello_card_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_task_queue_trello_card_id_fkey"
            columns: ["trello_card_id"]
            isOneToOne: true
            referencedRelation: "trello_card_routes"
            referencedColumns: ["trello_card_id"]
          },
        ]
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
      social_content_queue: {
        Row: {
          accounts: string[]
          assigned_to: string
          caption: string
          created_at: string
          id: string
          media_paths: string[]
          notes: string
          scheduled_for: string | null
          slot: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accounts?: string[]
          assigned_to?: string
          caption?: string
          created_at?: string
          id?: string
          media_paths?: string[]
          notes?: string
          scheduled_for?: string | null
          slot?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accounts?: string[]
          assigned_to?: string
          caption?: string
          created_at?: string
          id?: string
          media_paths?: string[]
          notes?: string
          scheduled_for?: string | null
          slot?: string | null
          status?: string
          updated_at?: string
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
      social_workflow_status: {
        Row: {
          date: string
          fri_stories_done: boolean
          mon_prep_done: boolean
          thu_post_done: boolean
          thu_stories_done: boolean
          tue_post_done: boolean
          tue_stories_done: boolean
          updated_at: string
          wed_stories_done: boolean
        }
        Insert: {
          date: string
          fri_stories_done?: boolean
          mon_prep_done?: boolean
          thu_post_done?: boolean
          thu_stories_done?: boolean
          tue_post_done?: boolean
          tue_stories_done?: boolean
          updated_at?: string
          wed_stories_done?: boolean
        }
        Update: {
          date?: string
          fri_stories_done?: boolean
          mon_prep_done?: boolean
          thu_post_done?: boolean
          thu_stories_done?: boolean
          tue_post_done?: boolean
          tue_stories_done?: boolean
          updated_at?: string
          wed_stories_done?: boolean
        }
        Relationships: []
      }
      songs: {
        Row: {
          active: boolean
          artist: string
          created_at: string
          decade: string | null
          functions: string[]
          genre: string
          id: string
          org_tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist: string
          created_at?: string
          decade?: string | null
          functions?: string[]
          genre: string
          id?: string
          org_tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist?: string
          created_at?: string
          decade?: string | null
          functions?: string[]
          genre?: string
          id?: string
          org_tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      systems_registry: {
        Row: {
          backend_path: string | null
          blocked_on: string | null
          brain_ref: string | null
          category: string
          created_at: string
          current_work: string | null
          description: string | null
          health: string | null
          id: string
          just_finished: string | null
          key: string
          last_activity: string | null
          name: string
          pinned: boolean
          security_note: string | null
          sort_order: number
          status: string
          up_next: string | null
          updated_at: string
        }
        Insert: {
          backend_path?: string | null
          blocked_on?: string | null
          brain_ref?: string | null
          category?: string
          created_at?: string
          current_work?: string | null
          description?: string | null
          health?: string | null
          id?: string
          just_finished?: string | null
          key: string
          last_activity?: string | null
          name: string
          pinned?: boolean
          security_note?: string | null
          sort_order?: number
          status?: string
          up_next?: string | null
          updated_at?: string
        }
        Update: {
          backend_path?: string | null
          blocked_on?: string | null
          brain_ref?: string | null
          category?: string
          created_at?: string
          current_work?: string | null
          description?: string | null
          health?: string | null
          id?: string
          just_finished?: string | null
          key?: string
          last_activity?: string | null
          name?: string
          pinned?: boolean
          security_note?: string | null
          sort_order?: number
          status?: string
          up_next?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          role: string
          surfaces: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          role?: string
          surfaces?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          role?: string
          surfaces?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: string[] | null
          duration_min: number
          id: string
          kind: string
          note: string | null
          preferred_time: string | null
          sort_order: number
          source: string
          title: string
          trello_card_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: string[] | null
          duration_min?: number
          id?: string
          kind?: string
          note?: string | null
          preferred_time?: string | null
          sort_order?: number
          source?: string
          title: string
          trello_card_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: string[] | null
          duration_min?: number
          id?: string
          kind?: string
          note?: string | null
          preferred_time?: string | null
          sort_order?: number
          source?: string
          title?: string
          trello_card_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trello_bucket_routes: {
        Row: {
          action_handler: string
          board_id: string
          created_at: string
          enabled: boolean
          handler_config: Json
          id: string
          list_id: string | null
          list_name: string
          priority: number
          updated_at: string
        }
        Insert: {
          action_handler: string
          board_id: string
          created_at?: string
          enabled?: boolean
          handler_config?: Json
          id?: string
          list_id?: string | null
          list_name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          action_handler?: string
          board_id?: string
          created_at?: string
          enabled?: boolean
          handler_config?: Json
          id?: string
          list_id?: string | null
          list_name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      trello_card_routes: {
        Row: {
          action_handler: string
          completed_at: string | null
          completion_notes: string | null
          completion_status: string | null
          persisted_ref: string | null
          raw_card_snapshot: Json
          route_id: string | null
          routed_at: string
          trello_card_id: string
        }
        Insert: {
          action_handler: string
          completed_at?: string | null
          completion_notes?: string | null
          completion_status?: string | null
          persisted_ref?: string | null
          raw_card_snapshot: Json
          route_id?: string | null
          routed_at?: string
          trello_card_id: string
        }
        Update: {
          action_handler?: string
          completed_at?: string | null
          completion_notes?: string | null
          completion_status?: string | null
          persisted_ref?: string | null
          raw_card_snapshot?: Json
          route_id?: string | null
          routed_at?: string
          trello_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trello_card_routes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "trello_bucket_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      trello_writeback: {
        Row: {
          action: string
          card_id: string
          created_at: string
          flushed_at: string | null
          note: string | null
        }
        Insert: {
          action?: string
          card_id: string
          created_at?: string
          flushed_at?: string | null
          note?: string | null
        }
        Update: {
          action?: string
          card_id?: string
          created_at?: string
          flushed_at?: string | null
          note?: string | null
        }
        Relationships: []
      }
      visual_assets: {
        Row: {
          ai_error: string | null
          ai_processed_at: string | null
          ai_suggested_alt: string | null
          ai_suggested_caption: string | null
          ai_suggested_instruments: string[]
          ai_suggested_kind: string | null
          ai_suggested_location: string | null
          ai_suggested_people_count: string | null
          ai_suggested_people_names: string[]
          ai_suggested_people_roles: string[]
          ai_suggested_tags: string[]
          ai_suggested_venue: string | null
          alt_text: string | null
          caption: string | null
          created_at: string
          derivative_paths: Json
          file_size_bytes: number | null
          filename: string
          folder: string
          height: number | null
          id: string
          mime_type: string | null
          review_status: string
          rights: string
          shoot_date: string | null
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          ventures: string[]
          width: number | null
        }
        Insert: {
          ai_error?: string | null
          ai_processed_at?: string | null
          ai_suggested_alt?: string | null
          ai_suggested_caption?: string | null
          ai_suggested_instruments?: string[]
          ai_suggested_kind?: string | null
          ai_suggested_location?: string | null
          ai_suggested_people_count?: string | null
          ai_suggested_people_names?: string[]
          ai_suggested_people_roles?: string[]
          ai_suggested_tags?: string[]
          ai_suggested_venue?: string | null
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          derivative_paths?: Json
          file_size_bytes?: number | null
          filename: string
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          review_status?: string
          rights?: string
          shoot_date?: string | null
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          ventures?: string[]
          width?: number | null
        }
        Update: {
          ai_error?: string | null
          ai_processed_at?: string | null
          ai_suggested_alt?: string | null
          ai_suggested_caption?: string | null
          ai_suggested_instruments?: string[]
          ai_suggested_kind?: string | null
          ai_suggested_location?: string | null
          ai_suggested_people_count?: string | null
          ai_suggested_people_names?: string[]
          ai_suggested_people_roles?: string[]
          ai_suggested_tags?: string[]
          ai_suggested_venue?: string | null
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          derivative_paths?: Json
          file_size_bytes?: number | null
          filename?: string
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          review_status?: string
          rights?: string
          shoot_date?: string | null
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          ventures?: string[]
          width?: number | null
        }
        Relationships: []
      }
      waiting_on_josh: {
        Row: {
          agent_id: string | null
          assumed_default: string | null
          context_md: string | null
          detail: string | null
          id: string
          item_type: string
          media_refs: Json
          options: Json | null
          parent_id: string | null
          priority: string
          prompt: string | null
          questions: Json | null
          queued_at: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          round: number
          source_ref: string | null
          source_session: string | null
          title: string
          triangulation_loops: Json
          uploads: Json | null
        }
        Insert: {
          agent_id?: string | null
          assumed_default?: string | null
          context_md?: string | null
          detail?: string | null
          id?: string
          item_type?: string
          media_refs?: Json
          options?: Json | null
          parent_id?: string | null
          priority?: string
          prompt?: string | null
          questions?: Json | null
          queued_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round?: number
          source_ref?: string | null
          source_session?: string | null
          title: string
          triangulation_loops?: Json
          uploads?: Json | null
        }
        Update: {
          agent_id?: string | null
          assumed_default?: string | null
          context_md?: string | null
          detail?: string | null
          id?: string
          item_type?: string
          media_refs?: Json
          options?: Json | null
          parent_id?: string | null
          priority?: string
          prompt?: string | null
          questions?: Json | null
          queued_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round?: number
          source_ref?: string | null
          source_session?: string | null
          title?: string
          triangulation_loops?: Json
          uploads?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_on_josh_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_teammates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_on_josh_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "waiting_on_josh"
            referencedColumns: ["id"]
          },
        ]
      }
      wilson_bookings: {
        Row: {
          buyer: string | null
          commission_pct: number
          created_at: string
          event_date: string | null
          fee: number | null
          id: string
          notes: string | null
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          buyer?: string | null
          commission_pct?: number
          created_at?: string
          event_date?: string | null
          fee?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          buyer?: string | null
          commission_pct?: number
          created_at?: string
          event_date?: string | null
          fee?: number | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      wilson_outreach: {
        Row: {
          channel: string | null
          created_at: string
          direction: string
          happened_at: string
          id: string
          summary: string
          target: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          direction?: string
          happened_at?: string
          id?: string
          summary: string
          target?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          direction?: string
          happened_at?: string
          id?: string
          summary?: string
          target?: string | null
        }
        Relationships: []
      }
      wilson_submissions: {
        Row: {
          category: string
          created_at: string
          id: string
          notes: string | null
          region: string | null
          sort: number
          status: string
          submit_path: string | null
          submitted_at: string | null
          target: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          region?: string | null
          sort?: number
          status?: string
          submit_path?: string | null
          submitted_at?: string | null
          target: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          region?: string | null
          sort?: number
          status?: string
          submit_path?: string | null
          submitted_at?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_claim_events: {
        Row: {
          changed_at: string
          claimed_by: string | null
          done_evidence: string | null
          id: number
          new_status: string
          note: string | null
          old_status: string | null
          pr_url: string | null
          work_key: string
        }
        Insert: {
          changed_at?: string
          claimed_by?: string | null
          done_evidence?: string | null
          id?: never
          new_status: string
          note?: string | null
          old_status?: string | null
          pr_url?: string | null
          work_key: string
        }
        Update: {
          changed_at?: string
          claimed_by?: string | null
          done_evidence?: string | null
          id?: never
          new_status?: string
          note?: string | null
          old_status?: string | null
          pr_url?: string | null
          work_key?: string
        }
        Relationships: []
      }
      work_claims: {
        Row: {
          branch: string | null
          claimed_at: string
          claimed_by: string
          done_evidence: string | null
          heartbeat_at: string
          machine: string | null
          notes: string | null
          pr_url: string | null
          priority: number
          released_at: string | null
          spec_ref: string | null
          status: string
          title: string | null
          work_key: string
        }
        Insert: {
          branch?: string | null
          claimed_at?: string
          claimed_by: string
          done_evidence?: string | null
          heartbeat_at?: string
          machine?: string | null
          notes?: string | null
          pr_url?: string | null
          priority?: number
          released_at?: string | null
          spec_ref?: string | null
          status?: string
          title?: string | null
          work_key: string
        }
        Update: {
          branch?: string | null
          claimed_at?: string
          claimed_by?: string
          done_evidence?: string | null
          heartbeat_at?: string
          machine?: string | null
          notes?: string | null
          pr_url?: string | null
          priority?: number
          released_at?: string | null
          spec_ref?: string | null
          status?: string
          title?: string | null
          work_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      epk_public: {
        Row: {
          bio_long: string | null
          bio_short: string | null
          booking_email: string | null
          booking_phone: string | null
          kind: string | null
          listen_smart_link_slug: string | null
          name: string | null
          one_liner: string | null
          slug: string | null
          socials: Json | null
          status: string | null
          website_url: string | null
        }
        Insert: {
          bio_long?: string | null
          bio_short?: string | null
          booking_email?: string | null
          booking_phone?: string | null
          kind?: string | null
          listen_smart_link_slug?: string | null
          name?: string | null
          one_liner?: string | null
          slug?: string | null
          socials?: Json | null
          status?: string | null
          website_url?: string | null
        }
        Update: {
          bio_long?: string | null
          bio_short?: string | null
          booking_email?: string | null
          booking_phone?: string | null
          kind?: string | null
          listen_smart_link_slug?: string | null
          name?: string | null
          one_liner?: string | null
          slug?: string | null
          socials?: Json | null
          status?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      v_suspect_done_lanes: {
        Row: {
          claimed_by: string | null
          heartbeat_at: string | null
          notes_snippet: string | null
          priority: number | null
          released_at: string | null
          suspect_reasons: string[] | null
          work_key: string | null
        }
        Insert: {
          claimed_by?: string | null
          heartbeat_at?: string | null
          notes_snippet?: never
          priority?: number | null
          released_at?: string | null
          suspect_reasons?: never
          work_key?: string | null
        }
        Update: {
          claimed_by?: string | null
          heartbeat_at?: string | null
          notes_snippet?: never
          priority?: number | null
          released_at?: string | null
          suspect_reasons?: never
          work_key?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_role: { Args: never; Returns: string }
      chart_index_build_tsv: {
        Args: {
          p_composer: string
          p_filename: string
          p_genre: string
          p_ireal_pro: string[]
          p_keywords: string
          p_reference: string
          p_setlists: string[]
          p_tags: string[]
          p_title: string
        }
        Returns: unknown
      }
      chart_index_genres: {
        Args: never
        Returns: {
          genre: string
        }[]
      }
      chart_index_song_counts: {
        Args: never
        Returns: {
          charts: number
          folder_sub: string
          folder_top: string
          level: string
          songs: number
        }[]
      }
      check_ingest_stall: { Args: never; Returns: undefined }
      cleanup_old_posting_times_sources: { Args: never; Returns: undefined }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      is_operator: { Args: never; Returns: boolean }
      refresh_djep_calendar_events_cache: { Args: never; Returns: number }
      refresh_djep_past_events_cache: { Args: never; Returns: number }
      river_best_agent: { Args: { txt: string }; Returns: string }
      river_connections: {
        Args: { p_job: string }
        Returns: {
          ref_id: string
          status: string
          surface: string
          title: string
        }[]
      }
      soundex: { Args: { "": string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
      trigger_availability_prefetch: { Args: never; Returns: undefined }
      trigger_claude_action_smartify: { Args: never; Returns: number }
      trigger_integration_health_check: { Args: never; Returns: number }
      trigger_jjmm_contacts_sync: { Args: never; Returns: number }
      trigger_meta_token_refresh: { Args: never; Returns: number }
      trigger_posting_times_refresh: { Args: never; Returns: number }
      trigger_smart_followup_repin: { Args: never; Returns: number }
      trigger_trello_mark_done: { Args: { p_card_id: string }; Returns: number }
      trigger_trello_route: { Args: never; Returns: number }
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
