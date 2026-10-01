DELETE FROM "casbin_rule"
WHERE "ptype" = 'p'
	AND "v1" IN ('/system/users/{userId}/roles', '/system/users/{id}/roles');
