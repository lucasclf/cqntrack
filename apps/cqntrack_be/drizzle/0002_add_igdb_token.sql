CREATE TABLE `igdb_token` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`access_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
