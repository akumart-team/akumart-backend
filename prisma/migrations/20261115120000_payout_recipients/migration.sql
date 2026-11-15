CREATE TABLE public.payout_recipients (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  recipient_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_last4 CHAR(4) NOT NULL CHECK (account_last4 ~ '^[0-9]{4}$'),
  bank_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL
);
ALTER TABLE public.payout_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payout_recipients FROM anon, authenticated;
