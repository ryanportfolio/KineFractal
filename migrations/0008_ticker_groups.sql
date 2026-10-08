ALTER TABLE "chart_preferences" ADD COLUMN IF NOT EXISTS "ticker_groups" jsonb DEFAULT '[]'::jsonb NOT NULL;
