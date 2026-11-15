-- CreateEnum
CREATE TYPE "Material" AS ENUM ('plastic', 'metal', 'glass', 'cardboard', 'paper', 'wood', 'textiles', 'rubber');

-- CreateEnum
CREATE TYPE "MarketRole" AS ENUM ('buyer', 'seller', 'both', 'none');

-- CreateEnum
CREATE TYPE "MarketMode" AS ENUM ('buyer', 'seller');

-- CreateEnum
CREATE TYPE "ConsentDocument" AS ENUM ('terms', 'privacy');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('super', 'operations', 'support', 'finance', 'content');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('listing_image', 'verification_document', 'partner_document', 'delivery_proof', 'dispute_evidence', 'campaign_creative', 'article_image');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'ready', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('basic', 'full');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('individual', 'business');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('collecting', 'checking', 'approved', 'pending_review', 'rejected', 'needs_resubmission');

-- CreateEnum
CREATE TYPE "MaterialCondition" AS ENUM ('baled', 'loose', 'sorted', 'shredded', 'mixed');

-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('kg', 'tonne');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'published', 'flagged', 'sold', 'paused');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('awaiting_seller', 'awaiting_buyer', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "OfferAction" AS ENUM ('offer', 'counter', 'accept', 'reject', 'expire');

-- CreateEnum
CREATE TYPE "BuyerRequestStatus" AS ENUM ('open', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "RequestResponseStatus" AS ENUM ('sent', 'shortlisted', 'declined');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('choose_fulfilment', 'awaiting_quotes', 'no_quotes', 'awaiting_payment', 'paid', 'picked_up', 'in_transit', 'delivered', 'proof_uploaded', 'confirmed', 'settled', 'disputed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('unpaid', 'failed', 'held', 'released', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'under_review', 'resolved');

-- CreateEnum
CREATE TYPE "DisputeDecision" AS ENUM ('refund', 'partial', 'release');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('submitted', 'selected', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "QuoteKind" AS ENUM ('accept', 'counter');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SettlementBeneficiary" AS ENUM ('seller', 'partner');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('pending', 'processing', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "BinStatus" AS ENUM ('online', 'offline', 'full', 'maintenance');

-- CreateEnum
CREATE TYPE "BinSessionStatus" AS ENUM ('issued', 'active', 'ended', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "DepositMeasure" AS ENUM ('weight', 'count');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('verified', 'rejected');

-- CreateEnum
CREATE TYPE "PointsEntryKind" AS ENUM ('deposit_credit', 'redemption_debit', 'redemption_refund', 'adjustment');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('airtime', 'cash', 'physical');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('pending_review', 'approved', 'processing', 'completed', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('draft', 'published', 'unpublished');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('proposed', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'expired');

-- CreateEnum
CREATE TYPE "CampaignEventKind" AS ENUM ('impression', 'click');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('ai_chat', 'contact', 'report', 'dispute');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'assigned', 'resolved');

-- CreateEnum
CREATE TYPE "EnquiryKind" AS ENUM ('general', 'support', 'business', 'logistics');

-- CreateEnum
CREATE TYPE "RecommendationResource" AS ENUM ('listing', 'article', 'job');

-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('impression', 'view', 'save', 'dismiss', 'contact');

-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('user', 'assistant');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "display_name" VARCHAR(100),
ADD COLUMN     "onboarded_at" TIMESTAMPTZ(3),
ADD COLUMN     "phone" VARCHAR(25);

-- CreateTable
CREATE TABLE "user_preferences" (
    "profile_id" UUID NOT NULL,
    "market_role" "MarketRole" NOT NULL DEFAULT 'none',
    "akubin" BOOLEAN NOT NULL DEFAULT true,
    "interests" "Material"[] DEFAULT ARRAY[]::"Material"[],
    "active_mode" "MarketMode",
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "user_security" (
    "profile_id" UUID NOT NULL,
    "pin_hash" TEXT,
    "failed_pin_attempts" INTEGER NOT NULL DEFAULT 0,
    "pin_locked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_security_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "document" "ConsentDocument" NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(50) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_memberships" (
    "profile_id" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_memberships_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "bins" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "materials" "Material"[],
    "status" "BinStatus" NOT NULL DEFAULT 'offline',
    "capacity_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hours" TEXT NOT NULL,
    "collector" TEXT,
    "next_collection_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_devices" (
    "id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "serial_number" TEXT NOT NULL,
    "credential_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_sessions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "bin_id" UUID,
    "code_hash" TEXT,
    "status" "BinSessionStatus" NOT NULL DEFAULT 'issued',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "device_event_id" TEXT NOT NULL,
    "material" "Material" NOT NULL,
    "measure" "DepositMeasure" NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL,
    "weight_kg" DECIMAL(18,3) NOT NULL,
    "status" "DepositStatus" NOT NULL,
    "rejection_reason" TEXT,
    "awarded_points" INTEGER NOT NULL DEFAULT 0,
    "points_rate" DECIMAL(18,6) NOT NULL,
    "item_kg_equivalent" DECIMAL(18,6),
    "measured_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_wallets" (
    "profile_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "points_wallets_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "points_ledger_entries" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "kind" "PointsEntryKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "deposit_id" UUID,
    "redemption_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "cost_points" INTEGER NOT NULL,
    "value_label" TEXT NOT NULL,
    "value_amount" DECIMAL(20,2),
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "reward_name" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "cost_points" INTEGER NOT NULL,
    "value_amount" DECIMAL(20,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "recipient_phone" TEXT,
    "payout_recipient_reference" TEXT,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'pending_review',
    "reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "idempotency_key" TEXT NOT NULL,
    "provider" TEXT,
    "provider_reference" TEXT,
    "fulfilled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_events" (
    "id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_collections" (
    "id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "collector" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity_after_pct" DECIMAL(5,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "bin_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_maintenance_tickets" (
    "id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "issue" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "opened_by_id" UUID NOT NULL,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "image_id" UUID,
    "read_minutes" INTEGER NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_articles" (
    "profile_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_articles_pkey" PRIMARY KEY ("profile_id","article_id")
);

-- CreateTable
CREATE TABLE "news_candidates" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "NewsStatus" NOT NULL DEFAULT 'proposed',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertising_packages" (
    "id" VARCHAR(40) NOT NULL,
    "name" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "price" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "advertising_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "package_id" VARCHAR(40) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "image_id" UUID NOT NULL,
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "materials" "Material"[] DEFAULT ARRAY[]::"Material"[],
    "roles" "MarketRole"[] DEFAULT ARRAY[]::"MarketRole"[],
    "price" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "duration_days" INTEGER NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_events" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "kind" "CampaignEventKind" NOT NULL,
    "event_key" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "material" "Material" NOT NULL,
    "grade" VARCHAR(100) NOT NULL,
    "condition" "MaterialCondition" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "unit_price" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "min_order" DECIMAL(18,3) NOT NULL,
    "allow_partial" BOOLEAN NOT NULL DEFAULT false,
    "city" VARCHAR(100) NOT NULL,
    "area" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "views" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "listing_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("listing_id","upload_id")
);

-- CreateTable
CREATE TABLE "saved_listings" (
    "profile_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("profile_id","listing_id")
);

-- CreateTable
CREATE TABLE "listing_reports" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'awaiting_seller',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_steps" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "actor_id" UUID,
    "sequence" INTEGER NOT NULL,
    "action" "OfferAction" NOT NULL,
    "unit_price" DECIMAL(20,2) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_requests" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "material" "Material" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "max_unit_price" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "city" VARCHAR(100) NOT NULL,
    "need_by" DATE NOT NULL,
    "status" "BuyerRequestStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "buyer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_request_responses" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "unit_price" DECIMAL(20,2) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "note" TEXT,
    "status" "RequestResponseStatus" NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "buyer_request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "requester_id" UUID,
    "assignee_id" UUID,
    "dispute_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "TicketChannel" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "kind" "EnquiryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "seller_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "partner_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "points_per_item" INTEGER NOT NULL DEFAULT 1,
    "item_kg_equivalent" DECIMAL(18,6) NOT NULL DEFAULT 0.02,
    "airtime_min_points" INTEGER NOT NULL DEFAULT 100,
    "cash_min_points" INTEGER NOT NULL DEFAULT 1000,
    "point_value_naira" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "inspection_hours" INTEGER NOT NULL DEFAULT 24,
    "fare_base" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fare_per_kg" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "fare_step" DECIMAL(20,2) NOT NULL DEFAULT 100,
    "fare_min_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "fare_max_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "quote_deadline_hours" INTEGER NOT NULL DEFAULT 24,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_point_rates" (
    "material" "Material" NOT NULL,
    "points_per_kg" DECIMAL(18,6) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "material_point_rates_pkey" PRIMARY KEY ("material")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "material" "Material" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" "QuantityUnit" NOT NULL,
    "unit_price" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "seller_fee_pct" DECIMAL(5,2) NOT NULL,
    "partner_fee_pct" DECIMAL(5,2) NOT NULL,
    "inspection_hours" INTEGER NOT NULL,
    "pickup_city" TEXT NOT NULL,
    "pickup_area" TEXT NOT NULL,
    "destination" TEXT,
    "recommended_fare" DECIMAL(20,2),
    "proposed_fare" DECIMAL(20,2),
    "quote_deadline" TIMESTAMPTZ(3),
    "inspection_due" TIMESTAMPTZ(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'choose_fulfilment',
    "payment_status" "OrderPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_label" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "OrderStatus",
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_reviews" (
    "order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "opened_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "decision" "DisputeDecision",
    "decision_reason" TEXT,
    "refund_amount" DECIMAL(20,2),
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "upload_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "business" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" VARCHAR(25) NOT NULL,
    "base" TEXT NOT NULL,
    "service_areas" TEXT[],
    "materials" "Material"[],
    "vehicles" TEXT NOT NULL,
    "vehicle_count" INTEGER NOT NULL,
    "capacity_kg" DECIMAL(18,3) NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "partner_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "kind" VARCHAR(80) NOT NULL,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("partner_id","upload_id")
);

-- CreateTable
CREATE TABLE "job_notices" (
    "order_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "declined_at" TIMESTAMPTZ(3),
    "decline_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_notices_pkey" PRIMARY KEY ("order_id","partner_id")
);

-- CreateTable
CREATE TABLE "delivery_quotes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "eta" VARCHAR(100) NOT NULL,
    "vehicle" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'submitted',
    "kind" "QuoteKind" NOT NULL DEFAULT 'counter',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "delivery_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "order_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "agreed_fare" DECIMAL(20,2) NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "delivery_proofs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "campaign_id" UUID,
    "provider" VARCHAR(50) NOT NULL,
    "provider_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "checkout_url" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "dispute_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "provider_reference" TEXT,
    "amount" DECIMAL(20,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "seller_gross" DECIMAL(20,2) NOT NULL,
    "partner_gross" DECIMAL(20,2) NOT NULL,
    "seller_fee" DECIMAL(20,2) NOT NULL,
    "partner_fee" DECIMAL(20,2) NOT NULL,
    "seller_payout" DECIMAL(20,2) NOT NULL,
    "partner_payout" DECIMAL(20,2) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_transfers" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "beneficiary" "SettlementBeneficiary" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "recipient_reference" TEXT NOT NULL,
    "provider_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settlement_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_holds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "placed_by_id" UUID NOT NULL,
    "released_by_id" UUID,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_events" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "resource_type" "RecommendationResource" NOT NULL,
    "resource_id" UUID NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "algorithm_version" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "guest_session_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "content" TEXT NOT NULL,
    "resultReferences" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_submissions" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "level" "VerificationLevel" NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending_review',
    "data" JSONB NOT NULL DEFAULT '{}',
    "provider" TEXT,
    "provider_reference" TEXT,
    "reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "submission_id" UUID NOT NULL,
    "upload_id" UUID NOT NULL,
    "kind" VARCHAR(80) NOT NULL,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("submission_id","upload_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_profile_id_document_version_key" ON "consent_records"("profile_id", "document", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bins_code_key" ON "bins"("code");

-- CreateIndex
CREATE INDEX "bins_city_status_idx" ON "bins"("city", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bin_devices_serial_number_key" ON "bin_devices"("serial_number");

-- CreateIndex
CREATE INDEX "bin_devices_bin_id_idx" ON "bin_devices"("bin_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_sessions_code_hash_key" ON "bin_sessions"("code_hash");

-- CreateIndex
CREATE INDEX "bin_sessions_profile_id_created_at_idx" ON "bin_sessions"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "bin_sessions_bin_id_status_idx" ON "bin_sessions"("bin_id", "status");

-- CreateIndex
CREATE INDEX "bin_sessions_status_expires_at_idx" ON "bin_sessions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "deposits_session_id_created_at_idx" ON "deposits"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "deposits_bin_id_measured_at_idx" ON "deposits"("bin_id", "measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_device_id_device_event_id_key" ON "deposits"("device_id", "device_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_deposit_id_key" ON "points_ledger_entries"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_idempotency_key_key" ON "points_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "points_ledger_entries_profile_id_created_at_idx" ON "points_ledger_entries"("profile_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledger_entries_redemption_id_kind_key" ON "points_ledger_entries"("redemption_id", "kind");

-- CreateIndex
CREATE INDEX "rewards_active_kind_idx" ON "rewards"("active", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_idempotency_key_key" ON "redemptions"("idempotency_key");

-- CreateIndex
CREATE INDEX "redemptions_profile_id_created_at_idx" ON "redemptions"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "redemptions_status_created_at_idx" ON "redemptions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_provider_provider_reference_key" ON "redemptions"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "bin_events_bin_id_created_at_idx" ON "bin_events"("bin_id", "created_at");

-- CreateIndex
CREATE INDEX "bin_collections_bin_id_collected_at_idx" ON "bin_collections"("bin_id", "collected_at");

-- CreateIndex
CREATE INDEX "bin_maintenance_tickets_bin_id_status_idx" ON "bin_maintenance_tickets"("bin_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_category_published_at_idx" ON "articles"("status", "category", "published_at");

-- CreateIndex
CREATE INDEX "articles_author_id_idx" ON "articles"("author_id");

-- CreateIndex
CREATE INDEX "articles_image_id_idx" ON "articles"("image_id");

-- CreateIndex
CREATE INDEX "saved_articles_article_id_idx" ON "saved_articles"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_candidates_url_key" ON "news_candidates"("url");

-- CreateIndex
CREATE INDEX "news_candidates_status_created_at_idx" ON "news_candidates"("status", "created_at");

-- CreateIndex
CREATE INDEX "campaigns_owner_id_created_at_idx" ON "campaigns"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "campaigns_status_starts_at_ends_at_idx" ON "campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "campaigns_package_id_idx" ON "campaigns"("package_id");

-- CreateIndex
CREATE INDEX "campaigns_image_id_idx" ON "campaigns"("image_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_events_event_key_key" ON "campaign_events"("event_key");

-- CreateIndex
CREATE INDEX "campaign_events_campaign_id_kind_created_at_idx" ON "campaign_events"("campaign_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "listings_status_material_city_created_at_idx" ON "listings"("status", "material", "city", "created_at");

-- CreateIndex
CREATE INDEX "listings_seller_id_status_idx" ON "listings"("seller_id", "status");

-- CreateIndex
CREATE INDEX "listing_images_upload_id_idx" ON "listing_images"("upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_listing_id_position_key" ON "listing_images"("listing_id", "position");

-- CreateIndex
CREATE INDEX "saved_listings_listing_id_idx" ON "saved_listings"("listing_id");

-- CreateIndex
CREATE INDEX "listing_reports_listing_id_resolved_at_idx" ON "listing_reports"("listing_id", "resolved_at");

-- CreateIndex
CREATE INDEX "listing_reports_reporter_id_idx" ON "listing_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "offers_buyer_id_status_idx" ON "offers"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "offers_listing_id_status_idx" ON "offers"("listing_id", "status");

-- CreateIndex
CREATE INDEX "offers_status_expires_at_idx" ON "offers"("status", "expires_at");

-- CreateIndex
CREATE INDEX "offer_steps_actor_id_idx" ON "offer_steps"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_steps_offer_id_sequence_key" ON "offer_steps"("offer_id", "sequence");

-- CreateIndex
CREATE INDEX "buyer_requests_status_material_city_created_at_idx" ON "buyer_requests"("status", "material", "city", "created_at");

-- CreateIndex
CREATE INDEX "buyer_requests_buyer_id_idx" ON "buyer_requests"("buyer_id");

-- CreateIndex
CREATE INDEX "buyer_request_responses_seller_id_idx" ON "buyer_request_responses"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_request_responses_request_id_seller_id_key" ON "buyer_request_responses"("request_id", "seller_id");

-- CreateIndex
CREATE INDEX "support_tickets_requester_id_created_at_idx" ON "support_tickets"("requester_id", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_assignee_id_status_idx" ON "support_tickets"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_dispute_id_idx" ON "support_tickets"("dispute_id");

-- CreateIndex
CREATE INDEX "enquiries_kind_created_at_idx" ON "enquiries"("kind", "created_at");

-- CreateIndex
CREATE INDEX "notifications_profile_id_read_at_created_at_idx" ON "notifications"("profile_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_offer_id_key" ON "orders"("offer_id");

-- CreateIndex
CREATE INDEX "orders_buyer_id_created_at_idx" ON "orders"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_seller_id_created_at_idx" ON "orders"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_listing_id_idx" ON "orders"("listing_id");

-- CreateIndex
CREATE INDEX "orders_status_quote_deadline_idx" ON "orders"("status", "quote_deadline");

-- CreateIndex
CREATE INDEX "orders_status_inspection_due_idx" ON "orders"("status", "inspection_due");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_reviews_buyer_id_idx" ON "order_reviews"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- CreateIndex
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "disputes_opened_by_id_idx" ON "disputes"("opened_by_id");

-- CreateIndex
CREATE INDEX "disputes_resolved_by_id_idx" ON "disputes"("resolved_by_id");

-- CreateIndex
CREATE INDEX "dispute_evidence_dispute_id_idx" ON "dispute_evidence"("dispute_id");

-- CreateIndex
CREATE INDEX "dispute_evidence_upload_id_idx" ON "dispute_evidence"("upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_owner_id_key" ON "partners"("owner_id");

-- CreateIndex
CREATE INDEX "partners_status_applied_at_idx" ON "partners"("status", "applied_at");

-- CreateIndex
CREATE INDEX "partner_documents_upload_id_idx" ON "partner_documents"("upload_id");

-- CreateIndex
CREATE INDEX "job_notices_partner_id_declined_at_idx" ON "job_notices"("partner_id", "declined_at");

-- CreateIndex
CREATE INDEX "delivery_quotes_partner_id_status_idx" ON "delivery_quotes"("partner_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_quotes_order_id_partner_id_key" ON "delivery_quotes"("order_id", "partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_quotes_id_order_id_partner_id_key" ON "delivery_quotes"("id", "order_id", "partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_assignments_quote_id_key" ON "delivery_assignments"("quote_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_partner_id_idx" ON "delivery_assignments"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_assignments_quote_id_order_id_partner_id_key" ON "delivery_assignments"("quote_id", "order_id", "partner_id");

-- CreateIndex
CREATE INDEX "delivery_proofs_upload_id_idx" ON "delivery_proofs"("upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_proofs_order_id_upload_id_key" ON "delivery_proofs"("order_id", "upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "payments_campaign_id_status_idx" ON "payments"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_reference_key" ON "payments"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_payment_id_status_idx" ON "refunds"("payment_id", "status");

-- CreateIndex
CREATE INDEX "refunds_dispute_id_idx" ON "refunds"("dispute_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_order_id_key" ON "settlements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_transfers_idempotency_key_key" ON "settlement_transfers"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_transfers_settlement_id_beneficiary_key" ON "settlement_transfers"("settlement_id", "beneficiary");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_transfers_provider_provider_reference_key" ON "settlement_transfers"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "settlement_holds_order_id_released_at_idx" ON "settlement_holds"("order_id", "released_at");

-- CreateIndex
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_id_key" ON "webhook_events"("provider", "external_id");

-- CreateIndex
CREATE INDEX "recommendation_events_profile_id_created_at_idx" ON "recommendation_events"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "recommendation_events_resource_type_resource_id_action_idx" ON "recommendation_events"("resource_type", "resource_id", "action");

-- CreateIndex
CREATE INDEX "assistant_conversations_profile_id_updated_at_idx" ON "assistant_conversations"("profile_id", "updated_at");

-- CreateIndex
CREATE INDEX "assistant_conversations_guest_session_hash_idx" ON "assistant_conversations"("guest_session_hash");

-- CreateIndex
CREATE INDEX "assistant_messages_conversation_id_created_at_idx" ON "assistant_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storage_key_key" ON "uploads"("storage_key");

-- CreateIndex
CREATE INDEX "uploads_owner_id_created_at_idx" ON "uploads"("owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_submissions_provider_reference_key" ON "verification_submissions"("provider_reference");

-- CreateIndex
CREATE INDEX "verification_submissions_profile_id_level_created_at_idx" ON "verification_submissions"("profile_id", "level", "created_at");

-- CreateIndex
CREATE INDEX "verification_submissions_status_created_at_idx" ON "verification_submissions"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_documents_upload_id_idx" ON "verification_documents"("upload_id");

-- CreateIndex
CREATE INDEX "profiles_city_idx" ON "profiles"("city");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_memberships" ADD CONSTRAINT "staff_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_devices" ADD CONSTRAINT "bin_devices_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_sessions" ADD CONSTRAINT "bin_sessions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_sessions" ADD CONSTRAINT "bin_sessions_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "bin_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "bin_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_wallets" ADD CONSTRAINT "points_wallets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "points_wallets"("profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "deposits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "redemptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_events" ADD CONSTRAINT "bin_events_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_collections" ADD CONSTRAINT "bin_collections_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_maintenance_tickets" ADD CONSTRAINT "bin_maintenance_tickets_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_articles" ADD CONSTRAINT "saved_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "advertising_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_steps" ADD CONSTRAINT "offer_steps_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_steps" ADD CONSTRAINT "offer_steps_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_requests" ADD CONSTRAINT "buyer_requests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_request_responses" ADD CONSTRAINT "buyer_request_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "buyer_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_request_responses" ADD CONSTRAINT "buyer_request_responses_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notices" ADD CONSTRAINT "job_notices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_notices" ADD CONSTRAINT "job_notices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_quotes" ADD CONSTRAINT "delivery_quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_quotes" ADD CONSTRAINT "delivery_quotes_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_quote_id_order_id_partner_id_fkey" FOREIGN KEY ("quote_id", "order_id", "partner_id") REFERENCES "delivery_quotes"("id", "order_id", "partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_holds" ADD CONSTRAINT "settlement_holds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_events" ADD CONSTRAINT "recommendation_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "verification_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL invariants not expressible in Prisma's schema language.
-- Do not regenerate this migration without preserving these constraints, indexes and triggers.
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_active_mode_check CHECK (
  active_mode IS NULL OR market_role = 'both' OR market_role::text = active_mode::text
);
ALTER TABLE public.user_security ADD CONSTRAINT user_security_attempts_check CHECK (failed_pin_attempts >= 0);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_size_check CHECK (size_bytes > 0);
ALTER TABLE public.uploads ADD CONSTRAINT uploads_private_documents_check CHECK (
  NOT is_public OR purpose IN ('listing_image', 'campaign_creative', 'article_image')
);
ALTER TABLE public.listings ADD CONSTRAINT listings_amounts_check CHECK (
  quantity > 0 AND min_order > 0 AND min_order <= quantity AND unit_price >= 0 AND views >= 0
);
ALTER TABLE public.listing_images ADD CONSTRAINT listing_images_position_check CHECK (position >= 0);
ALTER TABLE public.offer_steps ADD CONSTRAINT offer_steps_amounts_check CHECK (quantity > 0 AND unit_price >= 0 AND sequence > 0);
ALTER TABLE public.buyer_requests ADD CONSTRAINT buyer_requests_amounts_check CHECK (quantity > 0 AND max_unit_price >= 0);
ALTER TABLE public.buyer_request_responses ADD CONSTRAINT buyer_request_responses_amounts_check CHECK (quantity > 0 AND unit_price >= 0);
ALTER TABLE public.orders ADD CONSTRAINT orders_participants_check CHECK (buyer_id <> seller_id);
ALTER TABLE public.orders ADD CONSTRAINT orders_amounts_check CHECK (
  quantity > 0 AND unit_price >= 0 AND seller_fee_pct BETWEEN 0 AND 100 AND partner_fee_pct BETWEEN 0 AND 100
  AND inspection_hours > 0 AND (recommended_fare IS NULL OR recommended_fare >= 0)
  AND (proposed_fare IS NULL OR proposed_fare >= 0)
);
ALTER TABLE public.order_reviews ADD CONSTRAINT order_reviews_stars_check CHECK (stars BETWEEN 1 AND 5);
ALTER TABLE public.disputes ADD CONSTRAINT disputes_refund_check CHECK (refund_amount IS NULL OR refund_amount > 0);
ALTER TABLE public.dispute_evidence ADD CONSTRAINT dispute_evidence_content_check CHECK (upload_id IS NOT NULL OR nullif(btrim(description), '') IS NOT NULL);
ALTER TABLE public.partners ADD CONSTRAINT partners_capacity_check CHECK (vehicle_count > 0 AND capacity_kg > 0 AND cardinality(service_areas) > 0 AND cardinality(materials) > 0);
ALTER TABLE public.delivery_quotes ADD CONSTRAINT delivery_quotes_amount_check CHECK (amount >= 0);
ALTER TABLE public.delivery_assignments ADD CONSTRAINT delivery_assignments_fare_check CHECK (agreed_fare >= 0);
CREATE UNIQUE INDEX delivery_quotes_one_selected_per_order ON public.delivery_quotes (order_id) WHERE status = 'selected';
ALTER TABLE public.payments ADD CONSTRAINT payments_target_check CHECK (num_nonnulls(order_id, campaign_id) = 1);
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount > 0);
ALTER TABLE public.refunds ADD CONSTRAINT refunds_amount_check CHECK (amount > 0);
CREATE UNIQUE INDEX refunds_provider_reference_unique ON public.refunds (payment_id, provider_reference) WHERE provider_reference IS NOT NULL;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_amounts_check CHECK (
  seller_gross >= 0 AND partner_gross >= 0 AND seller_fee >= 0 AND partner_fee >= 0
  AND seller_payout >= 0 AND partner_payout >= 0
  AND seller_gross = seller_fee + seller_payout AND partner_gross = partner_fee + partner_payout
);
ALTER TABLE public.settlement_transfers ADD CONSTRAINT settlement_transfers_amount_check CHECK (amount > 0);
ALTER TABLE public.bins ADD CONSTRAINT bins_measurements_check CHECK (
  capacity_pct BETWEEN 0 AND 100 AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
);
ALTER TABLE public.bin_collections ADD CONSTRAINT bin_collections_capacity_check CHECK (capacity_after_pct BETWEEN 0 AND 100);
ALTER TABLE public.bin_sessions ADD CONSTRAINT bin_sessions_state_check CHECK (
  (status <> 'issued' OR (code_hash IS NOT NULL AND started_at IS NULL AND ended_at IS NULL))
  AND (status <> 'active' OR (bin_id IS NOT NULL AND started_at IS NOT NULL AND ended_at IS NULL))
  AND expires_at > created_at
);
CREATE UNIQUE INDEX bin_sessions_one_issued_per_profile ON public.bin_sessions (profile_id) WHERE status = 'issued';
CREATE UNIQUE INDEX bin_sessions_one_active_per_bin ON public.bin_sessions (bin_id) WHERE status = 'active';
CREATE UNIQUE INDEX bin_sessions_one_active_per_profile ON public.bin_sessions (profile_id) WHERE status = 'active';
ALTER TABLE public.deposits ADD CONSTRAINT deposits_measurements_check CHECK (
  amount > 0 AND weight_kg >= 0 AND awarded_points >= 0 AND points_rate >= 0
  AND (measure <> 'count' OR amount = trunc(amount))
  AND (status <> 'rejected' OR awarded_points = 0)
  AND (item_kg_equivalent IS NULL OR item_kg_equivalent > 0)
);
ALTER TABLE public.points_wallets ADD CONSTRAINT points_wallets_balance_check CHECK (balance >= 0);
ALTER TABLE public.points_ledger_entries ADD CONSTRAINT points_ledger_source_check CHECK (
  (kind = 'deposit_credit' AND amount > 0 AND deposit_id IS NOT NULL AND redemption_id IS NULL)
  OR (kind = 'redemption_debit' AND amount < 0 AND redemption_id IS NOT NULL AND deposit_id IS NULL)
  OR (kind = 'redemption_refund' AND amount > 0 AND redemption_id IS NOT NULL AND deposit_id IS NULL)
  OR (kind = 'adjustment' AND amount <> 0 AND deposit_id IS NULL AND redemption_id IS NULL AND reason IS NOT NULL)
);
ALTER TABLE public.rewards ADD CONSTRAINT rewards_amounts_check CHECK (cost_points > 0 AND (stock IS NULL OR stock >= 0) AND (value_amount IS NULL OR value_amount > 0));
ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_amounts_check CHECK (cost_points > 0 AND (value_amount IS NULL OR value_amount > 0));
ALTER TABLE public.articles ADD CONSTRAINT articles_read_minutes_check CHECK (read_minutes > 0);
ALTER TABLE public.advertising_packages ADD CONSTRAINT advertising_packages_amounts_check CHECK (duration_days > 0 AND price > 0);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_amounts_check CHECK (duration_days > 0 AND price > 0 AND (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at));
ALTER TABLE public.assistant_conversations ADD CONSTRAINT assistant_conversations_owner_check CHECK (num_nonnulls(profile_id, guest_session_hash) = 1);
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_values_check CHECK (
  id = 1 AND seller_fee_pct BETWEEN 0 AND 100 AND partner_fee_pct BETWEEN 0 AND 100
  AND points_per_item >= 0 AND item_kg_equivalent > 0 AND airtime_min_points >= 0
  AND cash_min_points >= 0 AND point_value_naira > 0 AND inspection_hours > 0
  AND fare_base >= 0 AND fare_per_kg >= 0 AND fare_step > 0
  AND fare_min_pct BETWEEN 0 AND 100 AND fare_max_pct >= 0 AND quote_deadline_hours > 0
);
ALTER TABLE public.material_point_rates ADD CONSTRAINT material_point_rates_rate_check CHECK (points_per_kg >= 0);

-- Existing and future Supabase signups receive their account companion rows.
INSERT INTO public.user_preferences (profile_id, updated_at) SELECT id, now() FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.user_security (profile_id, updated_at) SELECT id, now() FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.points_wallets (profile_id, updated_at) SELECT id, now() FROM public.profiles ON CONFLICT DO NOTHING;
INSERT INTO public.consent_records (id, profile_id, document, version, accepted_at, source)
SELECT gen_random_uuid(), id, 'terms', terms_version, terms_accepted_at, 'legacy_profile'
FROM public.profiles WHERE terms_accepted_at IS NOT NULL AND terms_version IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.initialize_profile_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.user_preferences (profile_id, updated_at) VALUES (NEW.id, now());
  INSERT INTO public.user_security (profile_id, updated_at) VALUES (NEW.id, now());
  INSERT INTO public.points_wallets (profile_id, updated_at) VALUES (NEW.id, now());
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_initialize_account AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_profile_account();

-- Preserve terms history while the current auth service still writes compatibility columns.
CREATE FUNCTION public.record_profile_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.terms_accepted_at IS NOT NULL AND NEW.terms_version IS NOT NULL THEN
    INSERT INTO public.consent_records (id, profile_id, document, version, accepted_at, source)
    VALUES (gen_random_uuid(), NEW.id, 'terms', NEW.terms_version, NEW.terms_accepted_at, 'auth_profile')
    ON CONFLICT (profile_id, document, version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_record_terms AFTER INSERT OR UPDATE OF terms_accepted_at, terms_version ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.record_profile_terms();

-- Browser Supabase clients must not bypass NestJS authorization through the public Data API.
-- Prisma uses the trusted backend database role; no anon/authenticated policies are added here.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_preferences','user_security','consent_records','staff_memberships','uploads',
    'verification_submissions','verification_documents','listings','listing_images','saved_listings',
    'listing_reports','offers','offer_steps','buyer_requests','buyer_request_responses','orders',
    'order_events','order_reviews','disputes','dispute_evidence','partners','partner_documents',
    'job_notices','delivery_quotes','delivery_assignments','delivery_proofs','payments','refunds',
    'settlements','settlement_transfers','settlement_holds','webhook_events','bins','bin_devices',
    'bin_sessions','deposits','points_wallets','points_ledger_entries','rewards','redemptions',
    'bin_events','bin_collections','bin_maintenance_tickets','articles','saved_articles','news_candidates',
    'advertising_packages','campaigns','campaign_events','support_tickets','enquiries','notifications',
    'audit_logs','platform_settings','material_point_rates','recommendation_events',
    'assistant_conversations','assistant_messages'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END;
$$;
