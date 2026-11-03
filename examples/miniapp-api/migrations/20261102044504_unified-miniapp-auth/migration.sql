CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"subject_type" varchar(16) NOT NULL,
	"subject" varchar(128) NOT NULL,
	"union_id" varchar(128),
	"created_at" timestamp(0),
	"last_login_date" timestamp(0),
	CONSTRAINT "user_identities_provider_subject_unique" UNIQUE("provider","app_id","subject_type","subject")
);
--> statement-breakpoint
CREATE TABLE "user_uid_counters" (
	"id" varchar(1) PRIMARY KEY,
	"value" bigint NOT NULL,
	CONSTRAINT "user_uid_counters_prefix_check" CHECK ("id" ~ '^[1-9]$'),
	CONSTRAINT "user_uid_counters_value_check" CHECK ("value" > 0)
);
--> statement-breakpoint
ALTER TABLE "system_users" RENAME TO "users";--> statement-breakpoint
DROP TABLE "client_users";--> statement-breakpoint
DROP INDEX "system_user_username_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "uid" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "register_source" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_date" timestamp(0);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "nick_name" SET DEFAULT '用户';--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "system_users_username_key" TO "users_username_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_uid_unique" UNIQUE("uid");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" ("status");--> statement-breakpoint
CREATE INDEX "user_identities_user_id_idx" ON "user_identities" ("user_id");--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;