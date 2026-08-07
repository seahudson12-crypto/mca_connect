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
          priere_intense_active: boolean
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
          priere_intense_active?: boolean
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
          priere_intense_active?: boolean
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
          {
            foreignKeyName: "cultes_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements: {
        Row: {
          all_day: boolean
          couleur: string | null
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string | null
          description: string | null
          id: string
          lieu: string | null
          temple_id: string | null
          titre: string
          type_evenement: Database["public"]["Enums"]["evenement_type"]
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin?: string | null
          description?: string | null
          id?: string
          lieu?: string | null
          temple_id?: string | null
          titre: string
          type_evenement?: Database["public"]["Enums"]["evenement_type"]
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          description?: string | null
          id?: string
          lieu?: string | null
          temple_id?: string | null
          titre?: string
          type_evenement?: Database["public"]["Enums"]["evenement_type"]
          updated_at?: string
        }
        Relationships: []
      }
      familles: {
        Row: {
          adresse: string | null
          created_at: string
          created_by: string | null
          id: string
          nom_famille: string
          notes: string | null
          telephone_principal: string | null
          telephone_secondaire: string | null
          temple_id: string
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nom_famille: string
          notes?: string | null
          telephone_principal?: string | null
          telephone_secondaire?: string | null
          temple_id: string
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nom_famille?: string
          notes?: string | null
          telephone_principal?: string | null
          telephone_secondaire?: string | null
          temple_id?: string
          updated_at?: string
        }
        Relationships: []
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
      inscriptions_formation: {
        Row: {
          created_at: string
          date_completion: string | null
          date_inscription: string
          id: string
          membre_id: string
          notes: string | null
          programme_id: string
          progression: number
          statut: Database["public"]["Enums"]["formation_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_completion?: string | null
          date_inscription?: string
          id?: string
          membre_id: string
          notes?: string | null
          programme_id: string
          progression?: number
          statut?: Database["public"]["Enums"]["formation_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_completion?: string | null
          date_inscription?: string
          id?: string
          membre_id?: string
          notes?: string | null
          programme_id?: string
          progression?: number
          statut?: Database["public"]["Enums"]["formation_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscriptions_formation_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes_formation"
            referencedColumns: ["id"]
          },
        ]
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
          famille_id: string | null
          id: string
          matricule: string | null
          nom: string
          observations: string | null
          photo_url: string | null
          prenoms: string
          profession: string | null
          role_famille: Database["public"]["Enums"]["role_famille"] | null
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
          famille_id?: string | null
          id?: string
          matricule?: string | null
          nom: string
          observations?: string | null
          photo_url?: string | null
          prenoms: string
          profession?: string | null
          role_famille?: Database["public"]["Enums"]["role_famille"] | null
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
          famille_id?: string | null
          id?: string
          matricule?: string | null
          nom?: string
          observations?: string | null
          photo_url?: string | null
          prenoms?: string
          profession?: string | null
          role_famille?: Database["public"]["Enums"]["role_famille"] | null
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
          {
            foreignKeyName: "membres_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      objectifs_temple: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          id: string
          libelle: string | null
          notes: string | null
          temple_id: string
          type_objectif: Database["public"]["Enums"]["objectif_type"]
          updated_at: string
          valeur_cible: number
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          id?: string
          libelle?: string | null
          notes?: string | null
          temple_id: string
          type_objectif: Database["public"]["Enums"]["objectif_type"]
          updated_at?: string
          valeur_cible?: number
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          libelle?: string | null
          notes?: string | null
          temple_id?: string
          type_objectif?: Database["public"]["Enums"]["objectif_type"]
          updated_at?: string
          valeur_cible?: number
        }
        Relationships: []
      }
      orateurs_culte: {
        Row: {
          created_at: string
          culte_id: string
          fonction: string | null
          id: string
          nom: string
          ordre: number
          theme: string | null
          updated_at: string
          versets: string | null
        }
        Insert: {
          created_at?: string
          culte_id: string
          fonction?: string | null
          id?: string
          nom: string
          ordre?: number
          theme?: string | null
          updated_at?: string
          versets?: string | null
        }
        Update: {
          created_at?: string
          culte_id?: string
          fonction?: string | null
          id?: string
          nom?: string
          ordre?: number
          theme?: string | null
          updated_at?: string
          versets?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "profiles_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes_formation: {
        Row: {
          actif: boolean
          annee: number
          created_at: string
          created_by: string | null
          date_debut: string | null
          date_fin: string | null
          description: string | null
          id: string
          nom: string
          objectif_participants: number
          responsable: string | null
          temple_id: string
          trimestre: Database["public"]["Enums"]["trimestre_type"]
          type_formation: Database["public"]["Enums"]["formation_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          annee: number
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          nom: string
          objectif_participants?: number
          responsable?: string | null
          temple_id: string
          trimestre?: Database["public"]["Enums"]["trimestre_type"]
          type_formation?: Database["public"]["Enums"]["formation_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          annee?: number
          created_at?: string
          created_by?: string | null
          date_debut?: string | null
          date_fin?: string | null
          description?: string | null
          id?: string
          nom?: string
          objectif_participants?: number
          responsable?: string | null
          temple_id?: string
          trimestre?: Database["public"]["Enums"]["trimestre_type"]
          type_formation?: Database["public"]["Enums"]["formation_type"]
          updated_at?: string
        }
        Relationships: []
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
      sous_themes_annee: {
        Row: {
          activites: string | null
          avancement: number
          created_at: string
          id: string
          objectifs: string | null
          periode_num: number
          periode_type: Database["public"]["Enums"]["sous_theme_periode"]
          theme_id: string
          titre: string
          updated_at: string
          versets: string | null
        }
        Insert: {
          activites?: string | null
          avancement?: number
          created_at?: string
          id?: string
          objectifs?: string | null
          periode_num: number
          periode_type: Database["public"]["Enums"]["sous_theme_periode"]
          theme_id: string
          titre: string
          updated_at?: string
          versets?: string | null
        }
        Update: {
          activites?: string | null
          avancement?: number
          created_at?: string
          id?: string
          objectifs?: string | null
          periode_num?: number
          periode_type?: Database["public"]["Enums"]["sous_theme_periode"]
          theme_id?: string
          titre?: string
          updated_at?: string
          versets?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_themes_annee_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes_annee"
            referencedColumns: ["id"]
          },
        ]
      }
      temples: {
        Row: {
          actif: boolean
          code_pays: string | null
          code_temple: string | null
          commune: string | null
          couleur_primaire: string | null
          created_at: string
          email: string | null
          id: string
          logo: string | null
          nom_temple: string
          pasteur_adjoint: string | null
          pasteur_responsable: string | null
          pays: string | null
          telephone: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          actif?: boolean
          code_pays?: string | null
          code_temple?: string | null
          commune?: string | null
          couleur_primaire?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo?: string | null
          nom_temple: string
          pasteur_adjoint?: string | null
          pasteur_responsable?: string | null
          pays?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          actif?: boolean
          code_pays?: string | null
          code_temple?: string | null
          commune?: string | null
          couleur_primaire?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo?: string | null
          nom_temple?: string
          pasteur_adjoint?: string | null
          pasteur_responsable?: string | null
          pays?: string | null
          telephone?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      themes_annee: {
        Row: {
          annee: number
          created_at: string
          created_by: string | null
          id: string
          temple_id: string | null
          titre: string
          updated_at: string
          versets: string | null
          vision: string | null
        }
        Insert: {
          annee: number
          created_at?: string
          created_by?: string | null
          id?: string
          temple_id?: string | null
          titre: string
          updated_at?: string
          versets?: string | null
          vision?: string | null
        }
        Update: {
          annee?: number
          created_at?: string
          created_by?: string | null
          id?: string
          temple_id?: string | null
          titre?: string
          updated_at?: string
          versets?: string | null
          vision?: string | null
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
          {
            foreignKeyName: "user_roles_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_campagnes: {
        Row: {
          created_at: string
          created_by: string | null
          destinataires_manuels: string[] | null
          filter_categories: string[] | null
          filter_statuses: string[] | null
          filter_temples: string[] | null
          id: string
          media_mime: string | null
          media_url: string | null
          message: string | null
          message_type: Database["public"]["Enums"]["wa_message_type"]
          nom: string
          scheduled_at: string | null
          sent_at: string | null
          stats_delivered: number
          stats_failed: number
          stats_read: number
          stats_sent: number
          stats_total: number
          status: Database["public"]["Enums"]["wa_campagne_status"]
          template_lang: string | null
          template_name: string | null
          template_variables: Json | null
          temple_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destinataires_manuels?: string[] | null
          filter_categories?: string[] | null
          filter_statuses?: string[] | null
          filter_temples?: string[] | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          message?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          nom: string
          scheduled_at?: string | null
          sent_at?: string | null
          stats_delivered?: number
          stats_failed?: number
          stats_read?: number
          stats_sent?: number
          stats_total?: number
          status?: Database["public"]["Enums"]["wa_campagne_status"]
          template_lang?: string | null
          template_name?: string | null
          template_variables?: Json | null
          temple_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destinataires_manuels?: string[] | null
          filter_categories?: string[] | null
          filter_statuses?: string[] | null
          filter_temples?: string[] | null
          id?: string
          media_mime?: string | null
          media_url?: string | null
          message?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          nom?: string
          scheduled_at?: string | null
          sent_at?: string | null
          stats_delivered?: number
          stats_failed?: number
          stats_read?: number
          stats_sent?: number
          stats_total?: number
          status?: Database["public"]["Enums"]["wa_campagne_status"]
          template_lang?: string | null
          template_name?: string | null
          template_variables?: Json | null
          temple_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_campagnes_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_campagnes_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_envois: {
        Row: {
          campagne_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error: string | null
          failed_at: string | null
          id: string
          membre_id: string | null
          message_type: Database["public"]["Enums"]["wa_message_type"]
          phone_e164: string
          read_at: string | null
          rendered_message: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_envoi_status"]
          temple_id: string | null
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          campagne_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          membre_id?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          phone_e164: string
          read_at?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_envoi_status"]
          temple_id?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          campagne_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          membre_id?: string | null
          message_type?: Database["public"]["Enums"]["wa_message_type"]
          phone_e164?: string
          read_at?: string | null
          rendered_message?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_envoi_status"]
          temple_id?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_envois_campagne_id_fkey"
            columns: ["campagne_id"]
            isOneToOne: false
            referencedRelation: "wa_campagnes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_envois_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "membres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_envois_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_envois_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_notifications_auto: {
        Row: {
          config: Json | null
          created_at: string
          enabled: boolean
          id: string
          last_run_at: string | null
          message: string | null
          template_lang: string | null
          template_name: string | null
          temple_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          message?: string | null
          template_lang?: string | null
          template_name?: string | null
          temple_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          message?: string | null
          template_lang?: string | null
          template_name?: string | null
          temple_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_notifications_auto_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_notifications_auto_temple_id_fkey"
            columns: ["temple_id"]
            isOneToOne: false
            referencedRelation: "temples_public"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_templates: {
        Row: {
          category: string | null
          components: Json | null
          created_at: string
          id: string
          language: string
          meta_id: string | null
          name: string
          status: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string
          meta_id?: string | null
          name: string
          status?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string
          meta_id?: string | null
          name?: string
          status?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      temples_public: {
        Row: {
          commune: string | null
          couleur_primaire: string | null
          id: string | null
          logo: string | null
          nom_temple: string | null
          pays: string | null
          ville: string | null
        }
        Insert: {
          commune?: string | null
          couleur_primaire?: string | null
          id?: string | null
          logo?: string | null
          nom_temple?: string | null
          pays?: string | null
          ville?: string | null
        }
        Update: {
          commune?: string | null
          couleur_primaire?: string | null
          id?: string | null
          logo?: string | null
          nom_temple?: string | null
          pays?: string | null
          ville?: string | null
        }
        Relationships: []
      }
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
      temple_matricule_prefix: { Args: { _temple_id: string }; Returns: string }
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
      evenement_type:
        | "culte"
        | "formation"
        | "reunion"
        | "priere"
        | "sortie"
        | "autre"
      formation_statut: "inscrit" | "en_cours" | "complete" | "abandonne"
      formation_type:
        | "discipulat"
        | "formation_biblique"
        | "formation_ministerielle"
        | "seminaire"
        | "ecole_dimanche"
        | "autre"
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
      objectif_type:
        | "membres"
        | "nouvelles_ames"
        | "baptemes"
        | "visiteurs"
        | "presence_moyenne"
        | "offrandes"
        | "dimes"
        | "autre"
      presence_statut: "present" | "absent" | "excuse"
      role_famille: "chef" | "conjoint" | "enfant" | "autre"
      sexe: "M" | "F"
      sous_theme_periode: "trimestre" | "mois"
      trimestre_type: "T1" | "T2" | "T3" | "T4" | "annuel"
      wa_campagne_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "failed"
        | "cancelled"
      wa_envoi_status: "queued" | "sent" | "delivered" | "read" | "failed"
      wa_message_type:
        | "text"
        | "image"
        | "document"
        | "video"
        | "audio"
        | "template"
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
      evenement_type: [
        "culte",
        "formation",
        "reunion",
        "priere",
        "sortie",
        "autre",
      ],
      formation_statut: ["inscrit", "en_cours", "complete", "abandonne"],
      formation_type: [
        "discipulat",
        "formation_biblique",
        "formation_ministerielle",
        "seminaire",
        "ecole_dimanche",
        "autre",
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
      objectif_type: [
        "membres",
        "nouvelles_ames",
        "baptemes",
        "visiteurs",
        "presence_moyenne",
        "offrandes",
        "dimes",
        "autre",
      ],
      presence_statut: ["present", "absent", "excuse"],
      role_famille: ["chef", "conjoint", "enfant", "autre"],
      sexe: ["M", "F"],
      sous_theme_periode: ["trimestre", "mois"],
      trimestre_type: ["T1", "T2", "T3", "T4", "annuel"],
      wa_campagne_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "failed",
        "cancelled",
      ],
      wa_envoi_status: ["queued", "sent", "delivered", "read", "failed"],
      wa_message_type: [
        "text",
        "image",
        "document",
        "video",
        "audio",
        "template",
      ],
    },
  },
} as const
