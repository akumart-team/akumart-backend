-- Run after the enum migration commits. Supabase creates the profile and companion
-- rows in the same transaction; record the signup choice once, never on later login.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE chosen_role text := NEW.raw_user_meta_data->>'market_role';
BEGIN
  INSERT INTO public.profiles
    (id, email, first_name, last_name, phone, city, terms_accepted_at, terms_version, updated_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(COALESCE(NEW.raw_user_meta_data->>'full_name',''), ' ', 1), ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name',''), '^\S+\s*', ''), ''), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'phone'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'city'), ''),
    (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz,
    NEW.raw_user_meta_data->>'terms_version', now()
  );
  -- These are preferences, never trusted staff/partner permissions. OAuth and old
  -- clients without a valid choice must complete onboarding rather than gain a role.
  IF chosen_role IN ('buyer', 'seller', 'both', 'logistics', 'recycler') THEN
    UPDATE public.user_preferences SET
      market_role = chosen_role::public."MarketRole",
      active_mode = CASE
        WHEN chosen_role = 'seller' THEN 'seller'::public."MarketMode"
        WHEN chosen_role IN ('buyer', 'both') THEN 'buyer'::public."MarketMode"
        ELSE NULL END,
      updated_at = now()
    WHERE profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
