CREATE TABLE `conversation_participants` (
	`conversation_id` text NOT NULL,
	`member_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_participant` ON `conversation_participants` (`conversation_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `conversation_participant_member` ON `conversation_participants` (`member_id`);--> statement-breakpoint
CREATE TABLE `conversation_views` (
	`conversation_id` text NOT NULL,
	`member_id` text NOT NULL,
	`folder` text DEFAULT 'inbox' NOT NULL,
	`starred` integer DEFAULT 0 NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_view` ON `conversation_views` (`conversation_id`,`member_id`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `kind` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `send_fingerprint` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `kind` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `status` text DEFAULT 'active' NOT NULL;