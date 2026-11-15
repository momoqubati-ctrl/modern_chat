-- Migration: Stage B - Idempotency Records
-- Description: Creates idempotency_records table with compound primary key, status check constraint, partial unique index on txid, and frozen price protection (locked_unit_coin).

CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"user_uid" varchar(255) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"owner_token" varchar(64) NOT NULL,
	"lease_expires_at" bigint NOT NULL,
	"locked_unit_coin" bigint NOT NULL,
	"txid" varchar(128) DEFAULT '',
	"response_json" text,
	"error_message" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "pk_idempotency_records" PRIMARY KEY("user_uid","idempotency_key"),
	CONSTRAINT "chk_idem_status" CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_idem_txid" ON "idempotency_records" USING btree ("txid") WHERE txid <> '';
CREATE INDEX IF NOT EXISTS "idx_idem_status_lease" ON "idempotency_records" USING btree ("status","lease_expires_at");
