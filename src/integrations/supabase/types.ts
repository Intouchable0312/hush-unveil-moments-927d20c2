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
      bans: {
        Row: {
          banned_by: string | null
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_settings: {
        Row: {
          allow_photos_from_other: boolean
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_photos_from_other?: boolean
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_photos_from_other?: boolean
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          creator_id: string
          fan_id: string
          id: string
          last_message_at: string
        }
        Insert: {
          creator_id: string
          fan_id: string
          id?: string
          last_message_at?: string
        }
        Update: {
          creator_id?: string
          fan_id?: string
          id?: string
          last_message_at?: string
        }
        Relationships: []
      }
      message_media_purchases: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          id: string
          message_id: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string
          id?: string
          message_id: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          id?: string
          message_id?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_media_purchases_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          ppv_price_cents: number
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          ppv_price_cents?: number
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          ppv_price_cents?: number
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_purchases: {
        Row: {
          amount_cents: number
          buyer_id: string
          created_at: string
          id: string
          post_id: string
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          created_at?: string
          id?: string
          post_id: string
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          created_at?: string
          id?: string
          post_id?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_purchases_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          hashtags: string[]
          id: string
          likes_count: number
          media_type: string
          media_url: string
          ppv_price_cents: number
          visibility: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          hashtags?: string[]
          id?: string
          likes_count?: number
          media_type?: string
          media_url: string
          ppv_price_cents?: number
          visibility?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          hashtags?: string[]
          id?: string
          likes_count?: number
          media_type?: string
          media_url?: string
          ppv_price_cents?: number
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allow_fan_photos: boolean
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          first_name: string | null
          hashtags: string[]
          id: string
          is_ambassador: boolean
          is_creator: boolean
          last_name: string | null
          phone: string | null
          stripe_account_id: string | null
          theme: string
          updated_at: string
          username: string | null
        }
        Insert: {
          allow_fan_photos?: boolean
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          first_name?: string | null
          hashtags?: string[]
          id: string
          is_ambassador?: boolean
          is_creator?: boolean
          last_name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          theme?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          allow_fan_photos?: boolean
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          first_name?: string | null
          hashtags?: string[]
          id?: string
          is_ambassador?: boolean
          is_creator?: boolean
          last_name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          theme?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          creator_id: string
          currency: string
          id: string
          price_monthly_cents: number
          price_quarterly_cents: number
          price_yearly_cents: number
          updated_at: string
        }
        Insert: {
          creator_id: string
          currency?: string
          id?: string
          price_monthly_cents?: number
          price_quarterly_cents?: number
          price_yearly_cents?: number
          updated_at?: string
        }
        Update: {
          creator_id?: string
          currency?: string
          id?: string
          price_monthly_cents?: number
          price_quarterly_cents?: number
          price_yearly_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean
          creator_id: string
          expires_at: string
          fan_id: string
          id: string
          period: string
          price_paid_cents: number
          started_at: string
          stripe_session_id: string | null
        }
        Insert: {
          active?: boolean
          creator_id: string
          expires_at: string
          fan_id: string
          id?: string
          period: string
          price_paid_cents?: number
          started_at?: string
          stripe_session_id?: string | null
        }
        Update: {
          active?: boolean
          creator_id?: string
          expires_at?: string
          fan_id?: string
          id?: string
          period?: string
          price_paid_cents?: number
          started_at?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          allow_fan_photos: boolean
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          first_name: string | null
          hashtags: string[]
          id: string
          is_ambassador: boolean
          is_creator: boolean
          last_name: string | null
          phone: string | null
          stripe_account_id: string | null
          theme: string
          updated_at: string
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_overview_stats: { Args: never; Returns: Json }
      admin_recent_purchases: {
        Args: { _limit?: number }
        Returns: {
          amount_cents: number
          at: string
          buyer: string
          kind: string
          ref: string
          seller: string
        }[]
      }
      admin_top_creators: {
        Args: { _limit?: number }
        Returns: {
          id: string
          posts: number
          revenue_cents: number
          subscribers: number
          username: string
        }[]
      }
      admin_user_stats: { Args: { _uid: string }; Returns: Json }
      can_read_media_object: {
        Args: { _object_name: string }
        Returns: boolean
      }
      find_conversation: { Args: { _a: string; _b: string }; Returns: string }
      get_or_create_conversation: { Args: { _other: string }; Returns: string }
      get_own_profile: {
        Args: never
        Returns: {
          allow_fan_photos: boolean
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          first_name: string | null
          hashtags: string[]
          id: string
          is_ambassador: boolean
          is_creator: boolean
          last_name: string | null
          phone: string | null
          stripe_account_id: string | null
          theme: string
          updated_at: string
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_purchased_post: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_post_creator: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      is_subscribed: {
        Args: { _creator: string; _fan: string }
        Returns: boolean
      }
      list_my_conversations: {
        Args: { _user?: string }
        Returns: {
          id: string
          last_body: string
          last_has_media: boolean
          last_message_at: string
          other_avatar_url: string
          other_id: string
          other_is_ambassador: boolean
          other_is_creator: boolean
          other_username: string
          unread: number
        }[]
      }
      unread_messages_count: { Args: { _user?: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
