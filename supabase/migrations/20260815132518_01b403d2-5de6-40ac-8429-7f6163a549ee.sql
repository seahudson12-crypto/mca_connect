CREATE TABLE public.finance_liste_membre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  op_type public.finance_op_type NOT NULL,
  inclus BOOLEAN NOT NULL DEFAULT false,
  motif TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (membre_id, op_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_liste_membre TO authenticated;
GRANT ALL ON public.finance_liste_membre TO service_role;

ALTER TABLE public.finance_liste_membre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finances/admins peuvent voir la liste"
ON public.finance_liste_membre FOR SELECT TO authenticated
USING (
  (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  OR public.is_finances(auth.uid(), temple_id)
);

CREATE POLICY "Finances/admins peuvent ajouter"
ON public.finance_liste_membre FOR INSERT TO authenticated
WITH CHECK (
  (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  OR public.is_finances(auth.uid(), temple_id)
);

CREATE POLICY "Finances/admins peuvent modifier"
ON public.finance_liste_membre FOR UPDATE TO authenticated
USING (
  (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  OR public.is_finances(auth.uid(), temple_id)
)
WITH CHECK (
  (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  OR public.is_finances(auth.uid(), temple_id)
);

CREATE POLICY "Finances/admins peuvent supprimer"
ON public.finance_liste_membre FOR DELETE TO authenticated
USING (
  (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
  OR public.is_finances(auth.uid(), temple_id)
);

CREATE TRIGGER trg_finance_liste_membre_updated
BEFORE UPDATE ON public.finance_liste_membre
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();