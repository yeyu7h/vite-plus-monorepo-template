CREATE TABLE "system_menu_groups" (
	"id" varchar(64) PRIMARY KEY,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"label" varchar(128) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_menu_roles" (
	"menu_id" varchar(128),
	"role_id" varchar(64),
	CONSTRAINT "system_menu_roles_pkey" PRIMARY KEY("menu_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "system_menus" (
	"id" varchar(128) PRIMARY KEY,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"parent_id" varchar(128),
	"group_id" varchar(64),
	"type" varchar(16) DEFAULT 'menu' NOT NULL,
	"path" varchar(255) NOT NULL,
	"title" varchar(128) NOT NULL,
	"description" text,
	"icon" jsonb,
	"active_path" varchar(255),
	"external_link" text,
	"iframe_src" text,
	"content_mode" varchar(16),
	"hide_in_breadcrumb" boolean DEFAULT false NOT NULL,
	"hide_in_menu" boolean DEFAULT false NOT NULL,
	"hide_in_tab" boolean DEFAULT false NOT NULL,
	"ignore_access" boolean DEFAULT false NOT NULL,
	"keep_alive" boolean DEFAULT false NOT NULL,
	"menu_visible_with_forbidden" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"permission_code" varchar(128),
	"show_active_tab_border" boolean DEFAULT false NOT NULL,
	"tab_path" varchar(255),
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "system_menu_groups_status_idx" ON "system_menu_groups" ("status");--> statement-breakpoint
CREATE INDEX "system_menu_roles_menu_id_idx" ON "system_menu_roles" ("menu_id");--> statement-breakpoint
CREATE INDEX "system_menu_roles_role_id_idx" ON "system_menu_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "system_menus_parent_id_idx" ON "system_menus" ("parent_id");--> statement-breakpoint
CREATE INDEX "system_menus_group_id_idx" ON "system_menus" ("group_id");--> statement-breakpoint
CREATE INDEX "system_menus_status_order_idx" ON "system_menus" ("status","order");--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_menu_id_system_menus_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "system_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_role_id_system_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_parent_id_system_menus_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "system_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_group_id_system_menu_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "system_menu_groups"("id") ON DELETE SET NULL;