-- =========== FAMILLES ===========
CREATE TYPE public.role_famille AS ENUM ('chef','conjoint','enfant','autre');

CREATE TABLE public.familles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id uuid NOT NULL,
  nom_famille text NOT NULL,
  adresse text,
  telephone_principal text,
  telephone_secondaire text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familles TO authenticated;
GRANT ALL ON public.familles TO service_role;

ALTER TABLE public.familles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read familles" ON public.familles FOR SELECT TO authenticated
  USING (can_access_temple(auth.uid(), temple_id));
CREATE POLICY "scoped insert familles" ON public.familles FOR INSERT TO authenticated
  WITH CHECK (can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin update familles" ON public.familles FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin delete familles" ON public.familles FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id));

CREATE TRIGGER trg_familles_updated_at BEFORE UPDATE ON public.familles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ajout sur membres
ALTER TABLE public.membres
  ADD COLUMN famille_id uuid,
  ADD COLUMN role_famille public.role_famille;

CREATE INDEX idx_membres_famille ON public.membres(famille_id);
CREATE INDEX idx_familles_temple ON public.familles(temple_id);

-- =========== EVENEMENTS ===========
CREATE TYPE public.evenement_type AS ENUM ('culte','formation','reunion','priere','sortie','autre');

CREATE TABLE public.evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id uuid, -- NULL = global MCA
  titre text NOT NULL,
  description text,
  type_evenement public.evenement_type NOT NULL DEFAULT 'autre',
  date_debut timestamptz NOT NULL,
  date_fin timestamptz,
  lieu text,
  couleur text DEFAULT '#1e40af',
  all_day boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evenements TO authenticated;
GRANT ALL ON public.evenements TO service_role;

ALTER TABLE public.evenements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read evenements" ON public.evenements FOR SELECT TO authenticated
  USING (temple_id IS NULL OR can_access_temple(auth.uid(), temple_id));

CREATE POLICY "admin insert evenements" ON public.evenements FOR INSERT TO authenticated
  WITH CHECK (
    (temple_id IS NULL AND is_super(auth.uid()))
    OR (temple_id IS NOT NULL AND is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id))
  );

CREATE POLICY "admin update evenements" ON public.evenements FOR UPDATE TO authenticated
  USING (
    (temple_id IS NULL AND is_super(auth.uid()))
    OR (temple_id IS NOT NULL AND is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id))
  );

CREATE POLICY "admin delete evenements" ON public.evenements FOR DELETE TO authenticated
  USING (
    (temple_id IS NULL AND is_super(auth.uid()))
    OR (temple_id IS NOT NULL AND is_admin(auth.uid()) AND can_access_temple(auth.uid(), temple_id))
  );

CREATE TRIGGER trg_evenements_updated_at BEFORE UPDATE ON public.evenements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_evenements_date ON public.evenements(date_debut);
CREATE INDEX idx_evenements_temple ON public.evenements(temple_id);