DELETE FROM "casbin_rule"
WHERE "ptype" = 'p'
	AND "v0" = 'admin';--> statement-breakpoint
INSERT INTO "casbin_rule" ("ptype", "v0", "v1", "v2", "v3", "v4", "v5")
VALUES
	('p', 'admin', '/system/menus/tree', 'GET', '', '', ''),
	('p', 'admin', '/system/menus', 'POST', '', '', ''),
	('p', 'admin', '/system/menus/{id}', 'PATCH', '', '', ''),
	('p', 'admin', '/system/menus/{id}', 'DELETE', '', '', ''),
	('p', 'admin', '/system/roles', 'GET', '', '', ''),
	('p', 'admin', '/system/roles', 'POST', '', '', ''),
	('p', 'admin', '/system/roles/{id}', 'DELETE', '', '', ''),
	('p', 'admin', '/system/roles/{id}', 'GET', '', '', ''),
	('p', 'admin', '/system/roles/{id}', 'PATCH', '', '', ''),
	('p', 'admin', '/system/roles/{id}/permissions', 'GET', '', '', ''),
	('p', 'admin', '/system/roles/{id}/permissions', 'PUT', '', '', ''),
	('p', 'admin', '/system/roles/{id}/menus', 'GET', '', '', ''),
	('p', 'admin', '/system/roles/{id}/menus', 'PUT', '', '', ''),
	('p', 'admin', '/system/users', 'GET', '', '', ''),
	('p', 'admin', '/system/users', 'POST', '', '', ''),
	('p', 'admin', '/system/users/{id}', 'DELETE', '', '', ''),
	('p', 'admin', '/system/users/{id}', 'GET', '', '', ''),
	('p', 'admin', '/system/users/{id}', 'PATCH', '', '', ''),
	('p', 'admin', '/system/users/{userId}/roles', 'PUT', '', '', ''),
	('p', 'admin', '/system/dicts', 'GET', '', '', ''),
	('p', 'admin', '/system/dicts', 'POST', '', '', ''),
	('p', 'admin', '/system/dicts/{id}', 'DELETE', '', '', ''),
	('p', 'admin', '/system/dicts/{id}', 'GET', '', '', ''),
	('p', 'admin', '/system/dicts/{id}', 'PATCH', '', '', ''),
	('p', 'admin', '/system/params', 'GET', '', '', ''),
	('p', 'admin', '/system/params', 'POST', '', '', ''),
	('p', 'admin', '/system/params/{id}', 'DELETE', '', '', ''),
	('p', 'admin', '/system/params/{id}', 'GET', '', '', ''),
	('p', 'admin', '/system/params/{id}', 'PATCH', '', '', ''),
	('p', 'admin', '/resources/object-storage/upload', 'POST', '', '', ''),
	('p', 'admin', '/resources/object-storage/download', 'POST', '', '', '')
ON CONFLICT DO NOTHING;
