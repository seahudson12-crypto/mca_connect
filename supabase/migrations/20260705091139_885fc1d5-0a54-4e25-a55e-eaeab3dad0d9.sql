
-- Enums
DO $$ BEGIN
  CREATE TYPE public.wa_campagne_status AS ENUM ('draft','scheduled','sending','sent','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_envoi_status AS ENUM ('queued','sent','delivered','read','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_message_type AS ENUM ('text','image','document','video','audio','template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ wa_campagnes ============
CREATE TABLE public.wa_campagnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  message TEXT,
  message_type public.wa_message_type NOT NULL DEFAULT 'text',
  media_url TEXT,
  media_mime TEXT,
  template_name TEXT,
  template_lang TEXT DEFAULT 'fr',
  template_variables JSONB DEFAULT '[]'::jsonb,
  filter_temples UUID[] DEFAULT '{}',
  filter_categories TEXT[] DEFAULT '{}',
  filter_statuses TEXT[] DEFAULT '{}',
  destinataires_manuels UUID[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status public.wa_campagne_status NOT NULL DEFAULT 'draft',
  stats_total INT NOT NULL DEFAULT 0,
  stats_sent INT NOT NULL DEFAULT 0,
  stats_delivered INT NOT NULL DEFAULT 0,
  stats_read INT NOT NULL DEFAULT 0,
  stats_failed INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  temple_id UUID REFERENCES public.temples(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campagnes TO authenticated;
GRANT ALL ON public.wa_campagnes TO service_role;

ALTER TABLE public.wa_campagnes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_campagnes admins select" ON public.wa_campagnes
  FOR SELECT TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_campagnes admins insert" ON public.wa_campagnes
  FOR INSERT TO authenticated WITH CHECK (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_campagnes admins update" ON public.wa_campagnes
  FOR UPDATE TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_campagnes admins delete" ON public.wa_campagnes
  FOR DELETE TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE TRIGGER trg_wa_campagnes_updated
  BEFORE UPDATE ON public.wa_campagnes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ wa_envois ============
CREATE TABLE public.wa_envois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id UUID REFERENCES public.wa_campagnes(id) ON DELETE CASCADE,
  membre_id UUID REFERENCES public.membres(id) ON DELETE SET NULL,
  temple_id UUID REFERENCES public.temples(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  message_type public.wa_message_type NOT NULL DEFAULT 'text',
  rendered_message TEXT,
  wa_message_id TEXT UNIQUE,
  status public.wa_envoi_status NOT NULL DEFAULT 'queued',
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_envois_campagne ON public.wa_envois(campagne_id);
CREATE INDEX idx_wa_envois_membre ON public.wa_envois(membre_id);
CREATE INDEX idx_wa_envois_temple ON public.wa_envois(temple_id);
CREATE INDEX idx_wa_envois_wa_msg_id ON public.wa_envois(wa_message_id);
CREATE INDEX idx_wa_envois_status ON public.wa_envois(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_envois TO authenticated;
GRANT ALL ON public.wa_envois TO service_role;

ALTER TABLE public.wa_envois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_envois admins select" ON public.wa_envois
  FOR SELECT TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_envois admins insert" ON public.wa_envois
  FOR INSERT TO authenticated WITH CHECK (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_envois admins update" ON public.wa_envois
  FOR UPDATE TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE TRIGGER trg_wa_envois_updated
  BEFORE UPDATE ON public.wa_envois
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ wa_templates ============
CREATE TABLE public.wa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id TEXT,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr',
  category TEXT,
  status TEXT,
  components JSONB DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_templates TO authenticated;
GRANT ALL ON public.wa_templates TO service_role;

ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_templates admins read" ON public.wa_templates
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "wa_templates super write" ON public.wa_templates
  FOR ALL TO authenticated
  USING (public.is_super(auth.uid()))
  WITH CHECK (public.is_super(auth.uid()));

CREATE TRIGGER trg_wa_templates_updated
  BEFORE UPDATE ON public.wa_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ wa_notifications_auto ============
CREATE TABLE public.wa_notifications_auto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  template_name TEXT,
  template_lang TEXT DEFAULT 'fr',
  message TEXT,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE,
  config JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(type, temple_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_notifications_auto TO authenticated;
GRANT ALL ON public.wa_notifications_auto TO service_role;

ALTER TABLE public.wa_notifications_auto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_notif admins select" ON public.wa_notifications_auto
  FOR SELECT TO authenticated USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE POLICY "wa_notif admins all" ON public.wa_notifications_auto
  FOR ALL TO authenticated
  USING (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  )
  WITH CHECK (
    public.is_super(auth.uid())
    OR (public.has_role(auth.uid(),'admin_temple'::app_role) AND temple_id = public.current_user_temple_id())
  );

CREATE TRIGGER trg_wa_notif_updated
  BEFORE UPDATE ON public.wa_notifications_auto
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
