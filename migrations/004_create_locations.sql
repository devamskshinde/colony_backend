CREATE TABLE IF NOT EXISTS location_history (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    geohash VARCHAR(12) NOT NULL,
    accuracy FLOAT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create partitions: current month + next 3 months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..3 LOOP
        start_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + '1 month'::INTERVAL;
        partition_name := 'location_history_' || to_char(start_date, 'YYYY_MM');

        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF location_history FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_location_user_recorded ON location_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_geohash ON location_history(geohash);
CREATE INDEX IF NOT EXISTS idx_location_recorded ON location_history(recorded_at DESC);
