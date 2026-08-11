CREATE TABLE `movie` (
	`tmdb_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`poster_path` text,
	`release_date` integer,
	`overview` text,
	`genres` text,
	`runtime` integer,
	`rating` real,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movie_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`movie_id` integer NOT NULL,
	`rating` real,
	`watched_at` integer,
	`favorite_slot` integer,
	`review` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_entry_user_movie_unique` ON `movie_entry` (`user_id`,`movie_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_entry_user_favorite_slot_unique` ON `movie_entry` (`user_id`,`favorite_slot`) WHERE "movie_entry"."favorite_slot" is not null;--> statement-breakpoint
CREATE TABLE `movie_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `movie_list_user_idx` ON `movie_list` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_list_user_name_unique` ON `movie_list` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `movie_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`movie_id` integer NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `movie_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_list_item_list_movie_unique` ON `movie_list_item` (`list_id`,`movie_id`);