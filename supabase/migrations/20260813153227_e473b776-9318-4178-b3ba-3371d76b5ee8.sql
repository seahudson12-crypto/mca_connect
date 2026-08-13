CREATE TYPE public.finance_op_type AS ENUM ('social_contribution','mission_offering');
CREATE TYPE public.finance_frequence AS ENUM ('mensuelle','trimestrielle','annuelle');
CREATE TYPE public.finance_mode_paiement AS ENUM ('especes','mobile_money','virement','cheque','autre');

CREATE TABLE public.finance_baremes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  op_type public.finance_op_type NOT NULL,
  libelle text,
  montant_attendu numeric NOT NULL DEFAULT 0,
  frequence public.finance_frequence NOT NULL DEFAULT 'mensuelle',
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  jours_grace integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_paiements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id uuid NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  membre_id uuid NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  bareme_id uuid REFERENCES public.finance_baremes(id) ON DELETE SET NULL,
  op_type public.finance_op_type NOT NULL,
  periode text NOT NULL,
  montant_attendu numeric NOT NULL DEFAULT 0,
  montant_paye numeric NOT NULL DEFAULT 0,
  date_paiement date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  mode_paiement public.finance_mode_paiement NOT NULL DEFAULT 'especes',
  reference text,
  observation text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_paiements_lookup ON public.finance_paiements (temple_id, op_type, membre_id, periode);
CREATE INDEX idx_finance_baremes_lookup ON public.finance_baremes (temple_id, op_type, actif);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_baremes TO authenticated;
GRANT ALL ON public.finance_baremes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_paiements TO authenticated;
GRANT ALL ON public.finance_paiements TO service_role;

ALTER TABLE public.finance_baremes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_baremes_select" ON public.finance_baremes FOR SELECT TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_baremes_insert" ON public.finance_baremes FOR INSERT TO authenticated
WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_baremes_update" ON public.finance_baremes FOR UPDATE TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id))
WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_baremes_delete" ON public.finance_baremes FOR DELETE TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));

CREATE POLICY "finance_paiements_select" ON public.finance_paiements FOR SELECT TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_paiements_insert" ON public.finance_paiements FOR INSERT TO authenticated
WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_paiements_update" ON public.finance_paiements FOR UPDATE TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id))
WITH CHECK ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));
CREATE POLICY "finance_paiements_delete" ON public.finance_paiements FOR DELETE TO authenticated
USING ((public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
       OR public.is_finances(auth.uid(), temple_id));

CREATE TRIGGER trg_finance_baremes_updated BEFORE UPDATE ON public.finance_baremes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_finance_paiements_updated BEFORE UPDATE ON public.finance_paiements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();