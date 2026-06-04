
-- 1) Multi-orateurs par culte (module 45)
CREATE TABLE public.orateurs_culte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culte_id UUID NOT NULL,
  nom TEXT NOT NULL,
  fonction TEXT,
  theme TEXT,
  versets TEXT,
  ordre INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orateurs_culte_culte ON public.orateurs_culte(culte_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orateurs_culte TO authenticated;
GRANT ALL ON public.orateurs_culte TO service_role;
ALTER TABLE public.orateurs_culte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read orateurs" ON public.orateurs_culte FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id)));

CREATE POLICY "scoped insert orateurs" ON public.orateurs_culte FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id)
  AND (c.statut = 'brouillon' OR public.is_admin(auth.uid()))));

CREATE POLICY "scoped update orateurs" ON public.orateurs_culte FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id)
  AND (c.statut = 'brouillon' OR public.is_admin(auth.uid()))));

CREATE POLICY "scoped delete orateurs" ON public.orateurs_culte FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.cultes c WHERE c.id = culte_id AND public.can_access_temple(auth.uid(), c.temple_id)
  AND (c.statut = 'brouillon' OR public.is_admin(auth.uid()))));

CREATE TRIGGER orateurs_culte_set_updated_at BEFORE UPDATE ON public.orateurs_culte
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Module 44 : flag prière intense
ALTER TABLE public.cultes ADD COLUMN IF NOT EXISTS priere_intense_active BOOLEAN NOT NULL DEFAULT false;
-- Par défaut, les cultes du dimanche existants ont la prière intense activée
UPDATE public.cultes SET priere_intense_active = true WHERE type_culte = 'dimanche';

-- 3) Module 42 : thèmes de l'année
CREATE TYPE public.sous_theme_periode AS ENUM ('trimestre','mois');

CREATE TABLE public.themes_annee (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  temple_id UUID, -- NULL = global (toute la MCA)
  annee INTEGER NOT NULL,
  titre TEXT NOT NULL,
  versets TEXT,
  vision TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (temple_id, annee)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.themes_annee TO authenticated;
GRANT ALL ON public.themes_annee TO service_role;
ALTER TABLE public.themes_annee ENABLE ROW LEVEL SECURITY;

-- Tout authentifié peut lire (thème global ou de son temple)
CREATE POLICY "scoped read themes" ON public.themes_annee FOR SELECT TO authenticated
USING (temple_id IS NULL OR public.can_access_temple(auth.uid(), temple_id));

-- Seuls les super admins peuvent gérer les thèmes globaux ; admin temple gère ceux de son temple
CREATE POLICY "admin insert themes" ON public.themes_annee FOR INSERT TO authenticated
WITH CHECK (
  (temple_id IS NULL AND public.is_super(auth.uid()))
  OR (temple_id IS NOT NULL AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
);
CREATE POLICY "admin update themes" ON public.themes_annee FOR UPDATE TO authenticated
USING (
  (temple_id IS NULL AND public.is_super(auth.uid()))
  OR (temple_id IS NOT NULL AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
);
CREATE POLICY "admin delete themes" ON public.themes_annee FOR DELETE TO authenticated
USING (
  (temple_id IS NULL AND public.is_super(auth.uid()))
  OR (temple_id IS NOT NULL AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), temple_id))
);

CREATE TRIGGER themes_annee_set_updated_at BEFORE UPDATE ON public.themes_annee
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sous-thèmes (trimestre ou mois)
CREATE TABLE public.sous_themes_annee (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_id UUID NOT NULL REFERENCES public.themes_annee(id) ON DELETE CASCADE,
  periode_type public.sous_theme_periode NOT NULL,
  periode_num INTEGER NOT NULL, -- 1-4 si trimestre, 1-12 si mois
  titre TEXT NOT NULL,
  versets TEXT,
  objectifs TEXT,
  activites TEXT,
  avancement INTEGER NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (theme_id, periode_type, periode_num)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sous_themes_annee TO authenticated;
GRANT ALL ON public.sous_themes_annee TO service_role;
ALTER TABLE public.sous_themes_annee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read sous_themes" ON public.sous_themes_annee FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.themes_annee t
  WHERE t.id = theme_id
    AND (t.temple_id IS NULL OR public.can_access_temple(auth.uid(), t.temple_id))
));

CREATE POLICY "admin manage sous_themes" ON public.sous_themes_annee FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.themes_annee t
  WHERE t.id = theme_id AND (
    (t.temple_id IS NULL AND public.is_super(auth.uid()))
    OR (t.temple_id IS NOT NULL AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), t.temple_id))
  )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.themes_annee t
  WHERE t.id = theme_id AND (
    (t.temple_id IS NULL AND public.is_super(auth.uid()))
    OR (t.temple_id IS NOT NULL AND public.is_admin(auth.uid()) AND public.can_access_temple(auth.uid(), t.temple_id))
  )
));

CREATE TRIGGER sous_themes_set_updated_at BEFORE UPDATE ON public.sous_themes_annee
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
