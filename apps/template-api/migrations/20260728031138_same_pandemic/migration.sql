CREATE TABLE "system_menu_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"name" varchar(128) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_menu_roles" (
	"menu_id" uuid,
	"role_id" varchar(64),
	"policy_managed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "system_menu_roles_pkey" PRIMARY KEY("menu_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "system_menus" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"parent_id" uuid,
	"group_id" uuid,
	"type" varchar(16) NOT NULL,
	"title" varchar(128) NOT NULL,
	"path" varchar(254),
	"icon" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"active_path" varchar(254),
	"content_mode" varchar(16),
	"description" text,
	"external_link" varchar(2048),
	"hide_in_breadcrumb" boolean DEFAULT false NOT NULL,
	"hide_in_menu" boolean DEFAULT false NOT NULL,
	"hide_in_tab" boolean DEFAULT false NOT NULL,
	"iframe_src" varchar(2048),
	"ignore_access" boolean DEFAULT false NOT NULL,
	"keep_alive" boolean DEFAULT false NOT NULL,
	"menu_visible_with_forbidden" boolean DEFAULT false NOT NULL,
	"show_active_tab_border" boolean DEFAULT false NOT NULL,
	"tab_path" varchar(254),
	"permission_code" varchar(128),
	"resource" varchar(254),
	"action" varchar(64),
	CONSTRAINT "system_menus_type_fields_check" CHECK ((
        ("type" = 'BUTTON' and "path" is null and "permission_code" is not null and "resource" is not null and "action" is not null)
        or
        ("type" <> 'BUTTON' and "path" is not null and "permission_code" is null and "resource" is null and "action" is null)
      )),
	CONSTRAINT "system_menus_external_link_check" CHECK ("type" <> 'EXTERNAL' or "external_link" is not null),
	CONSTRAINT "system_menus_iframe_src_check" CHECK ("type" <> 'IFRAME' or "iframe_src" is not null),
	CONSTRAINT "system_menus_parent_self_check" CHECK ("parent_id" is null or "parent_id" <> "id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "system_menu_groups_name_uidx" ON "system_menu_groups" ("name");--> statement-breakpoint
CREATE INDEX "system_menu_groups_order_idx" ON "system_menu_groups" ("order");--> statement-breakpoint
CREATE INDEX "system_menu_roles_role_id_idx" ON "system_menu_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "system_menus_parent_order_idx" ON "system_menus" ("parent_id","order");--> statement-breakpoint
CREATE INDEX "system_menus_group_order_idx" ON "system_menus" ("group_id","order");--> statement-breakpoint
CREATE INDEX "system_menus_type_idx" ON "system_menus" ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "system_menus_path_uidx" ON "system_menus" ("path") WHERE "path" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "system_menus_permission_code_uidx" ON "system_menus" ("permission_code") WHERE "permission_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "system_menus_resource_action_uidx" ON "system_menus" ("resource","action") WHERE "resource" is not null and "action" is not null;--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_menu_id_system_menus_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "system_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_role_id_system_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_parent_id_system_menus_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "system_menus"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_group_id_system_menu_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "system_menu_groups"("id") ON DELETE RESTRICT;