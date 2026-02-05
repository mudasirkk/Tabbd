ALTER TABLE "session_items" DROP CONSTRAINT "session_items_menu_item_id_menu_items_id_fk";
--> statement-breakpoint
ALTER TABLE "session_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;