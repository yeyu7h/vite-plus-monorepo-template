ALTER TABLE "system_menus" DROP CONSTRAINT "system_menus_group_id_system_menu_groups_id_fkey";--> statement-breakpoint
ALTER TABLE "system_menus" ALTER COLUMN "path" DROP NOT NULL;--> statement-breakpoint
INSERT INTO "system_menus" (
	"id",
	"created_at",
	"created_by",
	"updated_at",
	"updated_by",
	"parent_id",
	"group_id",
	"type",
	"path",
	"title",
	"order",
	"status"
)
SELECT
	'group_' || "id",
	"created_at",
	"created_by",
	"updated_at",
	"updated_by",
	NULL,
	NULL,
	'group',
	NULL,
	"label",
	"order",
	"status"
FROM "system_menu_groups";--> statement-breakpoint
UPDATE "system_menus"
SET "parent_id" = 'group_' || "group_id"
WHERE "group_id" IS NOT NULL;--> statement-breakpoint
DELETE FROM "system_menus"
WHERE "id" IN ('system-menu-group-create', 'system-menu-group-update', 'system-menu-group-delete');--> statement-breakpoint
DELETE FROM "casbin_rule"
WHERE "ptype" = 'p'
	AND "v1" IN ('/system/menu-groups', '/system/menu-groups/{id}');--> statement-breakpoint
DROP INDEX "system_menus_group_id_idx";--> statement-breakpoint
ALTER TABLE "system_menus" DROP COLUMN "group_id";--> statement-breakpoint
DROP TABLE "system_menu_groups";--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_type_path_check" CHECK (("type" = 'group' AND "path" IS NULL) OR ("type" <> 'group' AND "path" IS NOT NULL));
