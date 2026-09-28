CREATE TABLE "market_data_cache" (
	"ticker" text PRIMARY KEY NOT NULL,
	"bars" jsonb NOT NULL,
	"market_date" text NOT NULL,
	"last_successful_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
