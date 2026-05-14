
CREATE TABLE public.role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  changed_by UUID,
  previous_role app_role,
  new_role app_role NOT NULL,
  temple_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin read role_changes"
  ON public.role_changes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "super_admin insert role_changes"
  ON public.role_changes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND changed_by = auth.uid());

CREATE INDEX idx_role_changes_created_at ON public.role_changes (created_at DESC);
CREATE INDEX idx_role_changes_target ON public.role_changes (target_user_id);
