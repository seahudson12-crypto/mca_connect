ALTER TABLE public.membres
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS secteur_activite text,
  ADD COLUMN IF NOT EXISTS entreprise text,
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS date_naissance date;