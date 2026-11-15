-- Forward-only hardening; do not alter previously applied migration files.
BEGIN;

-- Unbound temporary codes cannot be assigned a real bin/device without inventing history.
-- If legacy issued rows exist, close/archive them deliberately before retrying this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.bin_sessions WHERE status = 'issued' OR bin_id IS NULL) THEN
    RAISE EXCEPTION 'Resolve legacy issued/unbound bin sessions before migrating to permanent-PIN sessions';
  END IF;
END $$;
ALTER TABLE public.bin_sessions DROP CONSTRAINT bin_sessions_state_check;
DROP INDEX public.bin_sessions_one_issued_per_profile;
DROP INDEX public.bin_sessions_one_active_per_bin;
DROP INDEX public.bin_sessions_one_active_per_profile;

-- CreateEnum
CREATE TYPE "DeviceAuthMode" AS ENUM ('authenticated', 'legacy_bin_id');

-- AlterEnum
CREATE TYPE "BinSessionStatus_new" AS ENUM ('active', 'ended', 'expired', 'revoked');
ALTER TABLE "bin_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bin_sessions" ALTER COLUMN "status" TYPE "BinSessionStatus_new" USING ("status"::text::"BinSessionStatus_new");
ALTER TYPE "BinSessionStatus" RENAME TO "BinSessionStatus_old";
ALTER TYPE "BinSessionStatus_new" RENAME TO "BinSessionStatus";
DROP TYPE "BinSessionStatus_old";
ALTER TABLE "bin_sessions" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'superseded';

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_session_id_fkey";

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_device_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger_entries" DROP CONSTRAINT "points_ledger_entries_deposit_id_fkey";

-- DropForeignKey
ALTER TABLE "points_ledger_entries" DROP CONSTRAINT "points_ledger_entries_redemption_id_fkey";

-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_order_id_fkey";

-- DropForeignKey
ALTER TABLE "order_reviews" DROP CONSTRAINT "order_reviews_order_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_owner_id_fkey";

-- DropIndex
DROP INDEX "bin_sessions_code_hash_key";

-- DropIndex
DROP INDEX "uploads_storage_key_key";

-- DropIndex
DROP INDEX "uploads_owner_id_created_at_idx";

-- DropIndex
DROP INDEX "verification_submissions_provider_reference_key";

-- AlterTable
ALTER TABLE "bin_devices" ADD COLUMN     "auth_mode" "DeviceAuthMode" NOT NULL DEFAULT 'authenticated',
ALTER COLUMN "credential_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bin_sessions" DROP COLUMN "code_hash",
ADD COLUMN     "device_id" UUID,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ(3),
ALTER COLUMN "bin_id" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active',
ALTER COLUMN "started_at" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE public.bin_sessions s SET
  device_id = COALESCE(
    (SELECT d.device_id FROM public.deposits d WHERE d.session_id = s.id ORDER BY d.created_at LIMIT 1),
    (SELECT d.id FROM public.bin_devices d WHERE d.bin_id = s.bin_id AND d.revoked_at IS NULL ORDER BY d.created_at LIMIT 1)
  ),
  started_at = COALESCE(s.started_at, s.created_at),
  last_activity_at = GREATEST(COALESCE(s.started_at, s.created_at), COALESCE(
    (SELECT max(d.created_at) FROM public.deposits d WHERE d.session_id = s.id), s.created_at
  )),
  ended_at = CASE WHEN s.status <> 'active' THEN COALESCE(s.ended_at, s.expires_at) ELSE s.ended_at END;

-- Extending a historical expiry by a millisecond preserves ordering without dropping history.
UPDATE public.bin_sessions SET expires_at = last_activity_at + interval '1 millisecond'
WHERE expires_at <= last_activity_at;
ALTER TABLE public.bin_sessions ALTER COLUMN device_id SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL, ALTER COLUMN last_activity_at SET NOT NULL,
  ALTER COLUMN last_activity_at SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "deposits" ADD COLUMN     "profile_id" UUID,
ALTER COLUMN "weight_kg" SET DATA TYPE DECIMAL(18,6),
ALTER COLUMN "measured_at" DROP NOT NULL;
UPDATE public.deposits d SET profile_id = s.profile_id FROM public.bin_sessions s WHERE s.id = d.session_id;
ALTER TABLE public.deposits ALTER COLUMN profile_id SET NOT NULL;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "reserved_quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN     "sold_quantity" DECIMAL(18,3) NOT NULL DEFAULT 0;
UPDATE public.listings SET sold_quantity = quantity WHERE status = 'sold';

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "seller_id" UUID;
UPDATE public.offers o SET seller_id = l.seller_id FROM public.listings l WHERE l.id = o.listing_id;
ALTER TABLE public.offers ALTER COLUMN seller_id SET NOT NULL;

-- AlterTable
-- Preserve attribution: this is a rename, not a drop-and-add.
ALTER TABLE "uploads" RENAME COLUMN "owner_id" TO "uploaded_by_id";
ALTER TABLE "uploads" DROP COLUMN "is_public";

-- AlterTable
ALTER TABLE "verification_submissions" ADD COLUMN     "expires_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "bin_telemetry" (
    "id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "distance_cm" DECIMAL(10,3) NOT NULL,
    "reported_full" BOOLEAN NOT NULL,
    "device_uptime_ms" BIGINT NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_telemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_events" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bin_telemetry_bin_id_received_at_idx" ON "bin_telemetry"("bin_id", "received_at");

-- CreateIndex
CREATE INDEX "bin_telemetry_device_id_received_at_idx" ON "bin_telemetry"("device_id", "received_at");

-- CreateIndex
CREATE INDEX "verification_events_submission_id_created_at_idx" ON "verification_events"("submission_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bin_devices_id_bin_id_key" ON "bin_devices"("id", "bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_sessions_id_bin_id_profile_id_device_id_key" ON "bin_sessions"("id", "bin_id", "profile_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_id_profile_id_key" ON "deposits"("id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_deposit_id_profile_id_key" ON "points_ledger_entries"("deposit_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_id_seller_id_key" ON "listings"("id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_id_listing_id_buyer_id_seller_id_key" ON "offers"("id", "listing_id", "buyer_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_opened_by_id_key" ON "disputes"("order_id", "opened_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_reviews_order_id_buyer_id_key" ON "order_reviews"("order_id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_offer_id_listing_id_buyer_id_seller_id_key" ON "orders"("offer_id", "listing_id", "buyer_id", "seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_buyer_id_key" ON "orders"("id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_id_profile_id_key" ON "redemptions"("id", "profile_id");

-- CreateIndex
CREATE INDEX "uploads_uploaded_by_id_created_at_idx" ON "uploads"("uploaded_by_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_provider_storage_key_key" ON "uploads"("provider", "storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "verification_submissions_provider_provider_reference_key" ON "verification_submissions"("provider", "provider_reference");

-- AddForeignKey
ALTER TABLE "bin_sessions" ADD CONSTRAINT "bin_sessions_device_id_bin_id_fkey" FOREIGN KEY ("device_id", "bin_id") REFERENCES "bin_devices"("id", "bin_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "bin_telemetry" ADD CONSTRAINT "bin_telemetry_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_telemetry" ADD CONSTRAINT "bin_telemetry_device_id_bin_id_fkey" FOREIGN KEY ("device_id", "bin_id") REFERENCES "bin_devices"("id", "bin_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_session_id_bin_id_profile_id_device_id_fkey" FOREIGN KEY ("session_id", "bin_id", "profile_id", "device_id") REFERENCES "bin_sessions"("id", "bin_id", "profile_id", "device_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_device_id_bin_id_fkey" FOREIGN KEY ("device_id", "bin_id") REFERENCES "bin_devices"("id", "bin_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_deposit_id_profile_id_fkey" FOREIGN KEY ("deposit_id", "profile_id") REFERENCES "deposits"("id", "profile_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_redemption_id_profile_id_fkey" FOREIGN KEY ("redemption_id", "profile_id") REFERENCES "redemptions"("id", "profile_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_seller_id_fkey" FOREIGN KEY ("listing_id", "seller_id") REFERENCES "listings"("id", "seller_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_opened_by_id_fkey" FOREIGN KEY ("order_id", "opened_by_id") REFERENCES "orders"("id", "buyer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_order_id_buyer_id_fkey" FOREIGN KEY ("order_id", "buyer_id") REFERENCES "orders"("id", "buyer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_listing_id_buyer_id_seller_id_fkey" FOREIGN KEY ("offer_id", "listing_id", "buyer_id", "seller_id") REFERENCES "offers"("id", "listing_id", "buyer_id", "seller_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_seller_id_fkey" FOREIGN KEY ("listing_id", "seller_id") REFERENCES "listings"("id", "seller_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "verification_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Total stock is retained when stock is sold/reserved. Zero remaining stock is valid.
ALTER TABLE public.listings DROP CONSTRAINT listings_amounts_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_amounts_check CHECK (
  quantity >= 0 AND reserved_quantity >= 0 AND sold_quantity >= 0
  AND reserved_quantity + sold_quantity <= quantity AND min_order > 0
  AND (quantity = 0 OR min_order <= quantity) AND unit_price >= 0 AND views >= 0
);
ALTER TABLE public.offers ADD CONSTRAINT offers_participants_check CHECK (buyer_id <> seller_id);
ALTER TABLE public.offers ADD CONSTRAINT offers_version_check CHECK (version >= 0 AND expires_at > created_at);
ALTER TABLE public.orders ADD CONSTRAINT orders_version_check CHECK (version >= 0);
ALTER TABLE public.bin_devices ADD CONSTRAINT bin_devices_auth_mode_check CHECK (
  (auth_mode = 'authenticated' AND credential_hash IS NOT NULL)
  OR (auth_mode = 'legacy_bin_id' AND credential_hash IS NULL)
);
-- Current firmware sends binId only: map it to exactly one non-revoked controller.
CREATE UNIQUE INDEX bin_devices_one_live_controller ON public.bin_devices (bin_id) WHERE revoked_at IS NULL;
ALTER TABLE public.bin_sessions ADD CONSTRAINT bin_sessions_state_check CHECK (
  started_at >= created_at AND last_activity_at >= started_at AND expires_at > last_activity_at
  AND ((status = 'active' AND ended_at IS NULL) OR (status <> 'active' AND ended_at IS NOT NULL))
  AND (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX bin_sessions_one_active_per_bin ON public.bin_sessions (bin_id) WHERE status = 'active';
CREATE UNIQUE INDEX bin_sessions_one_active_per_profile ON public.bin_sessions (profile_id) WHERE status = 'active';
ALTER TABLE public.bin_telemetry ADD CONSTRAINT bin_telemetry_readings_check CHECK (
  distance_cm >= 0 AND device_uptime_ms BETWEEN 0 AND 4294967295
);
CREATE UNIQUE INDEX verification_one_open_submission ON public.verification_submissions (profile_id, level)
  WHERE status IN ('collecting', 'checking', 'pending_review');
CREATE UNIQUE INDEX verification_one_approval ON public.verification_submissions (profile_id, level)
  WHERE status = 'approved';
ALTER TABLE public.verification_submissions ADD CONSTRAINT verification_provider_pair_check CHECK (
  provider_reference IS NULL OR provider IS NOT NULL
);
ALTER TABLE public.verification_submissions ADD CONSTRAINT verification_expiry_check CHECK (
  expires_at IS NULL OR expires_at > created_at
);
ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_attempts_check CHECK (attempts >= 0);
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_reference_check CHECK (
  status <> 'succeeded' OR (provider_reference IS NOT NULL AND paid_at IS NOT NULL)
);

-- Compatibility completion flag mirrors recorded onboarding, avoiding two independent states.
-- Old true flags have no exact event time; updated_at is retained as the legacy completion estimate.
UPDATE public.profiles SET onboarded_at = updated_at WHERE profile_completed AND onboarded_at IS NULL;
UPDATE public.profiles SET profile_completed = true WHERE onboarded_at IS NOT NULL AND NOT profile_completed;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_check CHECK (
  profile_completed = (onboarded_at IS NOT NULL)
);

-- Refuse to silently rewrite any previously inconsistent financial history.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.points_wallets w
    WHERE w.balance <> COALESCE((SELECT sum(e.amount) FROM public.points_ledger_entries e WHERE e.profile_id = w.profile_id), 0)
  ) THEN
    RAISE EXCEPTION 'Reconcile existing wallet balances with the ledger before applying schema integrity migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.points_ledger_entries e
    LEFT JOIN public.deposits d ON d.id = e.deposit_id
    LEFT JOIN public.redemptions r ON r.id = e.redemption_id
    WHERE (e.kind = 'deposit_credit' AND (d.status <> 'verified' OR e.amount <> d.awarded_points))
       OR (e.kind IN ('redemption_debit', 'redemption_refund') AND abs(e.amount) <> r.cost_points)
       OR (e.kind = 'redemption_refund' AND NOT EXISTS (
         SELECT 1 FROM public.points_ledger_entries original WHERE original.redemption_id = e.redemption_id AND original.kind = 'redemption_debit'
       ))
  ) THEN
    RAISE EXCEPTION 'Reconcile existing ledger source amounts before applying schema integrity migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payments p WHERE
      (SELECT COALESCE(sum(r.amount), 0) FROM public.refunds r WHERE r.payment_id = p.id AND r.status <> 'failed') > p.amount
  ) THEN
    RAISE EXCEPTION 'Reconcile existing over-allocated refunds before applying schema integrity migration';
  END IF;
END $$;

-- History is immutable. Corrections use new events/adjustments rather than overwriting evidence.
CREATE FUNCTION public.prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'History rows are append-only: %', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER points_ledger_append_only BEFORE UPDATE OR DELETE ON public.points_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();
CREATE TRIGGER consent_records_append_only BEFORE UPDATE OR DELETE ON public.consent_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();
CREATE TRIGGER verification_events_append_only BEFORE UPDATE OR DELETE ON public.verification_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();
CREATE TRIGGER order_events_append_only BEFORE UPDATE OR DELETE ON public.order_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();

-- Validate credit/debit sources and update the balance in the same database statement.
CREATE FUNCTION public.apply_points_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE expected_amount numeric; source_status text;
BEGIN
  IF NEW.kind = 'deposit_credit' THEN
    SELECT d.awarded_points, d.status::text INTO expected_amount, source_status
    FROM public.deposits d WHERE d.id = NEW.deposit_id AND d.profile_id = NEW.profile_id FOR UPDATE;
    IF NOT FOUND OR source_status <> 'verified' OR NEW.amount <> expected_amount THEN
      RAISE EXCEPTION 'Deposit credit must match a verified deposit and its account' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.kind IN ('redemption_debit', 'redemption_refund') THEN
    SELECT r.cost_points, r.status::text INTO expected_amount, source_status FROM public.redemptions r
    WHERE r.id = NEW.redemption_id AND r.profile_id = NEW.profile_id FOR UPDATE;
    IF NOT FOUND OR abs(NEW.amount) <> expected_amount THEN
      RAISE EXCEPTION 'Redemption entry must match its cost and account' USING ERRCODE = '23514';
    END IF;
    IF NEW.kind = 'redemption_refund' AND NOT EXISTS (
      SELECT 1 FROM public.points_ledger_entries e WHERE e.redemption_id = NEW.redemption_id AND e.kind = 'redemption_debit'
    ) THEN
      RAISE EXCEPTION 'Cannot refund points without the original debit' USING ERRCODE = '23514';
    END IF;
    IF NEW.kind = 'redemption_refund' AND source_status NOT IN ('rejected', 'failed') THEN
      RAISE EXCEPTION 'Only rejected or failed redemptions can reverse their points' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.points_wallets SET balance = balance + NEW.amount,
    version = version + 1, updated_at = now() WHERE profile_id = NEW.profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Points wallet does not exist' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
-- AFTER INSERT prevents a duplicate INSERT ... ON CONFLICT DO NOTHING from changing balances.
CREATE TRIGGER points_ledger_apply_balance AFTER INSERT ON public.points_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.apply_points_entry();

CREATE FUNCTION public.protect_wallet_projection() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.balance <> 0 OR NEW.version <> 0 THEN
      RAISE EXCEPTION 'Wallets must start with zero points; credit through the ledger' USING ERRCODE = '23514';
    END IF;
  ELSIF (NEW.balance IS DISTINCT FROM OLD.balance OR NEW.version IS DISTINCT FROM OLD.version) AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Wallet balance can only change through ledger entries' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER points_wallet_projection_guard BEFORE INSERT OR UPDATE ON public.points_wallets
FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_projection();

-- Source amounts/ownership may not be edited after a financial ledger entry exists.
CREATE FUNCTION public.protect_credited_deposit() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.points_ledger_entries e WHERE e.deposit_id = OLD.id) AND
    ROW(NEW.session_id, NEW.profile_id, NEW.bin_id, NEW.device_id, NEW.device_event_id, NEW.material,
        NEW.measure, NEW.amount, NEW.weight_kg, NEW.status, NEW.awarded_points, NEW.points_rate, NEW.item_kg_equivalent)
    IS DISTINCT FROM
    ROW(OLD.session_id, OLD.profile_id, OLD.bin_id, OLD.device_id, OLD.device_event_id, OLD.material,
        OLD.measure, OLD.amount, OLD.weight_kg, OLD.status, OLD.awarded_points, OLD.points_rate, OLD.item_kg_equivalent) THEN
    RAISE EXCEPTION 'Credited deposit facts are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER deposits_protect_credit BEFORE UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.protect_credited_deposit();

CREATE FUNCTION public.protect_debited_redemption() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'Completed redemptions cannot be reversed by changing their status' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.points_ledger_entries e WHERE e.redemption_id = OLD.id) AND
    ROW(NEW.profile_id, NEW.reward_id, NEW.reward_name, NEW.kind, NEW.cost_points, NEW.value_amount, NEW.currency,
        NEW.recipient_phone, NEW.payout_recipient_reference, NEW.idempotency_key)
    IS DISTINCT FROM
    ROW(OLD.profile_id, OLD.reward_id, OLD.reward_name, OLD.kind, OLD.cost_points, OLD.value_amount, OLD.currency,
        OLD.recipient_phone, OLD.payout_recipient_reference, OLD.idempotency_key) THEN
    RAISE EXCEPTION 'Debited redemption terms are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER redemptions_protect_debit BEFORE UPDATE ON public.redemptions
FOR EACH ROW EXECUTE FUNCTION public.protect_debited_redemption();

-- Lock the payment to serialize competing refunds; pending refunds reserve funds too.
CREATE FUNCTION public.validate_refund_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE captured numeric; already_allocated numeric; payment_order uuid; payment_status text;
BEGIN
  SELECT p.amount, p.order_id, p.status::text INTO captured, payment_order, payment_status
  FROM public.payments p WHERE p.id = NEW.payment_id FOR UPDATE;
  IF NOT FOUND OR payment_status <> 'succeeded' THEN
    RAISE EXCEPTION 'Refund requires a confirmed payment' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND ROW(NEW.payment_id, NEW.amount, NEW.idempotency_key, NEW.dispute_id)
    IS DISTINCT FROM ROW(OLD.payment_id, OLD.amount, OLD.idempotency_key, OLD.dispute_id) THEN
    RAISE EXCEPTION 'Refund allocation facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'Completed refunds cannot release their allocation' USING ERRCODE = '23514';
  END IF;
  IF NEW.dispute_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.disputes d WHERE d.id = NEW.dispute_id AND d.order_id = payment_order
  ) THEN
    RAISE EXCEPTION 'Refund dispute must belong to the payment order' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'failed' THEN
    SELECT COALESCE(sum(r.amount), 0) INTO already_allocated FROM public.refunds r
    WHERE r.payment_id = NEW.payment_id AND r.id <> NEW.id AND r.status <> 'failed';
    IF already_allocated + NEW.amount > captured THEN
      RAISE EXCEPTION 'Refund total exceeds captured payment' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refunds_validate_allocation BEFORE INSERT OR UPDATE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.validate_refund_allocation();
CREATE TRIGGER refunds_preserve_history BEFORE DELETE ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.prevent_history_mutation();

ALTER TABLE public.bin_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles, public.bin_telemetry, public.verification_events FROM anon, authenticated;

-- Accept new deposits only for an active, unexpired session on a live device.
CREATE FUNCTION public.validate_deposit_session() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE session_row public.bin_sessions%ROWTYPE;
BEGIN
  SELECT * INTO session_row FROM public.bin_sessions WHERE id = NEW.session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'active' OR session_row.expires_at <= now()
    OR session_row.bin_id <> NEW.bin_id OR session_row.profile_id <> NEW.profile_id
    OR session_row.device_id <> NEW.device_id THEN
    RAISE EXCEPTION 'Deposit requires a matching active, unexpired session' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bin_devices d WHERE d.id = NEW.device_id AND d.bin_id = NEW.bin_id AND d.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Deposit device is revoked or does not belong to this bin' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER deposits_validate_session BEFORE INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.validate_deposit_session();

CREATE FUNCTION public.protect_session_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.profile_id, NEW.bin_id, NEW.device_id, NEW.started_at, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.profile_id, OLD.bin_id, OLD.device_id, OLD.started_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Session identity is immutable; start a new session instead' USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'active' AND ROW(NEW.status, NEW.last_activity_at, NEW.expires_at, NEW.ended_at)
    IS DISTINCT FROM ROW(OLD.status, OLD.last_activity_at, OLD.expires_at, OLD.ended_at) THEN
    RAISE EXCEPTION 'Closed sessions cannot be reopened or rewritten' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bin_sessions_protect_identity BEFORE UPDATE ON public.bin_sessions
FOR EACH ROW EXECUTE FUNCTION public.protect_session_identity();

CREATE FUNCTION public.protect_confirmed_payment() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'succeeded' AND (
    NEW.status <> 'succeeded' OR
    ROW(NEW.order_id, NEW.campaign_id, NEW.amount, NEW.currency, NEW.provider, NEW.provider_reference, NEW.idempotency_key, NEW.paid_at)
    IS DISTINCT FROM ROW(OLD.order_id, OLD.campaign_id, OLD.amount, OLD.currency, OLD.provider, OLD.provider_reference, OLD.idempotency_key, OLD.paid_at)
  ) THEN
    RAISE EXCEPTION 'Confirmed payment facts are immutable; record refunds separately' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_protect_confirmation BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_confirmed_payment();

COMMIT;
