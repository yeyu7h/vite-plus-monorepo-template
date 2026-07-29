ALTER TABLE "system_menus" DROP CONSTRAINT "system_menus_type_fields_check", ADD CONSTRAINT "system_menus_type_fields_check" CHECK ((
        ("type" = 'BUTTON' and "path" is null and "permission_code" is not null and "resource" is not null and "action" is not null)
        or
        ("type" = 'PAGE' and "path" is not null and "resource" is null and "action" is null)
        or
        ("type" <> 'BUTTON' and "type" <> 'PAGE' and "path" is not null and "permission_code" is null and "resource" is null and "action" is null)
      ));