export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          profile_svg: string | null
          ring_color: string | null
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
          profile_svg?: string | null
          ring_color?: string | null
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
          profile_svg?: string | null
          ring_color?: string | null
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
            referencedRelation: "subject_drops"
            referencedColumns: ["id"]
          },
        ]
      }
      nods: {
        Row: {
          created_at: string
          curator_id: string
          submission_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          curator_id: string
          submission_id: string
          tag: string
        }
        Update: {
          created_at?: string
          curator_id?: string
          submission_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "nods_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nods_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          drop_id: string | null
          event_count: number
          id: string
          kind: string
          seen_at: string | null
          submission_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          drop_id?: string | null
          event_count?: number
          id?: string
          kind: string
          seen_at?: string | null
          submission_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          drop_id?: string | null
          event_count?: number
          id?: string
          kind?: string
          seen_at?: string | null
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "subject_drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_views: {
        Row: {
          submission_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          submission_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          submission_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_views_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blur_sensitive: boolean
          created_at: string
          equipped_frame: string
          id: string
          is_admin: boolean
          is_premium: boolean
          notif_appreciation: boolean
          notif_daily: boolean
          notif_results: boolean
          notif_social: boolean
          notif_wins: boolean
          push_token: string | null
          quiet_end: string | null
          quiet_start: string | null
          region: string
          timezone: string
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          blur_sensitive?: boolean
          created_at?: string
          equipped_frame?: string
          id: string
          is_admin?: boolean
          is_premium?: boolean
          notif_appreciation?: boolean
          notif_daily?: boolean
          notif_results?: boolean
          notif_social?: boolean
          notif_wins?: boolean
          push_token?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          region?: string
          timezone?: string
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          blur_sensitive?: boolean
          created_at?: string
          equipped_frame?: string
          id?: string
          is_admin?: boolean
          is_premium?: boolean
          notif_appreciation?: boolean
          notif_daily?: boolean
          notif_results?: boolean
          notif_social?: boolean
          notif_wins?: boolean
          push_token?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
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
          days_alive: number
          days_this_week: number
          flame_started_on: string | null
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
          days_alive?: number
          days_this_week?: number
          flame_started_on?: string | null
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
          days_alive?: number
          days_this_week?: number
          flame_started_on?: string | null
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
      studio_challenge_hearts: {
        Row: {
          created_at: string
          submission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          submission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenge_hearts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "studio_challenge_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_challenge_hearts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_challenge_nudges: {
        Row: {
          created_at: string
          id: string
          studio_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          studio_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenge_nudges_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_challenge_nudges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_challenge_submissions: {
        Row: {
          captured_at: string
          challenge_id: string
          created_at: string
          id: string
          image_path: string
          thumb_path: string
          user_id: string
        }
        Insert: {
          captured_at: string
          challenge_id: string
          created_at?: string
          id?: string
          image_path: string
          thumb_path: string
          user_id: string
        }
        Update: {
          captured_at?: string
          challenge_id?: string
          created_at?: string
          id?: string
          image_path?: string
          thumb_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "studio_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_challenge_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_challenges: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          studio_id: string
          theme: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          studio_id: string
          theme: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          studio_id?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_challenges_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_members: {
        Row: {
          joined_at: string
          studio_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          studio_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          created_at: string
          director_id: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          director_id: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          director_id?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "studios_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_drops: {
        Row: {
          created_at: string
          day_number: number
          drop_date: string
          drops_at: string
          id: string
          is_golden: boolean
          live_notified_at: string | null
          prompt_id: string
          region: string
          reveal_notified_at: string | null
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
          is_golden?: boolean
          live_notified_at?: string | null
          prompt_id: string
          region: string
          reveal_notified_at?: string | null
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
          is_golden?: boolean
          live_notified_at?: string | null
          prompt_id?: string
          region?: string
          reveal_notified_at?: string | null
          status?: string
          submit_closes_at?: string
          voting_closes_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_drops_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string
          created_at: string
          hint: string | null
          id: string
          is_sponsored: boolean
          seq: number | null
          text: string
          used_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          hint?: string | null
          id?: string
          is_sponsored?: boolean
          seq?: number | null
          text: string
          used_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          hint?: string | null
          id?: string
          is_sponsored?: boolean
          seq?: number | null
          text?: string
          used_at?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          bt_score: number | null
          captured_at: string
          content_label: string | null
          content_score: number | null
          created_at: string
          drop_id: string
          gallery_rank: number | null
          id: string
          image_path: string | null
          in_gallery: boolean
          is_potd: boolean
          potd_note: string | null
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
          content_label?: string | null
          content_score?: number | null
          created_at?: string
          drop_id: string
          gallery_rank?: number | null
          id?: string
          image_path?: string | null
          in_gallery?: boolean
          is_potd?: boolean
          potd_note?: string | null
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
          content_label?: string | null
          content_score?: number | null
          created_at?: string
          drop_id?: string
          gallery_rank?: number | null
          id?: string
          image_path?: string | null
          in_gallery?: boolean
          is_potd?: boolean
          potd_note?: string | null
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
            referencedRelation: "subject_drops"
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
      user_badges: {
        Row: {
          badge_type: string
          earned_at: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          badge_type: string
          earned_at?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          badge_type?: string
          earned_at?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "subject_drops"
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
      waitlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_analytics: { Args: never; Returns: Json }
      admin_close_day: { Args: { p_drop: string }; Returns: Json }
      admin_config_history: {
        Args: { p_key: string; p_limit?: number }
        Returns: Json
      }
      admin_config_last_changes: { Args: never; Returns: Json }
      admin_create_prompt: {
        Args: {
          p_category: string
          p_is_sponsored?: boolean
          p_seq?: number
          p_text: string
        }
        Returns: Json
      }
      admin_delete_prompt: { Args: { p_id: string }; Returns: Json }
      admin_delete_waitlist: { Args: { p_email: string }; Returns: Json }
      admin_drop_gallery: { Args: { p_drop: string }; Returns: Json }
      admin_drop_next: { Args: { p_region?: string }; Returns: Json }
      admin_engagement: { Args: never; Returns: Json }
      admin_grant_badge: {
        Args: { p_badge: string; p_metadata?: Json; p_user: string }
        Returns: Json
      }
      admin_grant_frame: {
        Args: { p_frame: string; p_user: string }
        Returns: Json
      }
      admin_list_badges: { Args: { p_badge?: string }; Returns: Json }
      admin_list_drops: { Args: { p_limit?: number }; Returns: Json }
      admin_list_frames: { Args: never; Returns: Json }
      admin_list_prompts: { Args: never; Returns: Json }
      admin_list_reports: { Args: never; Returns: Json }
      admin_list_waitlist: { Args: never; Returns: Json }
      admin_next_prompt: { Args: { p_region?: string }; Returns: Json }
      admin_read_config: { Args: never; Returns: Json }
      admin_recent_audit: { Args: { p_limit?: number }; Returns: Json }
      admin_recent_submissions: { Args: never; Returns: Json }
      admin_resolve_report: {
        Args: { p_remove: boolean; p_submission: string }
        Returns: Json
      }
      admin_revoke_badge: {
        Args: { p_badge: string; p_user: string }
        Returns: Json
      }
      admin_save_frame: { Args: { p_data: Json; p_id: string }; Returns: Json }
      admin_search_users: {
        Args: { p_limit?: number; p_q?: string }
        Returns: Json
      }
      admin_set_config: {
        Args: { p_key: string; p_value: Json }
        Returns: Json
      }
      admin_set_golden: {
        Args: { p_drop: string; p_golden: boolean }
        Returns: undefined
      }
      admin_set_potd_note: {
        Args: { p_note: string; p_submission: string }
        Returns: undefined
      }
      admin_set_premium: {
        Args: { p_user: string; p_value: boolean }
        Returns: Json
      }
      admin_set_subject_hint: {
        Args: { p_hint: string; p_subject: string }
        Returns: undefined
      }
      admin_set_user_admin: {
        Args: { p_user: string; p_value: boolean }
        Returns: Json
      }
      admin_start_drop: { Args: { p_drop: string }; Returns: Json }
      admin_today: { Args: { p_region?: string }; Returns: Json }
      admin_update_drop_times: {
        Args: {
          p_drop: string
          p_drops_at: string
          p_submit_closes_at: string
          p_voting_closes_at: string
        }
        Returns: Json
      }
      admin_update_prompt: {
        Args: {
          p_category: string
          p_id: string
          p_is_sponsored: boolean
          p_seq: number
          p_text: string
        }
        Returns: Json
      }
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
      create_studio: { Args: { p_name: string }; Returns: Json }
      decorate_photos: { Args: { p_photos: Json }; Returns: Json }
      delete_account: { Args: never; Returns: Json }
      delete_studio: { Args: never; Returns: Json }
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
      email_exists: { Args: { p_email: string }; Returns: boolean }
      evaluate_streak: {
        Args: { p_as_of: string; p_uid: string }
        Returns: undefined
      }
      export_my_data: { Args: never; Returns: Json }
      filter_public_photos: {
        Args: { p_photos: Json; p_viewer: string }
        Returns: Json
      }
      generate_studio_code: { Args: never; Returns: string }
      get_activity: {
        Args: { p_before?: string; p_limit?: number }
        Returns: Json
      }
      get_activity_unread: { Args: never; Returns: boolean }
      get_following_gallery: { Args: never; Returns: Json }
      get_friend_shot_count_today: { Args: never; Returns: number }
      get_gallery: { Args: { p_drop?: string }; Returns: Json }
      get_home_state: { Args: never; Returns: Json }
      get_latest_gallery: { Args: never; Returns: Json }
      get_matchup: { Args: never; Returns: Json }
      get_my_stats: { Args: never; Returns: Json }
      get_nods_received: { Args: { p_user?: string }; Returns: Json }
      get_notification_prefs: { Args: never; Returns: Json }
      get_photo_view_count: {
        Args: { p_submission_id: string }
        Returns: number
      }
      get_profile: { Args: { p_user?: string }; Returns: Json }
      get_shot_count_today: { Args: never; Returns: number }
      get_studio: { Args: never; Returns: Json }
      get_studio_challenge: { Args: never; Returns: Json }
      get_studio_members: { Args: never; Returns: Json }
      get_today_golden: { Args: never; Returns: boolean }
      get_today_hint: { Args: never; Returns: string }
      get_user_badges: { Args: { p_user: string }; Returns: Json }
      get_weekly_recap: { Args: { p_user_id: string }; Returns: Json }
      has_badge: { Args: { p_badge: string; p_user: string }; Returns: boolean }
      in_quiet_hours: {
        Args: { p_qe: string; p_qs: string; p_tz: string }
        Returns: boolean
      }
      is_admin: { Args: { p_uid?: string }; Returns: boolean }
      is_live_drop_thumb: { Args: { object_name: string }; Returns: boolean }
      is_studio_challenge_participant: {
        Args: { p_challenge_id: string }
        Returns: boolean
      }
      join_studio_by_code: { Args: { p_code: string }; Returns: Json }
      leave_studio: { Args: never; Returns: Json }
      mark_activity_seen: { Args: never; Returns: undefined }
      notify_appreciation: { Args: never; Returns: Json }
      notify_pending: { Args: never; Returns: Json }
      nudge_studio_director: { Args: never; Returns: Json }
      photo_frame: { Args: { p_date: string }; Returns: string }
      photo_status: {
        Args: { p_is_potd: boolean; p_rank: number }
        Returns: string
      }
      quarantine_if_flagged: {
        Args: { p_label: string; p_score: number; p_submission: string }
        Returns: Json
      }
      record_appreciation: {
        Args: { p_actor: string; p_submission: string }
        Returns: undefined
      }
      record_studio_challenge_photo: {
        Args: {
          p_challenge_id: string
          p_image_path: string
          p_thumb_path: string
        }
        Returns: Json
      }
      remove_studio_member: { Args: { p_user: string }; Returns: Json }
      rename_studio: { Args: { p_name: string }; Returns: Json }
      report_submission: {
        Args: { p_reason: string; p_submission: string }
        Returns: Json
      }
      resolve_username: { Args: { p_username: string }; Returns: string }
      search_users: { Args: { p_query: string }; Returns: Json }
      send_push: {
        Args: {
          p_body: string
          p_category?: string
          p_data?: Json
          p_region?: string
          p_title: string
          p_user_ids?: string[]
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_studio_challenge: {
        Args: { p_duration_hours: number; p_theme: string }
        Returns: Json
      }
      streak_window_start: {
        Args: { p_as_of: string; p_uid: string }
        Returns: string
      }
      submit_nod: {
        Args: { p_submission: string; p_tag: string }
        Returns: undefined
      }
      toggle_blur_sensitive: { Args: never; Returns: Json }
      toggle_star: { Args: { p_id: string; p_type: string }; Returns: Json }
      toggle_studio_challenge_heart: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      track_photo_view: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      update_notification_prefs: {
        Args: {
          p_appreciation: boolean
          p_daily: boolean
          p_quiet: boolean
          p_results: boolean
          p_social: boolean
          p_wins: boolean
        }
        Returns: undefined
      }
      username_available: { Args: { p_username: string }; Returns: boolean }
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

