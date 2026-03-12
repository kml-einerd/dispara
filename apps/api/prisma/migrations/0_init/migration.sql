-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('SHOPEE', 'AMAZON', 'MERCADOLIVRE', 'MAGALU', 'ALIEXPRESS');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WaSessionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'BANNED', 'WARMING_UP');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'TELEGRAM', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchItemStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TelegramDispatchStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "logo_url" TEXT,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "external_auth_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "credentials" JSONB NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "status" "WaSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "warmup_day" INTEGER NOT NULL DEFAULT 0,
    "daily_msg_count" INTEGER NOT NULL DEFAULT 0,
    "daily_msg_reset" TIMESTAMP(3),
    "first_conn_at" TIMESTAMP(3),
    "last_conn_at" TIMESTAMP(3),
    "auth_state" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_auth_keys" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "key_type" VARCHAR(50) NOT NULL,
    "key_id" VARCHAR(255) NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wa_auth_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "external_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "max_members" INTEGER NOT NULL DEFAULT 1024,
    "invite_link" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "product_url" TEXT NOT NULL,
    "affiliate_url" TEXT NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "original_price" DECIMAL(10,2) NOT NULL,
    "promo_price" DECIMAL(10,2) NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "image_url" TEXT,
    "category" VARCHAR(255),
    "status" "PromoStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_variations" (
    "id" UUID NOT NULL,
    "promo_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "copy_text" TEXT NOT NULL,
    "image_url" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "promo_id" UUID,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "copy_template" TEXT NOT NULL,
    "media_url" TEXT,
    "media_type" VARCHAR(50),
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_groups" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_items" (
    "id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "session_id" UUID,
    "copy_rendered" TEXT,
    "status" "DispatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "latency_ms" INTEGER,
    "job_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_feeds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_feed_items" (
    "id" UUID NOT NULL,
    "feed_id" UUID NOT NULL,
    "promo_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "pinned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_feed_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_spots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "short_code" VARCHAR(20) NOT NULL,
    "target_url" TEXT NOT NULL,
    "affiliate_url" TEXT NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_clicks" (
    "id" UUID NOT NULL,
    "link_spot_id" UUID NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "referer" TEXT,
    "country" VARCHAR(2),
    "city" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_type" VARCHAR(50) NOT NULL,
    "system_prompt" TEXT,
    "model" VARCHAR(100) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 1024,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_interactions" (
    "id" UUID NOT NULL,
    "agent_config_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "input_payload" JSONB NOT NULL,
    "output_payload" JSONB,
    "token_count" INTEGER,
    "latency_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_definition_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "external_id" VARCHAR(255),
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_definitions" (
    "id" UUID NOT NULL,
    "plan" "Plan" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2),
    "max_wa_sessions" INTEGER NOT NULL,
    "max_groups" INTEGER NOT NULL,
    "max_promos" INTEGER NOT NULL,
    "max_dispatches" INTEGER NOT NULL,
    "ai_credits_month" INTEGER NOT NULL,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric_type" VARCHAR(100) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bot_token" TEXT NOT NULL,
    "bot_username" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "chat_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'channel',
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "agent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_dispatch" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" VARCHAR(255) NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "original_price" DOUBLE PRECISION,
    "affiliate_url" TEXT NOT NULL,
    "image_url" TEXT,
    "marketplace" VARCHAR(50) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_dispatch_items" (
    "id" UUID NOT NULL,
    "dispatch_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "chat_id" VARCHAR(255) NOT NULL,
    "bot_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "media_url" TEXT,
    "media_type" VARCHAR(50),
    "status" "TelegramDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "job_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_auth_id_key" ON "users"("external_auth_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_external_auth_id_idx" ON "users"("external_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "affiliate_accounts_tenant_id_marketplace_idx" ON "affiliate_accounts"("tenant_id", "marketplace");

-- CreateIndex
CREATE INDEX "affiliate_accounts_tenant_id_status_idx" ON "affiliate_accounts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_accounts_tenant_id_marketplace_label_key" ON "affiliate_accounts"("tenant_id", "marketplace", "label");

-- CreateIndex
CREATE INDEX "wa_sessions_tenant_id_status_idx" ON "wa_sessions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wa_sessions_tenant_id_phone_number_key" ON "wa_sessions"("tenant_id", "phone_number");

-- CreateIndex
CREATE INDEX "wa_auth_keys_session_id_key_type_idx" ON "wa_auth_keys"("session_id", "key_type");

-- CreateIndex
CREATE UNIQUE INDEX "wa_auth_keys_session_id_key_type_key_id_key" ON "wa_auth_keys"("session_id", "key_type", "key_id");

-- CreateIndex
CREATE INDEX "groups_tenant_id_channel_is_active_idx" ON "groups"("tenant_id", "channel", "is_active");

-- CreateIndex
CREATE INDEX "groups_session_id_idx" ON "groups"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_tenant_id_external_id_key" ON "groups"("tenant_id", "external_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_external_id_key" ON "group_members"("group_id", "external_id");

-- CreateIndex
CREATE INDEX "promos_tenant_id_status_idx" ON "promos"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "promos_tenant_id_marketplace_idx" ON "promos"("tenant_id", "marketplace");

-- CreateIndex
CREATE INDEX "promos_tenant_id_created_at_idx" ON "promos"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "promo_variations_promo_id_idx" ON "promo_variations"("promo_id");

-- CreateIndex
CREATE INDEX "dispatches_tenant_id_status_idx" ON "dispatches"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "dispatches_tenant_id_created_at_idx" ON "dispatches"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "dispatches_scheduled_at_idx" ON "dispatches"("scheduled_at");

-- CreateIndex
CREATE INDEX "dispatch_items_dispatch_id_status_idx" ON "dispatch_items"("dispatch_id", "status");

-- CreateIndex
CREATE INDEX "dispatch_items_group_id_idx" ON "dispatch_items"("group_id");

-- CreateIndex
CREATE INDEX "promo_feeds_tenant_id_is_active_idx" ON "promo_feeds"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "promo_feeds_tenant_id_slug_key" ON "promo_feeds"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "promo_feed_items_feed_id_position_idx" ON "promo_feed_items"("feed_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "promo_feed_items_feed_id_promo_id_key" ON "promo_feed_items"("feed_id", "promo_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_spots_short_code_key" ON "link_spots"("short_code");

-- CreateIndex
CREATE INDEX "link_spots_short_code_idx" ON "link_spots"("short_code");

-- CreateIndex
CREATE INDEX "link_spots_tenant_id_is_active_idx" ON "link_spots"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "link_clicks_link_spot_id_created_at_idx" ON "link_clicks"("link_spot_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_tenant_id_event_type_created_at_idx" ON "analytics_events"("tenant_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_entity_id_idx" ON "analytics_events"("entity_id");

-- CreateIndex
CREATE INDEX "agent_configs_tenant_id_is_active_idx" ON "agent_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_tenant_id_agent_type_key" ON "agent_configs"("tenant_id", "agent_type");

-- CreateIndex
CREATE INDEX "agent_interactions_agent_config_id_created_at_idx" ON "agent_interactions"("agent_config_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_interactions_user_id_created_at_idx" ON "agent_interactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_external_id_key" ON "subscriptions"("external_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_definitions_plan_key" ON "plan_definitions"("plan");

-- CreateIndex
CREATE INDEX "usage_metrics_tenant_id_metric_type_period_start_idx" ON "usage_metrics"("tenant_id", "metric_type", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metrics_tenant_id_metric_type_period_start_key" ON "usage_metrics"("tenant_id", "metric_type", "period_start");

-- CreateIndex
CREATE INDEX "telegram_bots_tenant_id_is_active_idx" ON "telegram_bots"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bots_tenant_id_bot_username_key" ON "telegram_bots"("tenant_id", "bot_username");

-- CreateIndex
CREATE INDEX "telegram_channels_tenant_id_is_active_idx" ON "telegram_channels"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "telegram_channels_bot_id_idx" ON "telegram_channels"("bot_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_channels_tenant_id_chat_id_key" ON "telegram_channels"("tenant_id", "chat_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_is_active_idx" ON "products"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_idx" ON "products"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "products_tenant_id_marketplace_idx" ON "products"("tenant_id", "marketplace");

-- CreateIndex
CREATE INDEX "telegram_dispatch_items_dispatch_id_status_idx" ON "telegram_dispatch_items"("dispatch_id", "status");

-- CreateIndex
CREATE INDEX "telegram_dispatch_items_channel_id_idx" ON "telegram_dispatch_items"("channel_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_sessions" ADD CONSTRAINT "wa_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_auth_keys" ADD CONSTRAINT "wa_auth_keys_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "wa_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "wa_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_variations" ADD CONSTRAINT "promo_variations_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_items" ADD CONSTRAINT "dispatch_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "wa_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_feeds" ADD CONSTRAINT "promo_feeds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_feed_items" ADD CONSTRAINT "promo_feed_items_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "promo_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_feed_items" ADD CONSTRAINT "promo_feed_items_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_spots" ADD CONSTRAINT "link_spots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_link_spot_id_fkey" FOREIGN KEY ("link_spot_id") REFERENCES "link_spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interactions" ADD CONSTRAINT "agent_interactions_agent_config_id_fkey" FOREIGN KEY ("agent_config_id") REFERENCES "agent_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_interactions" ADD CONSTRAINT "agent_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_definition_id_fkey" FOREIGN KEY ("plan_definition_id") REFERENCES "plan_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_channels" ADD CONSTRAINT "telegram_channels_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "telegram_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
