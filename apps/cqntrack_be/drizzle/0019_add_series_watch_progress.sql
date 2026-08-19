CREATE TABLE `series_watch_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`series_id` integer NOT NULL,
	`next_episode_season_number` integer NOT NULL,
	`next_episode_number` integer NOT NULL,
	`next_episode_name` text NOT NULL,
	`next_episode_air_date` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `series`(`tmdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `series_watch_progress_user_series_unique` ON `series_watch_progress` (`user_id`,`series_id`);--> statement-breakpoint
CREATE INDEX `series_watch_progress_user_idx` ON `series_watch_progress` (`user_id`);