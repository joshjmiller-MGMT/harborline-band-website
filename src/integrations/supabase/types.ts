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
          created_at: string
          id: string
          name: string
          reference_image_path: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          reference_image_path?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          reference_image_path?: string | null
          role?: string
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
      brand_decisions: {
        Row: {
          created_at: string
          decided_at: string
          decided_by: string | null
          decision: string
          id: string
          rationale: string | null
          related_assets: string[] | null
          superseded_by: string | null
          title: string
          ventures: string[]
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision: string
          id?: string
          rationale?: string | null
          related_assets?: string[] | null
          superseded_by?: string | null
          title: string
          ventures?: string[]
        }
        Update: {
          created_at?: string
          decided_at?: string
          decided_by?: string | null
          decision?: string
          id?: string
          rationale?: string | null
          related_assets?: string[] | null
          superseded_by?: string | null
          title?: string
          ventures?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "brand_decisions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "brand_decisions"
            referencedColumns: ["id"]
          },
        ]
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
          tags?: string[]
          time_signature?: string | null
          title?: string
          updated_at?: string
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
          key: string
          kind: string
          last_practiced_at: string | null
          notes: string
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
          key?: string
          kind: string
          last_practiced_at?: string | null
          notes?: string
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
          key?: string
          kind?: string
          last_practiced_at?: string | null
          notes?: string
          times_practiced?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      practice_session_segments: {
        Row: {
          actual_seconds: number
          bpm: number | null
          category: string
          completed: boolean
          created_at: string
          id: string
          label: string
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
      smart_task_enrichments: {
        Row: {
          blockers: string | null
          created_at: string
          definition_of_done: string | null
          due_date: string | null
          effort: string | null
          google_calendar_event_id: string | null
          google_calendar_html_link: string | null
          id: string
          measure: string | null
          raw_input: string
          revised_title: string | null
          trello_card_id: string | null
          trello_card_url: string | null
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          definition_of_done?: string | null
          due_date?: string | null
          effort?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          id?: string
          measure?: string | null
          raw_input: string
          revised_title?: string | null
          trello_card_id?: string | null
          trello_card_url?: string | null
        }
        Update: {
          blockers?: string | null
          created_at?: string
          definition_of_done?: string | null
          due_date?: string | null
          effort?: string | null
          google_calendar_event_id?: string | null
          google_calendar_html_link?: string | null
          id?: string
          measure?: string | null
          raw_input?: string
          revised_title?: string | null
          trello_card_id?: string | null
          trello_card_url?: string | null
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
          detail: string | null
          id: string
          priority: string
          queued_at: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_session: string | null
          title: string
        }
        Insert: {
          detail?: string | null
          id?: string
          priority?: string
          queued_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_session?: string | null
          title: string
        }
        Update: {
          detail?: string | null
          id?: string
          priority?: string
          queued_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_session?: string | null
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      cleanup_old_posting_times_sources: { Args: never; Returns: undefined }
      trigger_availability_prefetch: { Args: never; Returns: undefined }
      trigger_posting_times_refresh: { Args: never; Returns: number }
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
