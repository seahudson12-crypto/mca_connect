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
      cultes: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          heure_debut: string | null
          heure_fin: string | null
          id: string
          orateur: string | null
          president: string | null
          responsable_priere: string | null
          temple_id: string
          theme_presidence: string | null
          theme_principal: string | null
          type_culte: Database["public"]["Enums"]["culte_type"]
          updated_at: string
          versets: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          orateur?: string | null
          president?: string | null
          responsable_priere?: string | null
          temple_id: string
          theme_presidence?: string | null
          theme_principal?: string | null
          type_culte: Database["public"]["Enums"]["culte_type"]
          updated_at?: string
          versets?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          orateur?: string | null
          president?: string | null
          responsable_priere?: string | null
          temple_id?: string
          theme_presidence?: string | null
          theme_principal?: string | null
          type_culte?: Database["public"]["Enums"]["culte_type"]
          updated_at?: string
          versets?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cultes_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
        ]
      }
      membres: {
        Row: {
          actif: boolean
          categorie: Database["public"]["Enums"]["membre_categorie"]
          created_at: string
          date_ajout: string
          id: string
          nom: string
          prenoms: string
          sexe: Database["public"]["Enums"]["sexe"] | null
          telephone: string | null
          temple_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          actif?: boolean
          categorie: Database["public"]["Enums"]["membre_categorie"]
          created_at?: string
          date_ajout?: string
          id?: string
          nom: string
          prenoms: string
          sexe?: Database["public"]["Enums"]["sexe"] | null
          telephone?: string | null
          temple_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          actif?: boolean
          categorie?: Database["public"]["Enums"]["membre_categorie"]
          created_at?: string
          date_ajout?: string
          id?: string
          nom?: string
          prenoms?: string
          sexe?: Database["public"]["Enums"]["sexe"] | null
          telephone?: string | null
          temple_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membres_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
        ]
      }
      presences: {
        Row: {
          created_at: string
          culte_id: string
          id: string
          membre_id: string
          statut: Database["public"]["Enums"]["presence_statut"]
        }
        Insert: {
          created_at?: string
          culte_id: string
          id?: string
          membre_id: string
          statut?: Database["public"]["Enums"]["presence_statut"]
        }
        Update: {
          created_at?: string
          culte_id?: string
          id?: string
          membre_id?: string
          statut?: Database["public"]["Enums"]["presence_statut"]
        }
        Relationships: [
          {
            foreignKeyName: "presences_culte_id_fkey"
            columns: ["culte_id"]
            isOneToOne: false
            referencedRelation: "cultes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presences_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nom: string | null
          temple_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nom?: string | null
          temple_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nom?: string | null
          temple_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
        ]
      }
      temples: {
        Row: {
          commune: string | null
          created_at: string
          email: string | null
          id: string
          logo: string | null
          nom_temple: string
          pasteur_responsable: string | null
          pays: string | null
          telephone: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          commune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo?: string | null
          nom_temple: string
          pasteur_responsable?: string | null
          pays?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          commune?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo?: string | null
          nom_temple?: string
          pasteur_responsable?: string | null
          pays?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          temple_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          temple_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          temple_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin_temple" | "utilisateur"
      culte_type:
        | "dimanche"
        | "semaine"
        | "veillee"
        | "reunion_speciale"
        | "jeune_priere"
      membre_categorie:
        | "hommes_adultes"
        | "femmes_adultes"
        | "jeunes_hommes"
        | "jeunes_filles"
        | "groupe_musical"
        | "ecodim"
        | "moniteurs"
        | "appeles"
        | "serviteurs_de_dieu"
        | "nouvelles_ames"
        | "pasteurs"
      presence_statut: "present" | "absent" | "excuse"
      sexe: "M" | "F"
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
      app_role: ["super_admin", "admin_temple", "utilisateur"],
      culte_type: [
        "dimanche",
        "semaine",
        "veillee",
        "reunion_speciale",
        "jeune_priere",
      ],
      membre_categorie: [
        "hommes_adultes",
        "femmes_adultes",
        "jeunes_hommes",
        "jeunes_filles",
        "groupe_musical",
        "ecodim",
        "moniteurs",
        "appeles",
        "serviteurs_de_dieu",
        "nouvelles_ames",
        "pasteurs",
      ],
      presence_statut: ["present", "absent", "excuse"],
      sexe: ["M", "F"],
    },
  },
} as const
