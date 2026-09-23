CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`value` integer NOT NULL,
	`minimum` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "item_stock_nonnegative" CHECK("items"."stock" >= 0),
	CONSTRAINT "item_value_nonnegative" CHECK("items"."value" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_items_sku` ON `items` (`sku`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text NOT NULL,
	`contact` text NOT NULL,
	`device` text NOT NULL,
	`service` text NOT NULL,
	`notes` text NOT NULL,
	`date` text NOT NULL,
	`due` text NOT NULL,
	`quote` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "job_version_nonnegative" CHECK("jobs"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE `sale_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`item_id` text,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	`cost` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sale_lines_sale` ON `sale_lines` (`sale_id`);--> statement-breakpoint
CREATE TABLE `stock_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`date` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_sale` ON `payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_date` ON `payments` (`date`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`date` text NOT NULL,
	`customer` text NOT NULL,
	`total` integer NOT NULL,
	`cost` integer NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`notes` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`job_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_payment_bounds" CHECK("sales"."paid" >= 0 AND "sales"."paid" <= "sales"."total"),
	CONSTRAINT "sale_version_nonnegative" CHECK("sales"."version" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_sales_date` ON `sales` (`date`);