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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      frames: {
        Row: {
          counter_color: string
          event_end: string | null
          event_start: string | null
          hairline_color: string
          hairline_opacity: number
          id: string
          label: string
          marker_shape: string | null
          marker_svg: string | null
          suffix_color: string | null
          suffix_text: string | null
          unlock_kind: string
          unlock_label: string | null
        }
        Insert: {
          counter_color?: string
          event_end?: string | null
          event_start?: string | null
          hairline_color?: string
          hairline_opacity?: number
          id: string
          label: string
          marker_shape?: string | null
          marker_svg?: string | null
          suffix_color?: string | null
          suffix_text?: string | null
          unlock_kind?: string
          unlock_label?: string | null
        }
        Update: {
          counter_color?: string
          event_end?: string | null
          event_start?: string | null
          hairline_color?: string
          hairline_opacity?: number
          id?: string
          label?: string
          marker_shape?: string | null
          marker_svg?: string | null
          suffix_color?: string | null
          suffix_text?: string | null
          unlock_kind?: string
          unlock_label?: string | null
        }
        Relationships: []
      }
      free_shots: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          image_path: string | null
          is_showcased: boolean
          starred: boolean
          starred_at: string | null
          thumb_path: string | null
          user_id: string
        }
        Insert: {
          captured_at: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_showcased?: boolean
          starred?: boolean
          starred_at?: string | null
          thumb_path?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          image_path?: string | null
          is_showcased?: boolean
          starred?: boolean
          starred_at?: string | null
          thumb_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_shots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      galleries: {
        Row: {
          created_at: string
          drop_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          drop_id: string
          payload: Json
        }
        Update: {
          created_at?: string
          drop_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "galleries_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: true
            referencedRelation: "prompt_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          equipped_frame: string
          id: string
          is_premium: boolean
          push_token: string | null
          region: string
          timezone: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          equipped_frame?: string
          id: string
          is_premium?: boolean
          push_token?: string | null
          region?: string
          timezone?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          equipped_frame?: string
          id?: string
          is_premium?: boolean
          push_token?: string | null
          region?: string
          timezone?: string
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_equipped_frame_fkey"
            columns: ["equipped_frame"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_drops: {
        Row: {
          created_at: string
          day_number: number
          drop_date: string
          drops_at: string
          id: string
          prompt_id: string
          region: string
          status: string
          submit_closes_at: string
          voting_closes_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          drop_date: string
          drops_at: string
          id?: string
          prompt_id: string
          region: string
          status?: string
          submit_closes_at: string
          voting_closes_at: string
        }
        Update: {
          created_at?: string
          day_number?: number
          drop_date?: string
          drops_at?: string
          id?: string
          prompt_id?: string
          region?: string
          status?: string
          submit_closes_at?: string
          voting_closes_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_drops_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string
          created_at: string
          id: string
          is_sponsored: boolean
          seq: number | null
          text: string
          used_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_sponsored?: boolean
          seq?: number | null
          text: string
          used_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_sponsored?: boolean
          seq?: number | null
          text?: string
          used_at?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          status: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          status?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          status?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          comeback_pending: boolean
          current_weeks: number
          days_this_week: number
          is_alive: boolean
          last_active: string | null
          shields: number
          updated_at: string
          user_id: string
          week_anchor: string | null
        }
        Insert: {
          comeback_pending?: boolean
          current_weeks?: number
          days_this_week?: number
          is_alive?: boolean
          last_active?: string | null
          shields?: number
          updated_at?: string
          user_id: string
          week_anchor?: string | null
        }
        Update: {
          comeback_pending?: boolean
          current_weeks?: number
          days_this_week?: number
          is_alive?: boolean
          last_active?: string | null
          shields?: number
          updated_at?: string
          user_id?: string
          week_anchor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          bt_score: number | null
          captured_at: string
          created_at: string
          drop_id: string
          gallery_rank: number | null
          id: string
          image_path: string | null
          in_gallery: boolean
          is_potd: boolean
          quarantined: boolean
          quick_draw: boolean
          rating: number
          reaction_count: number
          starred: boolean
          starred_at: string | null
          thumb_path: string | null
          user_id: string
          vote_count: number
          xp_awarded: number
        }
        Insert: {
          bt_score?: number | null
          captured_at: string
          created_at?: string
          drop_id: string
          gallery_rank?: number | null
          id?: string
          image_path?: string | null
          in_gallery?: boolean
          is_potd?: boolean
          quarantined?: boolean
          quick_draw?: boolean
          rating?: number
          reaction_count?: number
          starred?: boolean
          starred_at?: string | null
          thumb_path?: string | null
          user_id: string
          vote_count?: number
          xp_awarded?: number
        }
        Update: {
          bt_score?: number | null
          captured_at?: string
          created_at?: string
          drop_id?: string
          gallery_rank?: number | null
          id?: string
          image_path?: string | null
          in_gallery?: boolean
          is_potd?: boolean
          quarantined?: boolean
          quick_draw?: boolean
          rating?: number
          reaction_count?: number
          starred?: boolean
          starred_at?: string | null
          thumb_path?: string | null
          user_id?: string
          vote_count?: number
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "submissions_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "prompt_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_frames: {
        Row: {
          frame_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          frame_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          frame_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_frames_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_frames_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          drop_id: string
          id: string
          loser_id: string
          voter_id: string
          winner_id: string
        }
        Insert: {
          created_at?: string
          drop_id: string
          id?: string
          loser_id: string
          voter_id: string
          winner_id: string
        }
        Update: {
          created_at?: string
          drop_id?: string
          id?: string
          loser_id?: string
          voter_id?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "prompt_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cast_vote: {
        Args: { p_drop: string; p_loser: string; p_winner: string }
        Returns: Json
      }
      cfg_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      cfg_int: { Args: { p_default: number; p_key: string }; Returns: number }
      cfg_num: { Args: { p_default: number; p_key: string }; Returns: number }
      claim_event_frame: { Args: { p_frame: string }; Returns: Json }
      close_day: { Args: { p_drop: string }; Returns: Json }
      close_due_drops: { Args: never; Returns: Json }
      decorate_photos: { Args: { p_photos: Json }; Returns: Json }
      delete_account: { Args: never; Returns: Json }
      dev_advance_day: { Args: { p_i_submitted?: boolean }; Returns: Json }
      dev_break_streak: { Args: never; Returns: Json }
      dev_current_drop: { Args: never; Returns: string }
      dev_fill_vote_cap: { Args: never; Returns: Json }
      dev_force_comeback: { Args: never; Returns: Json }
      dev_force_drop: { Args: never; Returns: Json }
      dev_grant_xp: { Args: { p_amount?: number }; Returns: Json }
      dev_guard: { Args: never; Returns: undefined }
      dev_reset_day: { Args: never; Returns: Json }
      dev_reset_drop: { Args: { p_drop: string }; Returns: undefined }
      dev_run_close_day: { Args: never; Returns: Json }
      dev_seed_submissions: { Args: { p_count?: number }; Returns: Json }
      dev_seed_votes: { Args: never; Returns: Json }
      dev_sim_game: {
        Args: {
          a_id: string
          a_q: number
          a_uid: string
          b_id: string
          b_q: number
          b_uid: string
          p_drop: string
        }
        Returns: boolean
      }
      dev_status: { Args: never; Returns: Json }
      drop_prompt: { Args: { p_region?: string }; Returns: Json }
      evaluate_streak: {
        Args: { p_as_of: string; p_uid: string }
        Returns: undefined
      }
      filter_public_photos: {
        Args: { p_photos: Json; p_viewer: string }
        Returns: Json
      }
      get_following_gallery: { Args: never; Returns: Json }
      get_gallery: { Args: { p_drop?: string }; Returns: Json }
      get_home_state: { Args: never; Returns: Json }
      get_latest_gallery: { Args: never; Returns: Json }
      get_matchup: { Args: never; Returns: Json }
      get_profile: { Args: { p_user?: string }; Returns: Json }
      is_live_drop_thumb: { Args: { object_name: string }; Returns: boolean }
      photo_status: {
        Args: { p_is_potd: boolean; p_rank: number }
        Returns: string
      }
      report_submission: {
        Args: { p_reason: string; p_submission: string }
        Returns: Json
      }
      search_users: { Args: { p_query: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_star: { Args: { p_id: string; p_type: string }; Returns: Json }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
