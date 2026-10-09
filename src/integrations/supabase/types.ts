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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      dungeon_events: {
        Row: {
          effect: string
          id: string
          template_id: string
          text: string
          threshold: number
        }
        Insert: {
          effect: string
          id?: string
          template_id: string
          text: string
          threshold: number
        }
        Update: {
          effect?: string
          id?: string
          template_id?: string
          text?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "dungeon_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dungeon_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dungeon_room_enemies: {
        Row: {
          enemy_catalog_id: string
          hidden: boolean
          id: string
          room_id: string
          trigger: string
        }
        Insert: {
          enemy_catalog_id: string
          hidden?: boolean
          id?: string
          room_id: string
          trigger?: string
        }
        Update: {
          enemy_catalog_id?: string
          hidden?: boolean
          id?: string
          room_id?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "dungeon_room_enemies_enemy_catalog_id_fkey"
            columns: ["enemy_catalog_id"]
            isOneToOne: false
            referencedRelation: "enemy_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dungeon_room_enemies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "dungeon_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      dungeon_room_treasures: {
        Row: {
          container: string
          id: string
          per_player: boolean
          room_id: string
          treasure_catalog_id: string
        }
        Insert: {
          container?: string
          id?: string
          per_player?: boolean
          room_id: string
          treasure_catalog_id: string
        }
        Update: {
          container?: string
          id?: string
          per_player?: boolean
          room_id?: string
          treasure_catalog_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dungeon_room_treasures_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "dungeon_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dungeon_room_treasures_treasure_catalog_id_fkey"
            columns: ["treasure_catalog_id"]
            isOneToOne: false
            referencedRelation: "treasure_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      dungeon_rooms: {
        Row: {
          connections: string[]
          description: string
          features: Json
          grid_x: number
          grid_y: number
          hazard: string | null
          hazard_kind: string | null
          id: string
          is_rest: boolean
          key: string
          lore: string
          name: string
          position: number
          template_id: string
        }
        Insert: {
          connections?: string[]
          description?: string
          features?: Json
          grid_x?: number
          grid_y?: number
          hazard?: string | null
          hazard_kind?: string | null
          id?: string
          is_rest?: boolean
          key: string
          lore?: string
          name: string
          position: number
          template_id: string
        }
        Update: {
          connections?: string[]
          description?: string
          features?: Json
          grid_x?: number
          grid_y?: number
          hazard?: string | null
          hazard_kind?: string | null
          id?: string
          is_rest?: boolean
          key?: string
          lore?: string
          name?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dungeon_rooms_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dungeon_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dungeon_templates: {
        Row: {
          created_at: string
          difficulty: string
          difficulty_label: string
          duration: number
          fixed_treasure: string
          id: string
          map_key: string
          map_type: string
          mechanic: string
          name: string
          objective_text: string
          objective_type: string
          position: number
          random_treasure: string
          slug: string
          solo: boolean
          story: string
          summary: string
          target_turns: number
          tension_thresholds: number[]
        }
        Insert: {
          created_at?: string
          difficulty: string
          difficulty_label?: string
          duration: number
          fixed_treasure?: string
          id?: string
          map_key: string
          map_type: string
          mechanic?: string
          name: string
          objective_text: string
          objective_type: string
          position?: number
          random_treasure?: string
          slug: string
          solo?: boolean
          story: string
          summary: string
          target_turns?: number
          tension_thresholds?: number[]
        }
        Update: {
          created_at?: string
          difficulty?: string
          difficulty_label?: string
          duration?: number
          fixed_treasure?: string
          id?: string
          map_key?: string
          map_type?: string
          mechanic?: string
          name?: string
          objective_text?: string
          objective_type?: string
          position?: number
          random_treasure?: string
          slug?: string
          solo?: boolean
          story?: string
          summary?: string
          target_turns?: number
          tension_thresholds?: number[]
        }
        Relationships: []
      }
      enemy_catalog: {
        Row: {
          ability: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          endurance: number
          game_id: string | null
          hp: number | null
          icon: string
          id: string
          name: string
          speed: number
          strength: number
          threat_cost: number
        }
        Insert: {
          ability?: string
          category: string
          created_at?: string
          created_by?: string | null
          description?: string
          endurance: number
          game_id?: string | null
          hp?: number | null
          icon?: string
          id?: string
          name: string
          speed: number
          strength: number
          threat_cost: number
        }
        Update: {
          ability?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          endurance?: number
          game_id?: string | null
          hp?: number | null
          icon?: string
          id?: string
          name?: string
          speed?: number
          strength?: number
          threat_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "enemy_catalog_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_entities: {
        Row: {
          active: boolean
          created_at: string
          hp: number | null
          id: string
          kind: string
          label: string
          locked: boolean
          session_id: string
          tile_x: number
          tile_y: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          hp?: number | null
          id?: string
          kind: string
          label: string
          locked?: boolean
          session_id: string
          tile_x: number
          tile_y: number
        }
        Update: {
          active?: boolean
          created_at?: string
          hp?: number | null
          id?: string
          kind?: string
          label?: string
          locked?: boolean
          session_id?: string
          tile_x?: number
          tile_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "exploration_entities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exploration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          message: string
          payload: Json
          session_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          message: string
          payload?: Json
          session_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          message?: string
          payload?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exploration_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exploration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_players: {
        Row: {
          client_key: string
          hp: number
          id: string
          name: string
          race: string
          session_id: string
          tile_x: number
          tile_y: number
          updated_at: string
        }
        Insert: {
          client_key: string
          hp?: number
          id?: string
          name?: string
          race?: string
          session_id: string
          tile_x?: number
          tile_y?: number
          updated_at?: string
        }
        Update: {
          client_key?: string
          hp?: number
          id?: string
          name?: string
          race?: string
          session_id?: string
          tile_x?: number
          tile_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exploration_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exploration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_saves: {
        Row: {
          created_at: string
          id: string
          label: string
          session_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          session_id: string
          snapshot?: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          session_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exploration_saves_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exploration_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exploration_sessions: {
        Row: {
          created_at: string
          id: string
          map_key: string
          name: string
          objective: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          map_key?: string
          name: string
          objective: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          map_key?: string
          name?: string
          objective?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      game_ambience: {
        Row: {
          game_id: string
          loop: boolean
          sfx: string | null
          sfx_at: string | null
          state: string
          track: string
          updated_at: string
          updated_by: string | null
          volume: number
        }
        Insert: {
          game_id: string
          loop?: boolean
          sfx?: string | null
          sfx_at?: string | null
          state?: string
          track?: string
          updated_at?: string
          updated_by?: string | null
          volume?: number
        }
        Update: {
          game_id?: string
          loop?: boolean
          sfx?: string | null
          sfx_at?: string | null
          state?: string
          track?: string
          updated_at?: string
          updated_by?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_ambience_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_dungeon_events: {
        Row: {
          effect: string
          game_id: string
          id: string
          status: string
          text: string
          threshold: number
          triggered_at: string | null
        }
        Insert: {
          effect: string
          game_id: string
          id?: string
          status?: string
          text: string
          threshold: number
          triggered_at?: string | null
        }
        Update: {
          effect?: string
          game_id?: string
          id?: string
          status?: string
          text?: string
          threshold?: number
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_dungeon_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_dungeons: {
        Row: {
          core_taken: boolean
          current_room: string
          current_turn: number
          door_locked: boolean
          explored: string[]
          game_id: string
          id: string
          status: string
          template_id: string
          tension: number
          updated_at: string
        }
        Insert: {
          core_taken?: boolean
          current_room: string
          current_turn?: number
          door_locked?: boolean
          explored?: string[]
          game_id: string
          id?: string
          status?: string
          template_id: string
          tension?: number
          updated_at?: string
        }
        Update: {
          core_taken?: boolean
          current_room?: string
          current_turn?: number
          door_locked?: boolean
          explored?: string[]
          game_id?: string
          id?: string
          status?: string
          template_id?: string
          tension?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_dungeons_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_dungeons_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dungeon_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      game_enemies: {
        Row: {
          ability: string
          catalog_id: string | null
          category: string
          created_at: string
          endurance: number
          game_id: string
          hp: number
          icon: string
          id: string
          max_hp: number
          name: string
          overheated: boolean
          revealed_at: string | null
          speed: number
          status: string
          strength: number
          threat_cost: number
          trigger: string
          zone: string
        }
        Insert: {
          ability?: string
          catalog_id?: string | null
          category: string
          created_at?: string
          endurance: number
          game_id: string
          hp: number
          icon?: string
          id?: string
          max_hp: number
          name: string
          overheated?: boolean
          revealed_at?: string | null
          speed: number
          status?: string
          strength: number
          threat_cost: number
          trigger?: string
          zone: string
        }
        Update: {
          ability?: string
          catalog_id?: string | null
          category?: string
          created_at?: string
          endurance?: number
          game_id?: string
          hp?: number
          icon?: string
          id?: string
          max_hp?: number
          name?: string
          overheated?: boolean
          revealed_at?: string | null
          speed?: number
          status?: string
          strength?: number
          threat_cost?: number
          trigger?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_enemies_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "enemy_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_enemies_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          actor_id: string | null
          created_at: string
          game_id: string
          id: number
          important: boolean
          kind: string
          message: string
          payload: Json
          secret: boolean
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          game_id: string
          id?: never
          important?: boolean
          kind: string
          message: string
          payload?: Json
          secret?: boolean
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          game_id?: string
          id?: never
          important?: boolean
          kind?: string
          message?: string
          payload?: Json
          secret?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_hidden_enemies: {
        Row: {
          created_at: string
          game_id: string
          hp: number
          id: string
          label: string
          notes: string
          revealed: boolean
        }
        Insert: {
          created_at?: string
          game_id: string
          hp?: number
          id?: string
          label: string
          notes?: string
          revealed?: boolean
        }
        Update: {
          created_at?: string
          game_id?: string
          hp?: number
          id?: string
          label?: string
          notes?: string
          revealed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "game_hidden_enemies_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_inventory: {
        Row: {
          category: string
          created_at: string
          effect: string
          equipped: boolean
          game_id: string
          id: string
          name: string
          owner_id: string
          quantity: number
          rarity: string
        }
        Insert: {
          category: string
          created_at?: string
          effect?: string
          equipped?: boolean
          game_id: string
          id?: string
          name: string
          owner_id: string
          quantity?: number
          rarity?: string
        }
        Update: {
          category?: string
          created_at?: string
          effect?: string
          equipped?: boolean
          game_id?: string
          id?: string
          name?: string
          owner_id?: string
          quantity?: number
          rarity?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_inventory_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_messages: {
        Row: {
          author_name: string
          body: string
          created_at: string
          game_id: string
          id: string
          recipient_id: string | null
          user_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          game_id: string
          id?: string
          recipient_id?: string | null
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          game_id?: string
          id?: string
          recipient_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          current_zone: string
          display_name: string
          endurance: number
          game_id: string
          hp: number
          id: string
          joined_at: string
          max_hp: number
          race: string
          role: string
          speed: number
          strength: number
          user_id: string
        }
        Insert: {
          current_zone?: string
          display_name: string
          endurance?: number
          game_id: string
          hp?: number
          id?: string
          joined_at?: string
          max_hp?: number
          race?: string
          role?: string
          speed?: number
          strength?: number
          user_id: string
        }
        Update: {
          current_zone?: string
          display_name?: string
          endurance?: number
          game_id?: string
          hp?: number
          id?: string
          joined_at?: string
          max_hp?: number
          race?: string
          role?: string
          speed?: number
          strength?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_secrets: {
        Row: {
          game_id: string
          password_hash: string
        }
        Insert: {
          game_id: string
          password_hash: string
        }
        Update: {
          game_id?: string
          password_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_secrets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_treasures: {
        Row: {
          catalog_id: string | null
          created_at: string
          effect: string
          enemy_id: string | null
          found_at: string | null
          found_by: string | null
          game_id: string
          id: string
          name: string
          placement: string
          rarity: string
          status: string
          type: string
          value: number
          zone: string | null
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          effect?: string
          enemy_id?: string | null
          found_at?: string | null
          found_by?: string | null
          game_id: string
          id?: string
          name: string
          placement: string
          rarity: string
          status?: string
          type: string
          value?: number
          zone?: string | null
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          effect?: string
          enemy_id?: string | null
          found_at?: string | null
          found_by?: string | null
          game_id?: string
          id?: string
          name?: string
          placement?: string
          rarity?: string
          status?: string
          type?: string
          value?: number
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_treasures_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "treasure_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_treasures_enemy_id_fkey"
            columns: ["enemy_id"]
            isOneToOne: false
            referencedRelation: "game_enemies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_treasures_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          code: string
          created_at: string
          created_by: string
          ended_at: string | null
          has_password: boolean
          id: string
          locked: boolean
          max_players: number
          name: string
          result: string | null
          scenario: string
          solo: boolean
          started_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          ended_at?: string | null
          has_password?: boolean
          id?: string
          locked?: boolean
          max_players: number
          name: string
          result?: string | null
          scenario: string
          solo?: boolean
          started_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          has_password?: boolean
          id?: string
          locked?: boolean
          max_players?: number
          name?: string
          result?: string | null
          scenario?: string
          solo?: boolean
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      narrator_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          game_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          game_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          game_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrator_notes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      player_reports: {
        Row: {
          created_at: string
          game_id: string
          id: string
          reason: string
          reported_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_reports_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      treasure_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          effect: string
          game_id: string | null
          id: string
          name: string
          rarity: string
          type: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          effect?: string
          game_id?: string | null
          id?: string
          name: string
          rarity: string
          type: string
          value?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          effect?: string
          game_id?: string | null
          id?: string
          name?: string
          rarity?: string
          type?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "treasure_catalog_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_game_member: { Args: { _game_id: string }; Returns: boolean }
      is_game_narrator: { Args: { _game_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
