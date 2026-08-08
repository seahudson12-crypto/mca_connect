-- 1) Backfill legacy financial data from cultes into the admin-only finances_culte table
INSERT INTO public.finances_culte (culte_id, offrande, dime, depense, solde, observation, created_by)
SELECT c.id,
       COALESCE(c.offrandes, 0),
       COALESCE(c.dimes, 0),
       COALESCE(c.depenses, 0),
       COALESCE(c.solde_caisse, COALESCE(c.offrandes,0) + COALESCE(c.dimes,0) - COALESCE(c.depenses,0)),
       c.notes_finances,
       c.created_by
FROM public.cultes c
WHERE (COALESCE(c.offrandes,0) <> 0
       OR COALESCE(c.dimes,0) <> 0
       OR COALESCE(c.depenses,0) <> 0
       OR COALESCE(c.solde_caisse,0) <> 0
       OR NULLIF(TRIM(COALESCE(c.notes_finances,'')), '') IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.finances_culte f WHERE f.culte_id = c.id);

-- 2) Remove financial columns from cultes so non-admin members can no longer read them
ALTER TABLE public.cultes
  DROP COLUMN IF EXISTS offrandes,
  DROP COLUMN IF EXISTS dimes,
  DROP COLUMN IF EXISTS depenses,
  DROP COLUMN IF EXISTS solde_caisse,
  DROP COLUMN IF EXISTS notes_finances;