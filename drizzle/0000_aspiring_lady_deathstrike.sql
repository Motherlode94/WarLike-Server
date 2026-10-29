CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`targets` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`decided_by` text,
	`decided_at` integer
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`application_id` text,
	`subject` text NOT NULL,
	`folder` text DEFAULT 'inbox' NOT NULL,
	`starred` integer DEFAULT 0 NOT NULL,
	`manager_read` integer DEFAULT 0 NOT NULL,
	`member_read` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`recipient_id` text,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `grants` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`site` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_site` ON `grants` (`member_id`,`site`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_auth` ON `members` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
