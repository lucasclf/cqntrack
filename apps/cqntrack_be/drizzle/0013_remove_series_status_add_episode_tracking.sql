CREATE TABLE `series_episode_watch` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` integer NOT NULL,
	`season_number` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`watched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_episode_watch_user_series_episode_unique` ON `series_episode_watch` (`user_id`,`series_id`,`season_number`,`episode_number`);--> statement-breakpoint
CREATE INDEX `series_episode_watch_user_series_idx` ON `series_episode_watch` (`user_id`,`series_id`);--> statement-breakpoint
DROP INDEX `series_entry_user_status_idx`;--> statement-breakpoint
ALTER TABLE `series_entry` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `series_entry` DROP COLUMN `current_season`;--> statement-breakpoint
ALTER TABLE `series_entry` DROP COLUMN `current_episode`;--> statement-breakpoint
ALTER TABLE `series` ADD `seasons` text;