CREATE TABLE `book` (
	`google_books_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`authors` text,
	`cover_url` text,
	`published_date` text,
	`description` text,
	`categories` text,
	`page_count` integer,
	`rating` real,
	`cached_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`status` text,
	`rating` real,
	`favorite_slot` integer,
	`review` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`google_books_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_entry_user_book_unique` ON `book_entry` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `book_entry_user_status_idx` ON `book_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_entry_user_favorite_slot_unique` ON `book_entry` (`user_id`,`favorite_slot`) WHERE "book_entry"."favorite_slot" is not null;--> statement-breakpoint
CREATE TABLE `book_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_list_user_idx` ON `book_list` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_list_user_name_unique` ON `book_list` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `book_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`book_id` text NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `book_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`google_books_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_list_item_list_book_unique` ON `book_list_item` (`list_id`,`book_id`);