## Vue d'ensemble

Remplacer le système `wa.me` par l'API officielle **WhatsApp Cloud (Meta Graph API v21)**. Livraison en un seul lot couvrant config, envois réels, campagnes, tracking, médias, templates, planification et notifications automatiques.

Vu la taille (≈15-20 fichiers, 3 migrations, 1 edge webhook, ~2500 lignes), l'implémentation se fera en une seule passe cohérente mais je prévois qu'un second tour de finitions/bugs sera probablement nécessaire — c'est normal pour un module de cette envergure.

---

## 1. Secrets & configuration

Créer via formulaire sécurisé :
- `META_WA_ACCESS_TOKEN` (permanent)
- `META_WA_PHONE_NUMBER_ID`
- `META_WA_BUSINESS_ACCOUNT_ID` (WABA)
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WA_WEBHOOK_VERIFY_TOKEN` (généré aléatoire)

Ces valeurs restent côté serveur uniquement, jamais exposées à l'UI (statut "configuré/non configuré" seulement).

---

## 2. Base de données (migration)

Nouvelles tables (toutes avec RLS + GRANTs) :

- **`wa_campagnes`** : nom, message, media_url, media_type, template_name, template_lang, template_variables, filtres (temples[], categories[], statuts[]), scheduled_at, status (draft/scheduled/sending/sent/failed), created_by, temple_id, stats agrégées.
- **`wa_envois`** : campagne_id (nullable pour envois unitaires), membre_id, phone_e164, wa_message_id, status (queued/sent/delivered/read/failed), error, timestamps envoyé/livré/lu.
- **`wa_templates`** : cache local des templates Meta (name, language, category, status, components JSONB, synced_at).
- **`wa_notifications_auto`** : type (anniversaire, rappel_culte, relance_absents, bienvenue…), enabled, template_name, schedule (cron ou event), temple_id.

RLS :
- `admin_temple` : lecture/écriture scopée à son temple.
- `super_admin*` : accès global.
- `utilisateur` : aucun accès.

---

## 3. Server functions (`src/lib/whatsapp.functions.ts`)

Toutes avec `requireSupabaseAuth` + vérification de rôle :

- `waCheckConfig()` — renvoie quels secrets sont présents.
- `waTestConnection()` — GET `/v21.0/{phone_number_id}` pour valider.
- `waSyncTemplates()` — GET `/{waba_id}/message_templates`, upsert en local.
- `waSendMessage({ to, type, text?, mediaUrl?, template? })` — envoi unitaire, insère `wa_envois`.
- `waSendCampaign({ campagneId })` — résout destinataires selon filtres, envoie en série avec throttle (≈20 msg/s), interpole variables `{{nom}}`, `{{prenom}}`, `{{temple}}`, `{{categorie}}`, `{{date}}`.
- `waUploadMedia(file)` — upload vers `/media` endpoint Meta, retourne media_id.
- `waListCampaigns`, `waGetCampaignStats`, `waListEnvois`.

Résolution destinataires : query `membres` filtrée par temples (RBAC), catégories, statut (présent/absent/nouveau/inactif basé sur `presences` + `date_arrivee`).

---

## 4. Webhook (server route)

`src/routes/api/public/webhooks/whatsapp.ts` :
- GET : verify challenge (hub.mode/hub.verify_token/hub.challenge).
- POST : signature HMAC SHA256 (X-Hub-Signature-256) contre `META_APP_SECRET`, puis update `wa_envois.status` selon `statuses[].status` (sent/delivered/read/failed) via `supabaseAdmin`.

URL stable à fournir dans Meta : `https://project--b201f293-2852-4713-a98d-61080da97006.lovable.app/api/public/webhooks/whatsapp`.

---

## 5. Planification (pg_cron)

- Un job `wa-scheduled-dispatch` toutes les minutes → `/api/public/hooks/wa-dispatch` qui prend les `wa_campagnes` où `scheduled_at <= now()` et `status = 'scheduled'`, lance l'envoi.
- Un job `wa-daily-notifications` chaque matin 8h → notifications auto (anniversaires du jour, rappels de culte du dimanche, relance absents 3 semaines).

---

## 6. UI — Nouvelles pages

### `/parametres-whatsapp` (Super Admin Principal uniquement)
Statut de chaque credential (✓/✗), bouton "Configurer" (ouvre `add_secret`), "Tester la connexion", "Synchroniser les templates", URL webhook affichée + verify token.

### `/campagnes` (Admin+)
Liste des campagnes avec filtres statut, stats (envoyé/livré/lu/échec, taux de lecture), graphique barres. Bouton "Nouvelle campagne" → dialog complet :
- Nom, message avec insertion variables, upload média, choix template Meta.
- Filtres destinataires (temples multi, catégories multi, statut).
- Compteur temps réel de destinataires résolus.
- Envoi immédiat / planifié (datetime picker).
- Aperçu avec variables interpolées sur le 1er destinataire.

### `/whatsapp` (refonte)
Onglets :
1. **Envoi rapide** (l'existant, mais utilise `waSendMessage` réel au lieu de `wa.me`).
2. **Historique** — liste `wa_envois` avec statuts colorés, filtres par date/campagne/statut.
3. **Templates** — liste synchronisée depuis Meta, statut d'approbation.
4. **Notifications auto** — toggle par type, config template associé.

### Intégrations dans modules existants
- Fiche membre → bouton "Contacter sur WhatsApp" (ouvre dialog envoi rapide pré-rempli).
- `/rapports` → bouton "Envoyer aux absents" (crée campagne pré-remplie).
- `/membres` (filtre nouvelles âmes) → "Envoyer un message".
- `/temples` (super admin) → "Contacter tous les membres du temple".

---

## 7. Sécurité

- Toutes les fonctions vérifient le rôle (`super_admin_principal` / `super_admin` / `admin_temple`).
- `admin_temple` : filtre serveur force `temple_id = user.temple_id`, refuse les autres temples dans les filtres.
- Aucune fonction accessible aux `utilisateur`.
- Validation Zod des inputs (longueur message, phone E.164, media_url https).
- Rate limiting logique côté server function (throttle 50ms entre envois).

---

## 8. Fichiers créés/modifiés

**Créés :**
- `supabase/migrations/*_whatsapp_cloud.sql`
- `src/lib/whatsapp.functions.ts`
- `src/lib/whatsapp-utils.ts` (normalisation E.164, interpolation variables, filtres)
- `src/routes/api/public/webhooks/whatsapp.ts`
- `src/routes/api/public/hooks/wa-dispatch.ts`
- `src/routes/_app/parametres-whatsapp.tsx`
- `src/routes/_app/campagnes.tsx`
- `src/components/whatsapp/CampagneDialog.tsx`
- `src/components/whatsapp/ContactWhatsAppButton.tsx`

**Modifiés :**
- `src/routes/_app/whatsapp.tsx` (refonte en onglets, envoi réel)
- `src/components/AppShell.tsx` (nouveaux liens sidebar)
- `src/routes/_app/membres.tsx` (bouton contact)
- `src/routes/_app/rapports.tsx` (bouton "envoyer aux absents")
- `src/routes/_app/temples.tsx` (bouton contact tous)

---

## 9. Détails techniques

- API base : `https://graph.facebook.com/v21.0`
- Format phone : E.164 sans `+` (déjà normalisé côté client).
- Templates Meta : payload `{ type: "template", template: { name, language: { code }, components: [{ type: "body", parameters: [...] }] } }`.
- Médias : upload d'abord (`POST /media`), puis référence par `id` (pas `link`).
- Fenêtre 24h Meta : si le membre n'a pas écrit dans les 24h, seul un template approuvé passe — UI avertit et force template.

---

## Ordre d'exécution

1. Migration DB + secrets (formulaire).
2. Server functions + webhook.
3. Page paramètres + test connexion.
4. Refonte `/whatsapp` avec envoi réel.
5. Module campagnes + planification.
6. Notifications auto + pg_cron.
7. Intégrations dans autres modules.

Aucun changement rétro-compatible sur les données existantes.