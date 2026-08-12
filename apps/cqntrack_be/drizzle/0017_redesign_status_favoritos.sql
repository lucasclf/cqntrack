ALTER TABLE `movie_entry` ADD `status` text;--> statement-breakpoint
ALTER TABLE `movie_entry` ADD `favorited_at` integer;--> statement-breakpoint
DROP INDEX `movie_entry_user_favorite_slot_unique`;--> statement-breakpoint
ALTER TABLE `movie_entry` DROP COLUMN `favorite_slot`;--> statement-breakpoint
CREATE INDEX `movie_entry_user_status_idx` ON `movie_entry` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `game_entry` ADD `favorited_at` integer;--> statement-breakpoint
DROP INDEX `game_entry_user_favorite_slot_unique`;--> statement-breakpoint
ALTER TABLE `game_entry` DROP COLUMN `favorite_slot`;--> statement-breakpoint
ALTER TABLE `series_entry` ADD `favorited_at` integer;--> statement-breakpoint
DROP INDEX `series_entry_user_favorite_slot_unique`;--> statement-breakpoint
ALTER TABLE `series_entry` DROP COLUMN `favorite_slot`;--> statement-breakpoint
ALTER TABLE `book_entry` ADD `favorited_at` integer;--> statement-breakpoint
DROP INDEX `book_entry_user_favorite_slot_unique`;--> statement-breakpoint
ALTER TABLE `book_entry` DROP COLUMN `favorite_slot`;
