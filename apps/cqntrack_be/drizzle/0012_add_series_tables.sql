CREATE TABLE `series` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`poster_path` text,
	`first_air_date` integer,
	`overview` text,
	`genres` text,
	`number_of_seasons` integer,
	`number_of_episodes` integer,
	`rating` real,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` integer NOT NULL,
	`status` text,
	`rating` real,
	`current_season` integer,
	`current_episode` integer,
	`favorite_slot` integer,
	`review` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_entry_user_series_unique` ON `series_entry` (`user_id`,`series_id`);--> statement-breakpoint
CREATE INDEX `series_entry_user_status_idx` ON `series_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `series_entry_user_favorite_slot_unique` ON `series_entry` (`user_id`,`favorite_slot`) WHERE "series_entry"."favorite_slot" is not null;--> statement-breakpoint
CREATE TABLE `series_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `series_list_user_idx` ON `series_list` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `series_list_user_name_unique` ON `series_list` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `series_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`series_id` integer NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `series_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_list_item_list_series_unique` ON `series_list_item` (`list_id`,`series_id`);