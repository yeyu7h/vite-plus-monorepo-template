DELETE FROM "casbin_rule"
WHERE "ptype" = 'p'
	AND "v0" = 'admin';--> statement-breakpoint
INSERT INTO "casbin_rule" ("ptype", "v0", "v1", "v2", "v3", "v4", "v5")
VALUES ('p', 'admin', '/*', '.*', '', '', '')
ON CONFLICT DO NOTHING;
