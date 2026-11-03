DELETE FROM "system_menus"
WHERE "id" = 'system-settings-theme'
  AND "parent_id" = 'system-settings'
  AND "path" = 'theme';
