CREATE TABLE `game` (
	`igdb_id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`cover_image_id` text,
	`first_release_date` integer,
	`summary` text,
	`genres` text,
	`platforms` text,
	`rating` real,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`type` text NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_activity_user_created_idx` ON `game_activity` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `game_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`rating` real,
	`favorite` integer DEFAULT false NOT NULL,
	`platform` text,
	`review` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_entry_user_game_unique` ON `game_entry` (`user_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_entry_user_status_idx` ON `game_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `game_entry_user_favorite_idx` ON `game_entry` (`user_id`,`favorite`);--> statement-breakpoint
CREATE TABLE `game_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_list_user_idx` ON `game_list` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_list_user_name_unique` ON `game_list` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `game_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `game_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `game`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_list_item_list_game_unique` ON `game_list_item` (`list_id`,`game_id`);