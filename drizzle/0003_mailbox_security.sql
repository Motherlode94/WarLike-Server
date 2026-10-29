CREATE TABLE `mailbox_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`credential_version` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mailbox_sessions_expiry` ON `mailbox_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `mailbox_sessions_member` ON `mailbox_sessions` (`member_id`);--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`member_id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`given_name` text NOT NULL,
	`family_name` text NOT NULL,
	`salt` text NOT NULL,
	`verifier` text NOT NULL,
	`iterations` integer NOT NULL,
	`credential_version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailbox_address` ON `mailboxes` (`address`);--> statement-breakpoint
CREATE TABLE `security_nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_nonces_expiry` ON `security_nonces` (`expires_at`);--> statement-breakpoint
CREATE TABLE `security_windows` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_windows_expiry` ON `security_windows` (`expires_at`);