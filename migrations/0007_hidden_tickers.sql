ALTER TABLE "chart_preferences" ADD COLUMN "hidden_tickers" jsonb DEFAULT '[]'::jsonb NOT NULL;
