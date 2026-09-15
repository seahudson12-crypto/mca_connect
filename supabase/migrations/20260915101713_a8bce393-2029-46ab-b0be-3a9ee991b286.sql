-- 1. Departments: stop exposing the full table to anonymous visitors.
--    Signup reads public.departements_public; switch it to run with the
--    view owner's rights so it keeps working without a table-wide anon policy.
DROP POLICY IF EXISTS "departements_anon_active_read" ON public.departements;
ALTER VIEW public.departements_public SET (security_invoker = off);
REVOKE ALL ON public.departements FROM anon;
GRANT SELECT ON public.departements_public TO anon, authenticated;

-- 2. departement_fonctions: restrict create/rename to admins.
DROP POLICY IF EXISTS "df_insert" ON public.departement_fonctions;
CREATE POLICY "df_insert" ON public.departement_fonctions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id));

DROP POLICY IF EXISTS "df_update" ON public.departement_fonctions;
CREATE POLICY "df_update" ON public.departement_fonctions
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id))
  WITH CHECK (is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id));

-- 3. finances_culte: prevent moving a financial row outside authorized scope.
DROP POLICY IF EXISTS "admin update finances" ON public.finances_culte;
CREATE POLICY "admin update finances" ON public.finances_culte
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cultes c
    WHERE c.id = finances_culte.culte_id
      AND can_access_temple(auth.uid(), c.temple_id)
      AND (is_admin(auth.uid()) OR is_finances(auth.uid(), c.temple_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cultes c
    WHERE c.id = finances_culte.culte_id
      AND can_access_temple(auth.uid(), c.temple_id)
      AND (is_admin(auth.uid()) OR is_finances(auth.uid(), c.temple_id))
  ));