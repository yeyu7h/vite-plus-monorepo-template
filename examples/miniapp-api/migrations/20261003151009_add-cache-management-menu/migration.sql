INSERT INTO "system_menus" ("id", "parent_id", "type", "path", "title", "icon", "order", "status")
SELECT 'monitor-cache', 'monitor', 'menu', 'cache', '缓存管理', '"i-lucide-database"'::jsonb, 20, 'ENABLED'
WHERE EXISTS (SELECT 1 FROM "system_menus" WHERE "id" = 'monitor')
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "system_menu_roles" ("menu_id", "role_id")
SELECT 'monitor-cache', 'admin'
WHERE EXISTS (SELECT 1 FROM "system_menus" WHERE "id" = 'monitor-cache')
  AND EXISTS (SELECT 1 FROM "system_roles" WHERE "id" = 'admin')
ON CONFLICT ("menu_id", "role_id") DO NOTHING;
