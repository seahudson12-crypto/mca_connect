
# MCA CONNECT — Plateforme multi-temples complète

Cette mise à jour est très large. Je propose de la livrer en **5 phases** pour garder un produit utilisable à chaque étape et te permettre de tester / valider au fur et à mesure. Confirme ou demande des ajustements avant que je commence.

---

## Phase 1 — Fondations multi-temples (base technique indispensable)

**Données / Backend**
- Création des temples :
  - MCA Casablanca – Temple Philadelphie (Maroc, Casablanca)
  - MCA Bénin – Temple Résurrection (Bénin)
  - MCA Treichville – Temple Puissance et Gloire (existant, conservé)
- Champ `temple_id` obligatoire sur tous les modules métier (déjà en place sur cultes/membres/présences/finances — vérification + corrections).
- Vérification stricte RLS : isolation totale entre temples (un utilisateur ne voit JAMAIS un autre temple), super_admin/principal voient tout.
- Triggers d'audit (historique) sur finances et changements de rôle.
- Helper `current_active_temple_id()` pour super admins (lit un cookie/préférence pour le "Switch Temple").

**Frontend**
- Inscription / Signup : sélecteur **obligatoire** "Choisissez votre temple" (liste des temples actifs).
- Badge temple connecté (nom + logo) dans le header de l'AppShell.
- Sélecteur **Switch Temple** visible uniquement pour super_admin / super_admin_principal.

---

## Phase 2 — Rôles, permissions et validation hiérarchique

**Permissions par rôle (UI + RLS)**
- `utilisateur` : présences (cocher), ajout membres, soumission rapport. **Aucun accès finances** (rubrique masquée + RLS bloquante).
- `admin_temple` : tout du temple + finances du culte + validation des rapports.
- `super_admin` / `super_admin_principal` : accès global multi-temples.

**Workflow de validation des rapports de culte**
- États : `brouillon` → `en_attente_validation` → `valide` → `verrouille`.
- Utilisateur soumet (`en_attente_validation`).
- Admin temple voit la file d'attente, peut corriger, ajoute finances, valide.
- Après validation : rapport verrouillé (non modifiable par l'utilisateur), envoyé automatiquement (notification) au super admin.

**Module Finances (admin temple uniquement)**
- Champs : offrandes, dîmes, actions de grâce, semences, contributions spéciales, dépenses, observations.
- Calcul auto : total recettes, total dépenses, solde.
- Lié obligatoirement à un culte (contrainte DB déjà présente).
- Historique complet des modifications (qui, quand, ancienne → nouvelle valeur).

---

## Phase 3 — Dashboards & rapports

**Dashboard utilisateur / admin temple**
- Scopé à son temple uniquement.
- Stats : membres, présences, nouvelles âmes, cultes du mois.

**Dashboard super admin — vue globale**
- Totaux globaux + ventilation par temple.
- Graphiques comparatifs (présences, finances, nouvelles âmes, croissance).
- Section **"Rapports des temples"** : liste filtrable par temple/date, détail complet d'un rapport validé (infos culte, présences par catégorie avec %, nouvelles âmes, finances, observations), export PDF.

**Rapport détaillé automatique** (généré à la validation)
- Infos culte, stats globales, ventilation par catégorie (Hommes adultes, Femmes adultes, Jeunes hommes, Jeunes filles, Groupe musical, Ecodim, Moniteurs, Appelés, Serviteurs de Dieu, Pasteurs, Nouvelles âmes) avec présents/absents/%.
- Bloc financier complet.

---

## Phase 4 — Nouvelles âmes, fiches membres, notifications

**Module Nouvelles âmes**
- Rubrique dédiée dans Membres.
- Suivi : date d'arrivée, présences, absences, dernière présence, fréquence.
- Statut de progression : Nouveau / En suivi / Régulier / Intégré (calcul auto basé sur présences).
- Transfert vers autre catégorie (admin temple / super admin) avec historique conservé.

**Fiche détaillée membre**
- Bouton "Voir la fiche" sur chaque membre.
- Page complète : infos perso, photo, stats présences (total, taux, dernière), historique cultes, suivi spirituel (observations), historique catégories.
- Actions : modifier, changer catégorie, imprimer, envoyer WhatsApp.

**Centre de notifications**
- Icône cloche dans le header.
- Notifications auto : anniversaires, absences répétées (≥3-4 cultes), nouvelles âmes inactives, rapports non validés, finances manquantes, nouvelles inscriptions, promotions de rôle.

---

## Phase 5 — Assistant IA MCA

- Rubrique "Assistant IA MCA" dans dashboards admin/super admin.
- Powered by Lovable AI Gateway (Gemini 3 Flash par défaut).
- Tools (function calling) connectés à la DB pour répondre à :
  - "Quel temple a le plus de présences ce mois ?"
  - "Combien de nouvelles âmes ce trimestre ?"
  - "Quels membres sont absents depuis longtemps ?"
  - Résumés automatiques, comparatifs, alertes suggérées.
- Streaming chat (AI SDK + `useChat`).
- Respect du scope : admin temple → données de son temple uniquement ; super admin → tous les temples.

---

## Détails techniques

- **Stack** : TanStack Start + Supabase (Lovable Cloud) déjà en place.
- **Sécurité** : RLS strict + `requireSupabaseAuth` sur tous les server functions sensibles. Tentative de modif d'URL = refus côté serveur.
- **Historique financier** : trigger Postgres qui log dans `historique_modifications`.
- **PDF** : génération côté client (jsPDF / react-pdf) pour rapports.
- **IA** : `createServerFn` + `streamText` AI SDK + tools (`get_temple_stats`, `compare_temples`, `find_inactive_members`, etc.).

---

## Question avant de démarrer

Cette mise à jour représente environ **5 phases** de travail substantiel. Souhaites-tu :

**A.** Que je lance **tout d'un coup** (livraison complète, plus longue, un seul gros lot).
**B.** Que je commence par la **Phase 1** (création des temples + isolation + signup avec choix temple + switch temple) et que tu valides avant que je continue. ← **recommandé**
**C.** Une autre priorité (par ex. : "commence d'abord par l'Assistant IA" ou "fais d'abord les finances et la validation").

Dis-moi A, B ou C et j'attaque immédiatement.
