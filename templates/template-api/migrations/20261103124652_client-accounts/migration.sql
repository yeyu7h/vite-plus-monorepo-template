CREATE TABLE "client_users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"uid" varchar(32) NOT NULL CONSTRAINT "client_users_uid_unique" UNIQUE,
	"nickname" varchar(64) DEFAULT '用户' NOT NULL,
	"avatar" text,
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL,
	"register_source" varchar(32),
	"last_login_date" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE "client_user_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"subject_type" varchar(16) NOT NULL,
	"subject" varchar(128) NOT NULL,
	"union_id" varchar(128),
	"created_at" timestamp(0),
	"last_login_date" timestamp(0),
	CONSTRAINT "client_user_identities_provider_subject_unique" UNIQUE("provider","app_id","subject_type","subject")
);
--> statement-breakpoint
CREATE TABLE "client_user_uid_counters" (
	"id" varchar(1) PRIMARY KEY,
	"value" bigint NOT NULL,
	CONSTRAINT "client_user_uid_counters_prefix_check" CHECK ("id" ~ '^[1-9]$'),
	CONSTRAINT "client_user_uid_counters_value_check" CHECK ("value" > 0)
);
--> statement-breakpoint
CREATE INDEX "client_users_status_idx" ON "client_users" ("status");--> statement-breakpoint
CREATE INDEX "client_user_identities_user_id_idx" ON "client_user_identities" ("user_id");--> statement-breakpoint
ALTER TABLE "client_user_identities" ADD CONSTRAINT "client_user_identities_user_id_client_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_users"("id") ON DELETE CASCADE;