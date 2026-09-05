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
      bootstrap_admins: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          key: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          key?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      comment_mentions: {
        Row: {
          comment_id: string
          mentioned_profile_id: string
        }
        Insert: {
          comment_id: string
          mentioned_profile_id: string
        }
        Update: {
          comment_id?: string
          mentioned_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_mentioned_profile_id_fkey"
            columns: ["mentioned_profile_id"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "comment_mentions_mentioned_profile_id_fkey"
            columns: ["mentioned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string
          dry_run: boolean
          filename: string | null
          id: string
          payload: Json
          summary: Json
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          dry_run?: boolean
          filename?: string | null
          id?: string
          payload: Json
          summary?: Json
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          dry_run?: boolean
          filename?: string | null
          id?: string
          payload?: Json
          summary?: Json
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          color: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          title: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          color: string
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          title?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          color?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          from_value: string | null
          id: string
          metadata: Json
          task_id: string
          to_value: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json
          task_id: string
          to_value?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_value?: string | null
          id?: string
          metadata?: Json
          task_id?: string
          to_value?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          profile_id: string
          task_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          profile_id: string
          task_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "task_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          parent_comment_id: string | null
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          category_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimate_hours: number | null
          id: string
          key: string
          note: string | null
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          start_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          category_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          key: string
          note?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          category_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimate_hours?: number | null
          id?: string
          key?: string
          note?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      category_progress: {
        Row: {
          category_id: string | null
          color: string | null
          done: number | null
          in_flight: number | null
          key: string | null
          name: string | null
          pct: number | null
          position: number | null
          todo: number | null
          total: number | null
        }
        Relationships: []
      }
      person_progress: {
        Row: {
          color: string | null
          done: number | null
          email: string | null
          full_name: string | null
          in_flight: number | null
          profile_id: string | null
          title: string | null
          todo: number | null
          total: number | null
        }
        Relationships: []
      }
      project_progress: {
        Row: {
          done: number | null
          in_flight: number | null
          pct: number | null
          todo: number | null
          total: number | null
        }
        Relationships: []
      }
      task_dependency_state: {
        Row: {
          blocked_by_keys: string[] | null
          dep_count: number | null
          task_id: string | null
          unmet_count: number | null
        }
        Relationships: []
      }
      v_tasks: {
        Row: {
          actual_hours: number | null
          blocked_by_keys: string[] | null
          blocks_count: number | null
          category_color: string | null
          category_id: string | null
          category_key: string | null
          category_name: string | null
          child_count: number | null
          child_done_count: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          dep_count: number | null
          description: string | null
          due_date: string | null
          estimate_hours: number | null
          id: string | null
          is_blocked: boolean | null
          key: string | null
          note: string | null
          parent_key: string | null
          parent_task_id: string | null
          position: number | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          start_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string | null
          unmet_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_progress"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person_progress"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "task_dependency_state"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "v_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_member: {
        Args: {
          p_profile_id: string
          p_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: undefined
      }
      import_workspace: {
        Args: { p_filename?: string; p_payload: Json }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      preview_import: { Args: { p_payload: Json }; Returns: Json }
      reject_member: { Args: { p_profile_id: string }; Returns: undefined }
      set_member_color: {
        Args: { p_color: string; p_profile_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_profile_id: string
          p_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: undefined
      }
      set_task_position: {
        Args: { p_position: number; p_task_id: string }
        Returns: undefined
      }
      set_task_status: {
        Args: {
          p_status: Database["public"]["Enums"]["task_status"]
          p_task_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_type:
        | "created"
        | "status_changed"
        | "assignee_added"
        | "assignee_removed"
        | "dependency_added"
        | "dependency_removed"
        | "note_updated"
        | "category_changed"
        | "priority_changed"
        | "parent_changed"
        | "imported"
      notification_type:
        | "access_request"
        | "access_approved"
        | "access_rejected"
        | "task_assigned"
        | "task_unassigned"
        | "mention"
        | "comment"
        | "status_changed"
        | "task_unblocked"
      profile_status: "pending" | "approved" | "rejected" | "suspended"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status: "todo" | "in_progress" | "in_review" | "done" | "cancelled"
      user_role: "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {
      activity_type: [
        "created",
        "status_changed",
        "assignee_added",
        "assignee_removed",
        "dependency_added",
        "dependency_removed",
        "note_updated",
        "category_changed",
        "priority_changed",
        "parent_changed",
        "imported",
      ],
      notification_type: [
        "access_request",
        "access_approved",
        "access_rejected",
        "task_assigned",
        "task_unassigned",
        "mention",
        "comment",
        "status_changed",
        "task_unblocked",
      ],
      profile_status: ["pending", "approved", "rejected", "suspended"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["todo", "in_progress", "in_review", "done", "cancelled"],
      user_role: ["admin", "member"],
    },
  },
} as const
