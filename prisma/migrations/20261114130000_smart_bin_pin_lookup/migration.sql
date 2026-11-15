-- Additive: retain existing PIN verification hashes and lockout state.
ALTER TABLE public.user_security ADD COLUMN pin_lookup_hash VARCHAR(64);

CREATE UNIQUE INDEX user_security_pin_lookup_hash_key
ON public.user_security (pin_lookup_hash);

ALTER TABLE public.user_security
ADD CONSTRAINT user_security_pin_lookup_hash_check CHECK (
  pin_lookup_hash IS NULL
  OR (pin_lookup_hash ~ '^[0-9a-f]{64}$' AND pin_hash IS NOT NULL)
);

-- Existing salted hashes cannot be converted into lookup hashes without the original PIN.
-- Existing users need to enter/reset their PIN through an authenticated provisioning flow.
