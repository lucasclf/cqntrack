CREATE TABLE `manga` (
	`mangadex_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`cover_url` text,
	`description` text,
	`authors` text,
	`tags` text,
	`publication_status` text,
	`content_rating` text,
	`year` integer,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `manga_chapter_read` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`volume_number` integer NOT NULL,
	`chapter_number` real NOT NULL,
	`read_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`mangadex_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_chapter_read_user_manga_chapter_unique` ON `manga_chapter_read` (`user_id`,`manga_id`,`volume_number`,`chapter_number`);--> statement-breakpoint
CREATE INDEX `manga_chapter_read_user_manga_idx` ON `manga_chapter_read` (`user_id`,`manga_id`);--> statement-breakpoint
CREATE TABLE `manga_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`status` text,
	`rating` real,
	`favorited_at` integer,
	`review` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`mangadex_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_entry_user_manga_unique` ON `manga_entry` (`user_id`,`manga_id`);--> statement-breakpoint
CREATE INDEX `manga_entry_user_status_idx` ON `manga_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `manga_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `manga_list_user_idx` ON `manga_list` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `manga_list_user_name_unique` ON `manga_list` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `manga_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`manga_id` text NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `manga_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manga_id`) REFERENCES `manga`(`mangadex_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manga_list_item_list_manga_unique` ON `manga_list_item` (`list_id`,`manga_id`);