CREATE TABLE "gift_fee_slabs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slab_min_coin" integer NOT NULL,
	"slab_max_coin" integer,
	"platform_fee_bps" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_gift_fee_slabs_bps" CHECK ("gift_fee_slabs"."platform_fee_bps" >= 0 AND "gift_fee_slabs"."platform_fee_bps" <= 5000),
	CONSTRAINT "chk_gift_fee_slabs_range" CHECK ("gift_fee_slabs"."slab_min_coin" >= 1 AND ("gift_fee_slabs"."slab_max_coin" IS NULL OR "gift_fee_slabs"."slab_max_coin" >= "gift_fee_slabs"."slab_min_coin"))
);
--> statement-breakpoint
CREATE TABLE "gift_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "hosting_owner_wallet" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"balance_coins" bigint DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "chk_hosting_owner_wallet_singleton" CHECK ("hosting_owner_wallet"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "hosting_owner_wallet_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"amount" bigint NOT NULL,
	"before_balance" bigint NOT NULL,
	"after_balance" bigint NOT NULL,
	"reference_table" varchar(128) DEFAULT '',
	"reference_id" bigint DEFAULT 0,
	"note" text DEFAULT '',
	"created_at" bigint NOT NULL,
	CONSTRAINT "chk_hosting_owner_wallet_ledger_amount" CHECK ("hosting_owner_wallet_ledger"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "site_funding_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"amount_coins" bigint NOT NULL,
	"external_ref" varchar(255) NOT NULL,
	"note" text DEFAULT '',
	"funded_by" varchar(255) DEFAULT 'hosting_owner' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "chk_site_funding_positive" CHECK ("site_funding_log"."amount_coins" > 0)
);
--> statement-breakpoint
CREATE TABLE "feed_bookmarks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_comment_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_id" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_id" varchar(64) NOT NULL,
	"post_id" varchar(64) NOT NULL,
	"parent_comment_id" varchar(64) DEFAULT '',
	"reply_to_uid" varchar(255) DEFAULT '',
	"reply_to_username" varchar(255) DEFAULT '',
	"author_uid" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"replies_count" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_post_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_post_media" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" varchar(64) NOT NULL,
	"media_type" varchar(32) DEFAULT 'image' NOT NULL,
	"url" varchar(1024) NOT NULL,
	"thumbnail_url" varchar(1024) DEFAULT '',
	"width" integer DEFAULT 0,
	"height" integer DEFAULT 0,
	"duration" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_posts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"post_id" varchar(64) NOT NULL,
	"author_uid" varchar(255) NOT NULL,
	"author_idreg" integer DEFAULT 0,
	"caption" text DEFAULT '',
	"media_type" varchar(32) DEFAULT 'image' NOT NULL,
	"music_title" varchar(255) DEFAULT '',
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"reposts_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"visibility" varchar(32) DEFAULT 'public' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_coin_ledger_txid";--> statement-breakpoint
ALTER TABLE "gift_settings" ADD CONSTRAINT "gift_settings_updated_by_users_idreg_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("idreg") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_gift_fee_slabs_min" ON "gift_fee_slabs" USING btree ("slab_min_coin");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_hosting_owner_wallet_ledger_txid" ON "hosting_owner_wallet_ledger" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_hosting_owner_wallet_ledger_created_at" ON "hosting_owner_wallet_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_site_funding_idempotency" ON "site_funding_log" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_site_funding_created_at" ON "site_funding_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feed_bookmarks" ON "feed_bookmarks" USING btree ("post_id","user_uid");--> statement-breakpoint
CREATE INDEX "idx_feed_bookmarks_user" ON "feed_bookmarks" USING btree ("user_uid","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feed_comment_likes" ON "feed_comment_likes" USING btree ("comment_id","user_uid");--> statement-breakpoint
CREATE INDEX "idx_feed_comment_likes_user" ON "feed_comment_likes" USING btree ("user_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feed_comments_id" ON "feed_comments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_feed_comments_post_created" ON "feed_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_feed_comments_parent" ON "feed_comments" USING btree ("parent_comment_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_feed_comments_author" ON "feed_comments" USING btree ("author_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feed_post_likes" ON "feed_post_likes" USING btree ("post_id","user_uid");--> statement-breakpoint
CREATE INDEX "idx_feed_post_likes_user" ON "feed_post_likes" USING btree ("user_uid");--> statement-breakpoint
CREATE INDEX "idx_feed_media_post_sort" ON "feed_post_media" USING btree ("post_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feed_posts_post_id" ON "feed_posts" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_feed_posts_created_at" ON "feed_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_feed_posts_author" ON "feed_posts" USING btree ("author_uid","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_coin_ledger_txid_event_user" ON "coin_ledger" USING btree ("txid","event_type","user_idreg") WHERE "coin_ledger"."txid" <> '';