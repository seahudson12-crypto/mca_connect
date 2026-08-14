-- 1. Montant prévu par membre
CREATE TABLE public.finance_montants_membre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  op_type public.finance_op_type NOT NULL,
  montant_prevu NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (membre_id, op_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_montants_membre TO authenticated;
GRANT ALL ON public.finance_montants_membre TO service_role;
ALTER TABLE public.finance_montants_membre ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_montants_membre_select ON public.finance_montants_membre FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_montants_membre_insert ON public.finance_montants_membre FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_montants_membre_update ON public.finance_montants_membre FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id))
  WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_montants_membre_delete ON public.finance_montants_membre FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE TRIGGER trg_finance_montants_membre_updated BEFORE UPDATE ON public.finance_montants_membre
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Historique des modifications de montant
CREATE TABLE public.finance_montant_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  op_type public.finance_op_type NOT NULL,
  ancien_montant NUMERIC,
  nouveau_montant NUMERIC NOT NULL,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.finance_montant_changes TO authenticated;
GRANT ALL ON public.finance_montant_changes TO service_role;
ALTER TABLE public.finance_montant_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_montant_changes_select ON public.finance_montant_changes FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_montant_changes_insert ON public.finance_montant_changes FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));

-- 3. Date prévue de règlement du reliquat
CREATE TABLE public.finance_reliquats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  op_type public.finance_op_type NOT NULL,
  periode TEXT NOT NULL,
  date_prevue DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (membre_id, op_type, periode)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_reliquats TO authenticated;
GRANT ALL ON public.finance_reliquats TO service_role;
ALTER TABLE public.finance_reliquats ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_reliquats_select ON public.finance_reliquats FOR SELECT TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_reliquats_insert ON public.finance_reliquats FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_reliquats_update ON public.finance_reliquats FOR UPDATE TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id))
  WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY finance_reliquats_delete ON public.finance_reliquats FOR DELETE TO authenticated
  USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id)) OR public.is_finances(auth.uid(), temple_id));
CREATE TRIGGER trg_finance_reliquats_updated BEFORE UPDATE ON public.finance_reliquats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();