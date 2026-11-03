CREATE TABLE "casbin_rule" (
	"ptype" varchar(8),
	"v0" varchar(64),
	"v1" varchar(254),
	"v2" varchar(64) DEFAULT '',
	"v3" varchar(64) DEFAULT '' NOT NULL,
	"v4" varchar(64) DEFAULT '' NOT NULL,
	"v5" varchar(64) DEFAULT '' NOT NULL,
	CONSTRAINT "casbin_rule_pkey" PRIMARY KEY("ptype","v0","v1","v2")
);
--> statement-breakpoint
CREATE TABLE "system_dicts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"code" varchar(64) NOT NULL UNIQUE,
	"name" varchar(128) NOT NULL,
	"description" text,
	"items" jsonb DEFAULT '[]' NOT NULL,
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
	"type" varchar(16) DEFAULT 'menu' NOT NULL,
	"path" varchar(255),
	"title" varchar(128) NOT NULL,
	"description" text,
	"icon" jsonb,
	"active_path" varchar(255),
	"external_link" text,
	"iframe_src" text,
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
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL,
	CONSTRAINT "system_menus_type_path_check" CHECK (("type" = 'group' AND "path" IS NULL) OR ("type" <> 'group' AND "path" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "system_params" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"key" varchar(128) NOT NULL UNIQUE,
	"value" text NOT NULL,
	"value_type" varchar(16) DEFAULT 'STRING' NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_roles" (
	"id" varchar(64) PRIMARY KEY,
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"name" varchar(64) NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_user_roles" (
	"user_id" uuid,
	"role_id" varchar(64),
	CONSTRAINT "system_user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"created_at" timestamp(0),
	"created_by" varchar(64),
	"updated_at" timestamp(0),
	"updated_by" varchar(64),
	"username" varchar(64) NOT NULL UNIQUE,
	"password" text NOT NULL,
	"built_in" boolean DEFAULT false,
	"avatar" text,
	"home_path" varchar(255),
	"nick_name" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'ENABLED' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_casbin_g_v0" ON "casbin_rule" ("ptype","v0","v1");--> statement-breakpoint
CREATE INDEX "idx_casbin_v1" ON "casbin_rule" ("ptype","v1");--> statement-breakpoint
CREATE INDEX "system_dicts_status_idx" ON "system_dicts" ("status");--> statement-breakpoint
CREATE INDEX "system_menu_roles_menu_id_idx" ON "system_menu_roles" ("menu_id");--> statement-breakpoint
CREATE INDEX "system_menu_roles_role_id_idx" ON "system_menu_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "system_menus_parent_id_idx" ON "system_menus" ("parent_id");--> statement-breakpoint
CREATE INDEX "system_menus_status_order_idx" ON "system_menus" ("status","order");--> statement-breakpoint
CREATE INDEX "system_params_status_idx" ON "system_params" ("status");--> statement-breakpoint
CREATE INDEX "idx_user_roles_user_id" ON "system_user_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role_id" ON "system_user_roles" ("role_id");--> statement-breakpoint
CREATE INDEX "system_user_username_idx" ON "system_users" ("username");--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_menu_id_system_menus_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "system_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menu_roles" ADD CONSTRAINT "system_menu_roles_role_id_system_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_menus" ADD CONSTRAINT "system_menus_parent_id_system_menus_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "system_menus"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_user_roles" ADD CONSTRAINT "system_user_roles_user_id_system_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "system_users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "system_user_roles" ADD CONSTRAINT "system_user_roles_role_id_system_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "system_roles"("id") ON DELETE CASCADE;