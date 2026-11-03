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
ALTER TABLE "users" RENAME TO "system_users";--> statement-breakpoint
ALTER TABLE "user_identities" RENAME TO "client_user_identities";--> statement-breakpoint
ALTER TABLE "user_uid_counters" RENAME TO "client_user_uid_counters";--> statement-breakpoint
ALTER TABLE "client_user_identities" DROP CONSTRAINT "user_identities_user_id_users_id_fkey";--> statement-breakpoint
-- Retain issued business IDs and platform identities before removing client-only
-- records and fields from the administration table. Ambiguous rows require review.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "system_users"
    WHERE "uid" IS NULL AND ("username" IS NULL OR "password" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Account split requires a business UID or complete admin credentials for every account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "client_user_identities" AS i
    JOIN "system_users" AS u ON u."id" = i."user_id"
    WHERE u."uid" IS NULL
  ) THEN
    RAISE EXCEPTION 'Account split requires a business UID for every platform identity';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO "client_users" (
  "id", "created_at", "created_by", "updated_at", "updated_by",
  "uid", "nickname", "avatar", "status", "register_source", "last_login_date"
)
SELECT
  "id", "created_at", "created_by", "updated_at", "updated_by",
  "uid", "nick_name", "avatar", "status", "register_source", "last_login_date"
FROM "system_users" WHERE "uid" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "system_users" WHERE "username" IS NULL OR "password" IS NULL;
--> statement-breakpoint
ALTER TABLE "system_users" DROP CONSTRAINT "users_uid_unique";--> statement-breakpoint
ALTER TABLE "client_user_uid_counters" RENAME CONSTRAINT "user_uid_counters_prefix_check" TO "client_user_uid_counters_prefix_check";--> statement-breakpoint
ALTER TABLE "client_user_uid_counters" RENAME CONSTRAINT "user_uid_counters_value_check" TO "client_user_uid_counters_value_check";--> statement-breakpoint
ALTER INDEX "user_identities_user_id_idx" RENAME TO "client_user_identities_user_id_idx";--> statement-breakpoint
DROP INDEX "users_status_idx";--> statement-breakpoint
ALTER TABLE "system_users" DROP COLUMN "uid";--> statement-breakpoint
ALTER TABLE "system_users" DROP COLUMN "register_source";--> statement-breakpoint
ALTER TABLE "system_users" DROP COLUMN "last_login_date";--> statement-breakpoint
ALTER TABLE "system_users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_users" ALTER COLUMN "password" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_users" ALTER COLUMN "nick_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_user_identities" RENAME CONSTRAINT "user_identities_provider_subject_unique" TO "client_user_identities_provider_subject_unique";--> statement-breakpoint
ALTER TABLE "system_users" RENAME CONSTRAINT "users_username_unique" TO "system_users_username_key";--> statement-breakpoint
CREATE INDEX "system_user_username_idx" ON "system_users" ("username");--> statement-breakpoint
CREATE INDEX "client_users_status_idx" ON "client_users" ("status");--> statement-breakpoint
ALTER TABLE "client_user_identities" ADD CONSTRAINT "client_user_identities_user_id_client_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_users"("id") ON DELETE CASCADE;
