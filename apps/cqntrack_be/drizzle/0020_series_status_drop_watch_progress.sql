DROP TABLE `series_watch_progress`;--> statement-breakpoint
ALTER TABLE `series` ADD `status` text;--> statement-breakpoint
ALTER TABLE `series` ADD `in_production` integer;