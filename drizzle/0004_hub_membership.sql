CREATE TABLE `hub_memberships` (
	`member_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`display_name` text NOT NULL,
	`goal` text NOT NULL,
	`interests` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`decided_by` text,
	`decision_note` text DEFAULT '' NOT NULL
);

--> statement-breakpoint
-- Preserve accounts already authorised before the hub was introduced.
INSERT OR IGNORE INTO hub_memberships(member_id,status,display_name,goal,interests,created_at,updated_at,decision_note) SELECT id,'active',name,'Compte existant avant le hub','["community","mail","pdf","vault"]',created_at,CAST(strftime('%s','now') AS INTEGER)*1000,'Accès existant conservé' FROM members;
