CREATE TABLE "chart_lines" (
	"user_id" text NOT NULL,
	"chart_key" text NOT NULL,
	"lines" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chart_lines_user_id_chart_key_pk" PRIMARY KEY("user_id","chart_key")
);
--> statement-breakpoint
ALTER TABLE "chart_lines" ADD CONSTRAINT "chart_lines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;