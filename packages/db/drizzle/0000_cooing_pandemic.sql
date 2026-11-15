CREATE TABLE "followers" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" varchar(255) NOT NULL,
	"following_id" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "names" (
	"id" serial PRIMARY KEY NOT NULL,
	"iduser" varchar(255),
	"fp" varchar(255),
	"ip" varchar(255),
	"topic" varchar(255),
	"username" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "profile_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" varchar(255),
	"visitor_id" varchar(255),
	"visitor_name" varchar(255),
	"visitor_pic" varchar(255),
	"seen" integer DEFAULT 0,
	"time" bigint,
	"visitor_type" varchar(20) DEFAULT 'عضو'
);
--> statement-breakpoint
CREATE TABLE "sub" (
	"id" serial PRIMARY KEY NOT NULL,
	"iduser" varchar(255),
	"sub" varchar(255),
	"topic" varchar(255),
	"topic1" varchar(255),
	"timestart" varchar(255),
	"timefinish" varchar(255),
	"timeis" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"idreg" serial PRIMARY KEY NOT NULL,
	"bg" varchar(255) DEFAULT '#FFFFFF',
	"mcol" varchar(255) DEFAULT '#000000',
	"ucol" varchar(255) DEFAULT '#000000',
	"evaluation" integer DEFAULT 0,
	"ico" varchar(255) DEFAULT '',
	"ip" varchar(255) DEFAULT '',
	"fp" varchar(255) DEFAULT '',
	"id" varchar(255),
	"lid" varchar(255),
	"uid" varchar(255),
	"msg" varchar(255) DEFAULT '(عضو جديد)',
	"pic" varchar(255) DEFAULT 'pic.png',
	"pich" varchar(255) DEFAULT 'pich.png',
	"power" varchar(255) DEFAULT '',
	"rep" bigint DEFAULT 0,
	"topic" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"youtub" varchar(255) DEFAULT '',
	"them" varchar(255) DEFAULT '',
	"cover" varchar(255) DEFAULT '',
	"loginG" boolean DEFAULT false,
	"muted" boolean DEFAULT false,
	"documentationc" integer DEFAULT 0,
	"lastssen" text,
	"joinuser" text,
	"site_badge_id" varchar(255) DEFAULT '',
	"site_badge" text,
	"coins" bigint DEFAULT 0,
	"gift_ico" varchar(255) DEFAULT '',
	"gcol" varchar(255) DEFAULT '#FFFFFF',
	"last_eval_login_day" varchar(20) DEFAULT '',
	"auto_power" varchar(255) DEFAULT '',
	"wall_post_likes" bigint DEFAULT 0,
	"gifts_received_count" bigint DEFAULT 0,
	"eval_awards_json" text,
	"busy" boolean DEFAULT false,
	"alerts" boolean DEFAULT false,
	"nopmcall" boolean DEFAULT false,
	"nopmvideocall" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"idreg" serial PRIMARY KEY NOT NULL,
	"msg" varchar(255) DEFAULT '(عضو جديد)',
	"pic" varchar(255) DEFAULT 'pic.png',
	"power" varchar(255) DEFAULT '',
	"country" varchar(255) DEFAULT '',
	"room" varchar(255) DEFAULT '',
	"ip" varchar(255) DEFAULT '',
	"id" varchar(255) DEFAULT '',
	"stat" integer DEFAULT 0,
	"topic" varchar(255) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "room_welcome_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" varchar(255) NOT NULL,
	"identity_key" varchar(255) NOT NULL,
	"is_guest" boolean DEFAULT false,
	"first_seen" bigint DEFAULT 0,
	"last_seen" bigint DEFAULT 0,
	"visits" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"idroom" serial PRIMARY KEY NOT NULL,
	"about" varchar(255),
	"user" varchar(255),
	"pass" varchar(255),
	"id" varchar(255),
	"owner" varchar(255),
	"topic" varchar(255),
	"pic" varchar(255),
	"rmli" integer DEFAULT 0,
	"mic" integer DEFAULT 0,
	"welcome" varchar(255),
	"broadcast" boolean DEFAULT false,
	"deleted" boolean DEFAULT false,
	"needpass" boolean DEFAULT false,
	"color" varchar(255) DEFAULT '#000000',
	"max" integer DEFAULT 0,
	"stage_count" integer DEFAULT 5,
	"stage_state" text,
	"room_owner_meta" text,
	"message_mode" varchar(16) DEFAULT 'real'
);
--> statement-breakpoint
CREATE TABLE "bars" (
	"id" serial PRIMARY KEY NOT NULL,
	"bcc" text,
	"likes" varchar(2000) DEFAULT '[]',
	"bg" varchar(255),
	"bid" varchar(255),
	"lid" varchar(255),
	"mcol" varchar(255),
	"msg" text,
	"pic" varchar(255),
	"topic" varchar(255),
	"ucol" varchar(255),
	"uid" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "internal_mail" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"from_uid" varchar(255) NOT NULL,
	"from_username" varchar(255) DEFAULT '',
	"from_topic" varchar(255) DEFAULT '',
	"from_pic" varchar(255) DEFAULT '',
	"to_uid" varchar(255) NOT NULL,
	"to_username" varchar(255) DEFAULT '',
	"to_topic" varchar(255) DEFAULT '',
	"to_pic" varchar(255) DEFAULT '',
	"body" text,
	"is_read" boolean DEFAULT false,
	"created_at" bigint NOT NULL,
	"read_at" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "intromsg" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(255),
	"adresse" varchar(255),
	"msg" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "note_comment_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_cid" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cid" varchar(64) NOT NULL,
	"note_nid" varchar(64) NOT NULL,
	"parent_cid" varchar(64) DEFAULT '',
	"reply_to_topic" varchar(255) DEFAULT '',
	"author_uid" varchar(255) NOT NULL,
	"author_topic" varchar(255) DEFAULT '',
	"author_pic" varchar(255) DEFAULT '',
	"author_ucol" varchar(64) DEFAULT '',
	"author_verified" boolean DEFAULT false,
	"body" text NOT NULL,
	"likes_count" integer DEFAULT 0,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"note_nid" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"topic" varchar(255) DEFAULT '',
	"photo" varchar(255) DEFAULT '',
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storie" (
	"id" serial PRIMARY KEY NOT NULL,
	"sid" varchar(255) DEFAULT '',
	"photo" varchar(255) DEFAULT '',
	"name" varchar(255) DEFAULT '',
	"link" varchar(255) DEFAULT '',
	"lastUpdated" varchar(255) DEFAULT '',
	"item" text DEFAULT '[]',
	"seen" boolean DEFAULT false,
	"currentPreview" varchar(2000) DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE "storieview" (
	"id" serial PRIMARY KEY NOT NULL,
	"sid" varchar(255) DEFAULT '',
	"topic" varchar(255) DEFAULT '',
	"photo" varchar(255) DEFAULT '',
	"idsto" varchar(255) DEFAULT '',
	"item" integer DEFAULT 0,
	"time" text
);
--> statement-breakpoint
CREATE TABLE "story_comment_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_cid" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_comments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cid" varchar(64) NOT NULL,
	"story_sid" varchar(255) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"parent_cid" varchar(64) DEFAULT '',
	"reply_to_topic" varchar(255) DEFAULT '',
	"author_uid" varchar(255) NOT NULL,
	"author_topic" varchar(255) DEFAULT '',
	"author_pic" varchar(255) DEFAULT '',
	"author_ucol" varchar(64) DEFAULT '',
	"author_verified" boolean DEFAULT false,
	"body" text NOT NULL,
	"likes_count" integer DEFAULT 0,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_likes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"story_sid" varchar(255) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"user_uid" varchar(255) NOT NULL,
	"topic" varchar(255) DEFAULT '',
	"photo" varchar(255) DEFAULT '',
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top10wall" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" varchar(255) DEFAULT '',
	"otype" varchar(255) DEFAULT '',
	"pic" varchar(255) DEFAULT '',
	"topic" varchar(255) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"nid" varchar(64) NOT NULL,
	"uid" varchar(255) NOT NULL,
	"author_topic" varchar(255) DEFAULT '',
	"author_pic" varchar(255) DEFAULT '',
	"author_ucol" varchar(64) DEFAULT '',
	"author_verified" boolean DEFAULT false,
	"type" varchar(32) DEFAULT 'text' NOT NULL,
	"text" text DEFAULT '',
	"caption" varchar(500) DEFAULT '',
	"audio_url" varchar(500) DEFAULT '',
	"duration" integer DEFAULT 0,
	"tag" varchar(64) DEFAULT '',
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_payment_methods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"agent_id" bigint NOT NULL,
	"method_name" varchar(255) NOT NULL,
	"account_name" varchar(255) DEFAULT '',
	"account_identifier" varchar(255) DEFAULT '',
	"instructions" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wallet_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"agent_id" bigint NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"amount" bigint NOT NULL,
	"before_balance" bigint NOT NULL,
	"after_balance" bigint NOT NULL,
	"actor_type" varchar(64) DEFAULT '',
	"actor_id" varchar(255) DEFAULT '',
	"counterparty_type" varchar(64) DEFAULT '',
	"counterparty_id" varchar(255) DEFAULT '',
	"note" text,
	"reference_table" varchar(128) DEFAULT '',
	"reference_id" bigint DEFAULT 0,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wallets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"agent_id" bigint NOT NULL,
	"balance_coins" bigint DEFAULT 0,
	"reserved_coins" bigint DEFAULT 0,
	"status" varchar(32) DEFAULT 'active',
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"country_code" varchar(16) DEFAULT '',
	"city" varchar(255) DEFAULT '',
	"phone" varchar(64) DEFAULT '',
	"username" varchar(64) NOT NULL,
	"password_hash" text,
	"status" varchar(32) DEFAULT 'active',
	"commission_type" varchar(32) DEFAULT 'spread',
	"commission_value" numeric(18, 4) DEFAULT '0.0000',
	"can_receive_orders" boolean DEFAULT true,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"event_type" varchar(64) NOT NULL,
	"actor_uid" varchar(255) DEFAULT '',
	"actor_idreg" integer DEFAULT 0,
	"user_uid" varchar(255) DEFAULT '',
	"user_idreg" integer DEFAULT 0,
	"counterparty_uid" varchar(255) DEFAULT '',
	"counterparty_idreg" integer DEFAULT 0,
	"amount" bigint NOT NULL,
	"before_balance" bigint NOT NULL,
	"after_balance" bigint NOT NULL,
	"gift_file" varchar(255) DEFAULT '',
	"note" text,
	"ip" varchar(255) DEFAULT '',
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_packages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"coins_amount" bigint NOT NULL,
	"price_local" numeric(18, 4) DEFAULT '0.0000',
	"currency" varchar(16) DEFAULT '',
	"country_code" varchar(16) DEFAULT '',
	"city" varchar(255) DEFAULT '',
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"to_uid" varchar(255) NOT NULL,
	"to_idreg" integer DEFAULT 0,
	"from_uid" varchar(255) DEFAULT '',
	"from_idreg" integer DEFAULT 0,
	"from_topic" varchar(255) DEFAULT '',
	"gift_file" varchar(255) DEFAULT '',
	"coin" bigint DEFAULT 0,
	"note" text,
	"is_read" boolean DEFAULT false,
	"created_at" bigint NOT NULL,
	"read_at" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "owner_agent_transfers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"agent_id" bigint NOT NULL,
	"coins_amount" bigint NOT NULL,
	"settlement_amount_local" numeric(18, 4) DEFAULT '0.0000',
	"currency" varchar(16) DEFAULT '',
	"status" varchar(32) DEFAULT 'approved',
	"note" text,
	"created_by" varchar(255) DEFAULT '',
	"approved_by" varchar(255) DEFAULT '',
	"created_at" bigint NOT NULL,
	"approved_at" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "site_master_wallet" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"balance_coins" bigint DEFAULT 0,
	"reserved_coins" bigint DEFAULT 0,
	"status" varchar(32) DEFAULT 'active',
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_master_wallet_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"site_id" integer NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"amount" bigint NOT NULL,
	"before_balance" bigint NOT NULL,
	"after_balance" bigint NOT NULL,
	"actor_type" varchar(64) DEFAULT '',
	"actor_id" varchar(255) DEFAULT '',
	"counterparty_type" varchar(64) DEFAULT '',
	"counterparty_id" varchar(255) DEFAULT '',
	"note" text,
	"reference_table" varchar(128) DEFAULT '',
	"reference_id" bigint DEFAULT 0,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topup_order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"order_no" varchar(64) DEFAULT '',
	"event_type" varchar(64) NOT NULL,
	"old_status" varchar(32) DEFAULT '',
	"new_status" varchar(32) DEFAULT '',
	"actor_type" varchar(64) DEFAULT '',
	"actor_id" varchar(255) DEFAULT '',
	"note" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topup_orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"user_uid" varchar(255) DEFAULT '',
	"user_idreg" integer DEFAULT 0,
	"user_topic" varchar(255) DEFAULT '',
	"user_username" varchar(64) DEFAULT '',
	"agent_id" bigint NOT NULL,
	"agent_code" varchar(64) DEFAULT '',
	"agent_name" varchar(255) DEFAULT '',
	"agent_phone" varchar(64) DEFAULT '',
	"agent_country_code" varchar(16) DEFAULT '',
	"agent_city" varchar(255) DEFAULT '',
	"package_id" bigint NOT NULL,
	"package_title" varchar(255) DEFAULT '',
	"package_coins" bigint NOT NULL,
	"package_price_local" numeric(18, 4) DEFAULT '0.0000',
	"customer_price_local" numeric(18, 4) DEFAULT '0.0000',
	"agent_profit_local" numeric(18, 4) DEFAULT '0.0000',
	"agent_commission_type" varchar(32) DEFAULT 'spread',
	"agent_commission_value" numeric(18, 4) DEFAULT '0.0000',
	"currency" varchar(16) DEFAULT '',
	"package_country_code" varchar(16) DEFAULT '',
	"package_city" varchar(255) DEFAULT '',
	"payment_method_id" bigint DEFAULT 0,
	"payment_method_name" varchar(255) DEFAULT '',
	"payment_method_account_name" varchar(255) DEFAULT '',
	"payment_method_identifier" varchar(255) DEFAULT '',
	"receipt_path" varchar(255) DEFAULT '',
	"receipt_uploaded_at" bigint DEFAULT 0,
	"payment_reference" varchar(255) DEFAULT '',
	"payment_note" text,
	"status" varchar(32) DEFAULT 'pending',
	"processed_by" varchar(255) DEFAULT '',
	"processed_note" text,
	"reject_reason" text,
	"requested_at" bigint NOT NULL,
	"processed_at" bigint DEFAULT 0,
	"source_ip" varchar(255) DEFAULT '',
	"agent_commission_coins" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "topup_settlement_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"order_id" bigint NOT NULL,
	"order_no" varchar(64) DEFAULT '',
	"event_type" varchar(64) NOT NULL,
	"agent_id" bigint DEFAULT 0,
	"agent_name" varchar(255) DEFAULT '',
	"user_uid" varchar(255) DEFAULT '',
	"user_idreg" integer DEFAULT 0,
	"package_id" bigint DEFAULT 0,
	"package_title" varchar(255) DEFAULT '',
	"package_coins" bigint DEFAULT 0,
	"currency" varchar(16) DEFAULT '',
	"customer_price_local" numeric(18, 4) DEFAULT '0.0000',
	"site_share_local" numeric(18, 4) DEFAULT '0.0000',
	"agent_profit_local" numeric(18, 4) DEFAULT '0.0000',
	"processed_by" varchar(255) DEFAULT '',
	"note" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "band" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_band" varchar(255),
	"type" varchar(255),
	"deccode" varchar(255),
	"decoderDans" varchar(255),
	"device_band" varchar(255),
	"ip_band" varchar(255),
	"country_band" varchar(2),
	"date" varchar(255) DEFAULT 'دائم'
);
--> statement-breakpoint
CREATE TABLE "bsb" (
	"id" serial PRIMARY KEY NOT NULL,
	"systems" varchar(255) DEFAULT '',
	"browsers" varchar(255) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "cuts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text1" varchar(255),
	"text2" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "histletter" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" varchar(255),
	"msg" varchar(255),
	"topic" varchar(255),
	"v" varchar(255),
	"time" varchar(255),
	"target" varchar(255),
	"source" varchar(255),
	"path" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostname" varchar(255),
	"setting" integer
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(255),
	"topic" varchar(255),
	"username" varchar(255),
	"ip" varchar(255),
	"code" varchar(255),
	"device" varchar(255) DEFAULT 'en',
	"isin" varchar(255),
	"time" text
);
--> statement-breakpoint
CREATE TABLE "notext" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(255),
	"path" varchar(255),
	"v" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" serial PRIMARY KEY NOT NULL,
	"bars" boolean DEFAULT true,
	"Vpn" boolean DEFAULT false,
	"Gust" text,
	"datafinish" timestamp DEFAULT now(),
	"MaxRep" integer DEFAULT 3,
	"Tv" text,
	"Vistor" text,
	"room" varchar(255),
	"isbanner" boolean DEFAULT false,
	"rc" boolean DEFAULT false,
	"cooment" boolean DEFAULT false,
	"offline" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "powers" (
	"id" serial PRIMARY KEY NOT NULL,
	"powers" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"site" text,
	"dro3" text,
	"them" text,
	"cover" text,
	"emo" text,
	"sico" text,
	"room_badges" text,
	"site_badges" text,
	"gifts_git" text,
	"gift_categories" text
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" serial PRIMARY KEY NOT NULL,
	"banner" varchar(255),
	"host" varchar(255),
	"ids" integer,
	"logo" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(255),
	"topic" varchar(255),
	"username" varchar(255),
	"room" varchar(255),
	"ip" varchar(255),
	"time" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"user_uid" varchar(255) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"owner_token" varchar(64) NOT NULL,
	"lease_expires_at" bigint NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"response_json" text,
	"error_message" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "pk_idempotency_records" PRIMARY KEY("user_uid","idempotency_key"),
	CONSTRAINT "chk_idem_status" CHECK (status IN ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "idx_followers_follower" ON "followers" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "idx_followers_following" ON "followers" USING btree ("following_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_followers_pair" ON "followers" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "idx_names_iduser" ON "names" USING btree ("iduser");--> statement-breakpoint
CREATE INDEX "idx_names_fp" ON "names" USING btree ("fp");--> statement-breakpoint
CREATE INDEX "idx_names_ip" ON "names" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_profile_visits_owner" ON "profile_visits" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_profile_visits_visitor" ON "profile_visits" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "idx_profile_visits_owner_seen" ON "profile_visits" USING btree ("owner_id","seen","time");--> statement-breakpoint
CREATE INDEX "idx_sub_iduser" ON "sub" USING btree ("iduser");--> statement-breakpoint
CREATE INDEX "idx_sub_sub" ON "sub" USING btree ("sub");--> statement-breakpoint
CREATE INDEX "idx_sub_timefinish" ON "sub" USING btree ("timefinish");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_uid" ON "users" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "idx_users_lid" ON "users" USING btree ("lid");--> statement-breakpoint
CREATE INDEX "idx_users_token" ON "users" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_users_ip" ON "users" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_users_fp" ON "users" USING btree ("fp");--> statement-breakpoint
CREATE INDEX "idx_users_topic" ON "users" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_users_eval_desc" ON "users" USING btree ("evaluation");--> statement-breakpoint
CREATE INDEX "idx_users_rep_desc" ON "users" USING btree ("rep");--> statement-breakpoint
CREATE INDEX "idx_bots_id" ON "bots" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_bots_room" ON "bots" USING btree ("room");--> statement-breakpoint
CREATE INDEX "idx_bots_stat" ON "bots" USING btree ("stat");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_room_welcome_visit" ON "room_welcome_visits" USING btree ("room_id","identity_key");--> statement-breakpoint
CREATE INDEX "idx_room_welcome_room" ON "room_welcome_visits" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_rooms_id" ON "rooms" USING btree ("id");--> statement-breakpoint
CREATE INDEX "idx_rooms_owner" ON "rooms" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "idx_rooms_topic" ON "rooms" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_bars_bid" ON "bars" USING btree ("bid");--> statement-breakpoint
CREATE INDEX "idx_bars_uid" ON "bars" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "idx_bars_lid" ON "bars" USING btree ("lid");--> statement-breakpoint
CREATE INDEX "idx_bars_lid_bid" ON "bars" USING btree ("lid","bid");--> statement-breakpoint
CREATE INDEX "idx_mail_from_uid" ON "internal_mail" USING btree ("from_uid");--> statement-breakpoint
CREATE INDEX "idx_mail_to_uid" ON "internal_mail" USING btree ("to_uid","is_read","created_at");--> statement-breakpoint
CREATE INDEX "idx_intromsg_category" ON "intromsg" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_note_comment_likes_cid_user" ON "note_comment_likes" USING btree ("comment_cid","user_uid");--> statement-breakpoint
CREATE INDEX "idx_note_comments_target" ON "note_comments" USING btree ("note_nid","created_at");--> statement-breakpoint
CREATE INDEX "idx_note_comments_cid" ON "note_comments" USING btree ("cid");--> statement-breakpoint
CREATE INDEX "idx_note_comments_parent" ON "note_comments" USING btree ("parent_cid");--> statement-breakpoint
CREATE INDEX "idx_note_likes_target" ON "note_likes" USING btree ("note_nid");--> statement-breakpoint
CREATE INDEX "idx_note_likes_user" ON "note_likes" USING btree ("note_nid","user_uid");--> statement-breakpoint
CREATE INDEX "idx_storie_sid" ON "storie" USING btree ("sid");--> statement-breakpoint
CREATE INDEX "idx_storieview_sid" ON "storieview" USING btree ("sid");--> statement-breakpoint
CREATE INDEX "idx_storieview_idsto" ON "storieview" USING btree ("idsto");--> statement-breakpoint
CREATE INDEX "idx_story_comment_likes_cid_user" ON "story_comment_likes" USING btree ("comment_cid","user_uid");--> statement-breakpoint
CREATE INDEX "idx_story_comments_target" ON "story_comments" USING btree ("story_sid","item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_story_comments_cid" ON "story_comments" USING btree ("cid");--> statement-breakpoint
CREATE INDEX "idx_story_comments_parent" ON "story_comments" USING btree ("parent_cid");--> statement-breakpoint
CREATE INDEX "idx_story_likes_target" ON "story_likes" USING btree ("story_sid","item_id");--> statement-breakpoint
CREATE INDEX "idx_story_likes_user" ON "story_likes" USING btree ("story_sid","item_id","user_uid");--> statement-breakpoint
CREATE INDEX "idx_top10wall_uid" ON "top10wall" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "idx_top10wall_otype" ON "top10wall" USING btree ("otype");--> statement-breakpoint
CREATE INDEX "idx_user_notes_nid" ON "user_notes" USING btree ("nid");--> statement-breakpoint
CREATE INDEX "idx_user_notes_uid" ON "user_notes" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "idx_user_notes_created_at" ON "user_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_apm_agent" ON "agent_payment_methods" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_apm_active" ON "agent_payment_methods" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_awl_txid" ON "agent_wallet_ledger" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_awl_agent" ON "agent_wallet_ledger" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_agent_wallets_agent" ON "agent_wallets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_wallets_status" ON "agent_wallets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_agents_code" ON "agents" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_agents_username" ON "agents" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_agents_country" ON "agents" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coin_ledger_txid" ON "coin_ledger" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_coin_ledger_user_uid" ON "coin_ledger" USING btree ("user_uid","created_at");--> statement-breakpoint
CREATE INDEX "idx_coin_ledger_created_at" ON "coin_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cp_country" ON "coin_packages" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_cp_active_sort" ON "coin_packages" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "idx_gift_notif_txid" ON "gift_notifications" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_gift_notif_to_uid" ON "gift_notifications" USING btree ("to_uid","is_read","created_at");--> statement-breakpoint
CREATE INDEX "idx_gift_notif_created_at" ON "gift_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_oat_txid" ON "owner_agent_transfers" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_oat_agent" ON "owner_agent_transfers" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_site_master_wallet_site" ON "site_master_wallet" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_smwl_txid" ON "site_master_wallet_ledger" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_smwl_site" ON "site_master_wallet_ledger" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_toe_order_id" ON "topup_order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_toe_created_at" ON "topup_order_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_topup_orders_order_no" ON "topup_orders" USING btree ("order_no");--> statement-breakpoint
CREATE INDEX "idx_topup_orders_status" ON "topup_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_topup_orders_user_uid" ON "topup_orders" USING btree ("user_uid");--> statement-breakpoint
CREATE INDEX "idx_topup_orders_agent_id" ON "topup_orders" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_topup_orders_requested_at" ON "topup_orders" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "idx_tsl_txid" ON "topup_settlement_ledger" USING btree ("txid");--> statement-breakpoint
CREATE INDEX "idx_tsl_order" ON "topup_settlement_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_tsl_agent" ON "topup_settlement_ledger" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_tsl_created_at" ON "topup_settlement_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_band_device_band" ON "band" USING btree ("device_band");--> statement-breakpoint
CREATE INDEX "idx_band_ip_band" ON "band" USING btree ("ip_band");--> statement-breakpoint
CREATE INDEX "idx_band_country_band" ON "band" USING btree ("country_band");--> statement-breakpoint
CREATE INDEX "idx_band_decoderDans" ON "band" USING btree ("decoderDans");--> statement-breakpoint
CREATE INDEX "idx_band_name_band" ON "band" USING btree ("name_band");--> statement-breakpoint
CREATE INDEX "idx_cuts_text1" ON "cuts" USING btree ("text1");--> statement-breakpoint
CREATE INDEX "idx_histletter_ip" ON "histletter" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_histletter_topic" ON "histletter" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_hosts_hostname" ON "hosts" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "idx_hosts_setting" ON "hosts" USING btree ("setting");--> statement-breakpoint
CREATE INDEX "idx_logs_ip" ON "logs" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_logs_state" ON "logs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_logs_lookup" ON "logs" USING btree ("ip","state","topic","username");--> statement-breakpoint
CREATE INDEX "idx_notext_type" ON "notext" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notext_path" ON "notext" USING btree ("path");--> statement-breakpoint
CREATE INDEX "idx_owner_room" ON "owner" USING btree ("room");--> statement-breakpoint
CREATE INDEX "idx_site_ids" ON "site" USING btree ("ids");--> statement-breakpoint
CREATE INDEX "idx_site_host" ON "site" USING btree ("host");--> statement-breakpoint
CREATE INDEX "idx_stats_room" ON "stats" USING btree ("room");--> statement-breakpoint
CREATE INDEX "idx_stats_ip" ON "stats" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_stats_time" ON "stats" USING btree ("time");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_idem_txid" ON "idempotency_records" USING btree ("txid") WHERE txid <> '';--> statement-breakpoint
CREATE INDEX "idx_idem_status_lease" ON "idempotency_records" USING btree ("status","lease_expires_at");