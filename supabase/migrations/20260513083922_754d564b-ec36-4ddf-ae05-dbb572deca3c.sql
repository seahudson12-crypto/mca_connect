
-- Enums
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_temple', 'utilisateur');
CREATE TYPE public.membre_categorie AS ENUM (
  'hommes_adultes','femmes_adultes','jeunes_hommes','jeunes_filles',
  'groupe_musical','ecodim','moniteurs','appeles','serviteurs_de_dieu',
  'nouvelles_ames','pasteurs'
);
CREATE TYPE public.sexe AS ENUM ('M','F');
CREATE TYPE public.culte_type AS ENUM ('dimanche','semaine','veillee','reunion_speciale','jeune_priere');
CREATE TYPE public.presence_statut AS ENUM ('present','absent','excuse');

-- TEMPLES
CREATE TABLE public.temples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_temple TEXT NOT NULL,
  ville TEXT,
  commune TEXT,
  pays TEXT DEFAULT 'Côte d''Ivoire',
  logo TEXT,
  pasteur_responsable TEXT,
  telephone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT,
  email TEXT,
  temple_id UUID REFERENCES public.temples(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, temple_id)
);

-- MEMBRES
CREATE TABLE public.membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenoms TEXT NOT NULL,
  sexe public.sexe,
  telephone TEXT,
  whatsapp TEXT,
  categorie public.membre_categorie NOT NULL,
  date_ajout DATE NOT NULL DEFAULT CURRENT_DATE,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CULTES
CREATE TABLE public.cultes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  temple_id UUID NOT NULL REFERENCES public.temples(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type_culte public.culte_type NOT NULL,
  heure_debut TIME,
  heure_fin TIME,
  president TEXT,
  theme_presidence TEXT,
  versets TEXT,
  responsable_priere TEXT,
  orateur TEXT,
  theme_principal TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRESENCES
CREATE TABLE public.presences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id UUID NOT NULL REFERENCES public.membres(id) ON DELETE CASCADE,
  culte_id UUID NOT NULL REFERENCES public.cultes(id) ON DELETE CASCADE,
  statut public.presence_statut NOT NULL DEFAULT 'absent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membre_id, culte_id)
);

-- has_role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin_temple'))
$$;

-- Trigger: auto-create profile on new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_temple UUID;
BEGIN
  SELECT id INTO default_temple FROM public.temples ORDER BY created_at LIMIT 1;
  INSERT INTO public.profiles (id, nom, email, temple_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email), NEW.email, default_temple);
  -- Default role
  INSERT INTO public.user_roles (user_id, role, temple_id)
  VALUES (NEW.id, 'utilisateur', default_temple);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_temples_updated BEFORE UPDATE ON public.temples FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_membres_updated BEFORE UPDATE ON public.membres FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cultes_updated BEFORE UPDATE ON public.cultes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.temples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cultes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;

-- Temples policies
CREATE POLICY "auth read temples" ON public.temples FOR SELECT TO authenticated USING (true);
CREATE POLICY "super_admin manage temples" ON public.temples FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Profiles policies
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "super_admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Membres policies
CREATE POLICY "auth read membres" ON public.membres FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert membres" ON public.membres FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin update membres" ON public.membres FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin delete membres" ON public.membres FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Cultes policies
CREATE POLICY "auth read cultes" ON public.cultes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cultes" ON public.cultes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cultes" ON public.cultes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete cultes" ON public.cultes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Presences policies
CREATE POLICY "auth read presences" ON public.presences FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage presences" ON public.presences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_membres_temple ON public.membres(temple_id);
CREATE INDEX idx_membres_categorie ON public.membres(categorie);
CREATE INDEX idx_cultes_temple_date ON public.cultes(temple_id, date DESC);
CREATE INDEX idx_presences_culte ON public.presences(culte_id);
CREATE INDEX idx_presences_membre ON public.presences(membre_id);
