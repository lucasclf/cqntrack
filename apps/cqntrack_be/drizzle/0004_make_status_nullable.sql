PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`status` text,
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
INSERT INTO `__new_game_entry`("id", "user_id", "game_id", "status", "rating", "favorite", "platform", "review", "created_at", "updated_at") SELECT "id", "user_id", "game_id", "status", "rating", "favorite", "platform", "review", "created_at", "updated_at" FROM `game_entry`;--> statement-breakpoint
DROP TABLE `game_entry`;--> statement-breakpoint
ALTER TABLE `__new_game_entry` RENAME TO `game_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `game_entry_user_game_unique` ON `game_entry` (`user_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_entry_user_status_idx` ON `game_entry` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `game_entry_user_favorite_idx` ON `game_entry` (`user_id`,`favorite`);