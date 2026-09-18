import { sql } from "../lib/db";

export async function ensureSchemaCompatibility() {
  await sql.unsafe(`
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS stock_data_source TEXT NOT NULL DEFAULT 'simulated';
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS stock_data_config JSONB;
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS allow_user_influence BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS password TEXT;
    ALTER TABLE competitions ADD COLUMN IF NOT EXISTS join_code TEXT;

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS competition_id UUID;

    ALTER TABLE orders ALTER COLUMN ticker TYPE TEXT;
    ALTER TABLE holdings ALTER COLUMN ticker TYPE TEXT;
    ALTER TABLE competition_holdings ALTER COLUMN ticker TYPE TEXT;
  `);

  const tickerColumn = await sql<{ dataType: string }[]>`
    SELECT data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'price_ticks'
      AND column_name = 'ticker'
  `;

  const tickerType = tickerColumn[0]?.dataType?.toLowerCase();
  if (tickerType && tickerType !== "text") {
    // This must NOT run in an explicit transaction because Timescale continuous
    // aggregate creation fails inside transaction blocks.
    await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS ohlc_1m;`);
    await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS ohlc_5m;`);

    await sql.unsafe(`
      ALTER TABLE price_ticks
      ALTER COLUMN ticker TYPE TEXT;
    `);

    await sql.unsafe(`
      CREATE MATERIALIZED VIEW ohlc_1m
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 minute', time) AS bucket,
        ticker,
        first(price, time) AS open,
        max(price) AS high,
        min(price) AS low,
        last(price, time) AS close,
        sum(volume) AS volume
      FROM price_ticks
      GROUP BY bucket, ticker;
    `);

    await sql.unsafe(`
      CREATE MATERIALIZED VIEW ohlc_5m
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('5 minute', time) AS bucket,
        ticker,
        first(price, time) AS open,
        max(price) AS high,
        min(price) AS low,
        last(price, time) AS close,
        sum(volume) AS volume
      FROM price_ticks
      GROUP BY bucket, ticker;
    `);
  }

  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'competitions_join_code_unique'
      ) THEN
        CREATE UNIQUE INDEX competitions_join_code_unique
        ON competitions(join_code)
        WHERE join_code IS NOT NULL;
      END IF;
    END $$;
  `);
}