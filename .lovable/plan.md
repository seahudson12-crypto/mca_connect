## MCA CONNECT — Mise à jour globale V2 (Multi-temples strict + Super Admin Principal + Sécurité finances)

Cette mise à jour est très large. Je propose de la livrer en **4 lots cohérents** pour garder un code propre, testable, et éviter de tout casser. Chaque lot est complet et utilisable.

---

### LOT 1 — Fondations base de données & sécurité (le plus critique)

**Migration SQL :**
- Nouveau rôle `super_admin_principal` ajouté à l'enum `app_role`.
- Fonction `is_principal(uuid)` + fonction `current_user_temple_id()` (security definer).
- Fonction `can_access_temple(uuid, uuid)` pour l'isolation.
- Table `activites_utilisateurs` (login, logout, promotion, suppression, validation, correction, modification) avec `temple_id`.
- Ajout `actif boolean` sur `profiles` (désactivation comptes).
- Ajout `derniere_connexion timestamptz` sur `profiles`.
- Ajout colonnes `couleur_primaire`, `actif` sur `temples`.
- **Renforcement RLS isolation multi-temples STRICTE** :
  - `membres`, `cultes`, `presences`, `finances_culte` → SELECT/INSERT/UPDATE/DELETE filtrés par `temple_id = current_user_temple_id()` OU `is_principal/super_admin`.
  - `finances_culte` → **bloqué pour rôle `utilisateur`** (RLS + UI).
  - `profiles` → admin_temple voit uniquement les profils de son temple.
- Trigger `log_activity()` sur insertions/updates sensibles.
- Trigger anti-suppression du Super Admin Principal.
- Seed des 2 nouveaux temples : **MCA Casablanca – Philadelphie** et **MCA Bénin – Résurrection**.

---

### LOT 2 — Authentification multi-temples & écrans modernes

- **Écran d'accueil "Choisissez votre espace"** : 3 cartes (Super Admin / Admin Temple / Utilisateur), logo MCA, design premium bleu/blanc/or, animations Motion.
- **Login en 2 étapes** : choix espace → sélection temple obligatoire (sauf Super Admin) → email/password.
- **Signup** : sélection temple obligatoire, assignation auto `temple_id`.
- Mot de passe oublié + page `/reset-password`.
- Toggle afficher/masquer mot de passe.
- Mise à jour `derniere_connexion` à chaque login.
- `useAuth` enrichi : `isPrincipal`, `isSuperAdmin`, `isAdminTemple`, `templeId`, `role`.
- Garde-fou frontend : redirect si utilisateur essaie d'accéder à `/finances` ou `/temples`.

---

### LOT 3 — Équipe de gestion, promotions sécurisées & dashboard amélioré

- Renommage `Utilisateurs` → **`Équipe de gestion`** avec :
  - Recherche, filtres (rôle, temple, statut), badges colorés par rôle.
  - Boutons "Promouvoir en Admin", "Promouvoir en Super Admin" (Principal uniquement), "Retirer les droits", "Désactiver compte", "Réinitialiser mot de passe".
  - **Modal de confirmation avec mot de passe Super Admin** avant toute promotion.
  - Affichage dernière connexion.
- Protection : seul `super_admin_principal` peut créer/supprimer un `super_admin`. Le Principal n'est jamais supprimable (trigger DB).
- **Dashboard Super Admin enrichi** : Total membres, présences, absences, nouvelles âmes, total temples, total utilisateurs, finances globales, graphiques mensuels (Recharts).
- **Dashboard Utilisateur épuré** : Membres, Cultes, Présences, Rapports, WhatsApp, Historique personnel — **finances retirées de la sidebar et des stats**.
- Comparaison inter-temples (Super Admin) sur la page Temples.

---

### LOT 4 — Module Temples avancé & finitions

- Page `/temples` (Super Admin Principal) : création dynamique d'un temple avec tous les champs (nom, ville, commune, pays, pasteur, email, téléphone, logo, couleur). Désactivation/réactivation.
- Stats par temple sur la fiche temple.
- Page `/activites` (Super Admin) : journal complet (connexions, promotions, validations, corrections).
- Mode sombre déjà géré → vérification.
- Polish design : badges rôles, animations légères Motion, responsive mobile vérifié.
- Vérification du build après chaque lot.

---

### Notes techniques

- **Stack** : TanStack Start + Supabase (Lovable Cloud), serverFn pour les opérations sensibles (promotions, désactivations).
- **Sécurité** : double couche systématique → UI cache + RLS bloque. Le module finances est invisible ET inaccessible aux utilisateurs (même via URL directe).
- **Compatibilité** : tout le code existant (cultes, membres, présences, finances, historique) reste fonctionnel — on ajoute, on ne casse pas.
- **WhatsApp Cloud API**, **OTP/2FA**, **fusion de temples** : marqués comme "prévu V3" — non implémentés dans cette mise à jour mais l'architecture les permet.

---

### Question avant de démarrer

Je dois savoir **qui est le Super Admin Principal** pour le marquer dans la DB. Donnez-moi l'email du compte qui doit recevoir ce rôle ultime (ou je peux promouvoir le premier compte `super_admin` existant automatiquement).

Une fois validé, je démarre par le **LOT 1 (migration)** puis enchaîne les lots 2, 3, 4.
