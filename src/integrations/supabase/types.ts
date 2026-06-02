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
      activites_utilisateurs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          temple_id: string | null
          type_action: string
          utilisateur_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          temple_id?: string | null
          type_action: string
          utilisateur_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          temple_id?: string | null
          type_action?: string
          utilisateur_id?: string | null
        }
        Relationships: []
      }
      cultes: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          depenses: number | null
          dimes: number | null
          heure_debut: string | null
          heure_fin: string | null
          id: string
          notes_finances: string | null
          offrandes: number | null
          orateur: string | null
          president: string | null
          responsable_priere: string | null
          solde_caisse: number | null
          statut: Database["public"]["Enums"]["culte_statut"]
          temple_id: string
          theme_presidence: string | null
          theme_principal: string | null
          type_culte: Database["public"]["Enums"]["culte_type"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          versets: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          depenses?: number | null
          dimes?: number | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          notes_finances?: string | null
          offrandes?: number | null
          orateur?: string | null
          president?: string | null
          responsable_priere?: string | null
          solde_caisse?: number | null
          statut?: Database["public"]["Enums"]["culte_statut"]
          temple_id: string
          theme_presidence?: string | null
          theme_principal?: string | null
          type_culte: Database["public"]["Enums"]["culte_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          versets?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          depenses?: number | null
          dimes?: number | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          notes_finances?: string | null
          offrandes?: number | null
          orateur?: string | null
          president?: string | null
          responsable_priere?: string | null
          solde_caisse?: number | null
          statut?: Database["public"]["Enums"]["culte_statut"]
          temple_id?: string
          theme_presidence?: string | null
          theme_principal?: string | null
          type_culte?: Database["public"]["Enums"]["culte_type"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
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
      finances_culte: {
        Row: {
          action_grace: number
          contribution_speciale: number
          created_at: string
          created_by: string | null
          culte_id: string
          depense: number
          dime: number
          id: string
          observation: string | null
          offrande: number
          semence: number
          solde: number
          updated_at: string
        }
        Insert: {
          action_grace?: number
          contribution_speciale?: number
          created_at?: string
          created_by?: string | null
          culte_id: string
          depense?: number
          dime?: number
          id?: string
          observation?: string | null
          offrande?: number
          semence?: number
          solde?: number
          updated_at?: string
        }
        Update: {
          action_grace?: number
          contribution_speciale?: number
          created_at?: string
          created_by?: string | null
          culte_id?: string
          depense?: number
          dime?: number
          id?: string
          observation?: string | null
          offrande?: number
          semence?: number
          solde?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finances_culte_culte_id_fkey"
            columns: ["culte_id"]
            isOneToOne: true
            referencedRelation: "cultes"
            referencedColumns: ["id"]
          },
        ]
      }
      historique_modifications: {
        Row: {
          action: string
          ancienne_valeur: string | null
          champ: string | null
          date_modification: string
          enregistrement_id: string | null
          id: string
          nouvelle_valeur: string | null
          table_modifiee: string
          utilisateur_id: string | null
        }
        Insert: {
          action?: string
          ancienne_valeur?: string | null
          champ?: string | null
          date_modification?: string
          enregistrement_id?: string | null
          id?: string
          nouvelle_valeur?: string | null
          table_modifiee: string
          utilisateur_id?: string | null
        }
        Update: {
          action?: string
          ancienne_valeur?: string | null
          champ?: string | null
          date_modification?: string
          enregistrement_id?: string | null
          id?: string
          nouvelle_valeur?: string | null
          table_modifiee?: string
          utilisateur_id?: string | null
        }
        Relationships: []
      }
      membres: {
        Row: {
          actif: boolean
          adresse: string | null
          categorie: Database["public"]["Enums"]["membre_categorie"]
          created_at: string
          date_ajout: string
          date_entree: string | null
          date_naissance: string | null
          email: string | null
          entreprise: string | null
          id: string
          nom: string
          prenoms: string
          profession: string | null
          secteur_activite: string | null
          sexe: Database["public"]["Enums"]["sexe"] | null
          telephone: string | null
          temple_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          categorie: Database["public"]["Enums"]["membre_categorie"]
          created_at?: string
          date_ajout?: string
          date_entree?: string | null
          date_naissance?: string | null
          email?: string | null
          entreprise?: string | null
          id?: string
          nom: string
          prenoms: string
          profession?: string | null
          secteur_activite?: string | null
          sexe?: Database["public"]["Enums"]["sexe"] | null
          telephone?: string | null
          temple_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          categorie?: Database["public"]["Enums"]["membre_categorie"]
          created_at?: string
          date_ajout?: string
          date_entree?: string | null
          date_naissance?: string | null
          email?: string | null
          entreprise?: string | null
          id?: string
          nom?: string
          prenoms?: string
          profession?: string | null
          secteur_activite?: string | null
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
          actif: boolean
          created_at: string
          derniere_connexion: string | null
          email: string | null
          id: string
          nom: string | null
          temple_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          derniere_connexion?: string | null
          email?: string | null
          id: string
          nom?: string | null
          temple_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          derniere_connexion?: string | null
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
      role_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
          temple_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string
          temple_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string
          temple_id?: string | null
        }
        Relationships: []
      }
      temples: {
        Row: {
          actif: boolean
          commune: string | null
          couleur_primaire: string | null
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
          actif?: boolean
          commune?: string | null
          couleur_primaire?: string | null
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
          actif?: boolean
          commune?: string | null
          couleur_primaire?: string | null
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
      can_access_temple: {
        Args: { _temple_id: string; _user_id: string }
        Returns: boolean
      }
      current_user_temple_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_principal: { Args: { _user_id: string }; Returns: boolean }
      is_super: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin_temple"
        | "utilisateur"
        | "super_admin_principal"
      culte_statut: "brouillon" | "valide" | "corrige_admin"
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
      app_role: [
        "super_admin",
        "admin_temple",
        "utilisateur",
        "super_admin_principal",
      ],
      culte_statut: ["brouillon", "valide", "corrige_admin"],
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
