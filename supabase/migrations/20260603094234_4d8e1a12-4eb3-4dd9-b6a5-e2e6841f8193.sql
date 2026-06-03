-- Enums
CREATE TYPE public.formation_type AS ENUM ('discipulat','formation_biblique','formation_ministerielle','seminaire','ecole_dimanche','autre');
CREATE TYPE public.formation_statut AS ENUM ('inscrit','en_cours','complete','abandonne');
CREATE TYPE public.trimestre_type AS ENUM ('T1','T2','T3','T4','annuel');

-- Table programmes
CREATE TABLE public.programmes_formation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  type_formation public.formation_type NOT NULL DEFAULT 'discipulat',
  annee INTEGER NOT NULL,
  trimestre public.trimestre_type NOT NULL DEFAULT 'annuel',
  objectif_participants INTEGER NOT NULL DEFAULT 0,
  responsable TEXT,
  date_debut DATE,
  date_fin DATE,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programmes_formation TO authenticated;
GRANT ALL ON public.programmes_formation TO service_role;

ALTER TABLE public.programmes_formation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read programmes" ON public.programmes_formation
  FOR SELECT TO authenticated USING (public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin insert programmes" ON public.programmes_formation
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin update programmes" ON public.programmes_formation
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));
CREATE POLICY "admin delete programmes" ON public.programmes_formation
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id));

CREATE TRIGGER trg_programmes_updated BEFORE UPDATE ON public.programmes_formation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Table inscriptions
CREATE TABLE public.inscriptions_formation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programme_id UUID NOT NULL REFERENCES public.programmes_formation(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL,
  statut public.formation_statut NOT NULL DEFAULT 'inscrit',
  progression INTEGER NOT NULL DEFAULT 0,
  date_inscription DATE NOT NULL DEFAULT CURRENT_DATE,
  date_completion DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(programme_id, membre_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscriptions_formation TO authenticated;
GRANT ALL ON public.inscriptions_formation TO service_role;

ALTER TABLE public.inscriptions_formation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read inscriptions" ON public.inscriptions_formation
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.programmes_formation p
    WHERE p.id = programme_id AND public.can_access_temple(auth.uid(), p.temple_id)
  ));
CREATE POLICY "admin insert inscriptions" ON public.inscriptions_formation
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.programmes_formation p
    WHERE p.id = programme_id AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), p.temple_id)
  ));
CREATE POLICY "admin update inscriptions" ON public.inscriptions_formation
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.programmes_formation p
    WHERE p.id = programme_id AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), p.temple_id)
  ));
CREATE POLICY "admin delete inscriptions" ON public.inscriptions_formation
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.programmes_formation p
    WHERE p.id = programme_id AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), p.temple_id)
  ));

CREATE TRIGGER trg_inscriptions_updated BEFORE UPDATE ON public.inscriptions_formation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_programmes_temple_annee ON public.programmes_formation(temple_id, annee);
CREATE INDEX idx_inscriptions_programme ON public.inscriptions_formation(programme_id);
CREATE INDEX idx_inscriptions_membre ON public.inscriptions_formation(membre_id);