CREATE TABLE "chart_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ticker_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chart_preferences" ADD CONSTRAINT "chart_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
