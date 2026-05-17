DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower('seahudson12@gmail.com') LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Utilisateur seahudson12@gmail.com introuvable';
  END IF;

  ALTER TABLE public.user_roles DISABLE TRIGGER USER;

  DELETE FROM public.user_roles WHERE user_id = uid;
  INSERT INTO public.user_roles (user_id, role, temple_id)
  VALUES (uid, 'super_admin_principal'::app_role, NULL);

  ALTER TABLE public.user_roles ENABLE TRIGGER USER;

  INSERT INTO public.role_changes (target_user_id, changed_by, previous_role, new_role, temple_id)
  VALUES (uid, uid, NULL, 'super_admin_principal'::app_role, NULL);
END $$;