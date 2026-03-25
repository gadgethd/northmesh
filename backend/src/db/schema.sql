-- NorthMesh Database Schema (TimescaleDB)
-- Based on ukmesh schema

-- Nodes table - Device registry
CREATE TABLE IF NOT EXISTS nodes (
  node_id          TEXT PRIMARY KEY,
  name             TEXT,
  lat              DOUBLE PRECISION,
  lon              DOUBLE PRECISION,
  role             INTEGER,
  last_seen        TIMESTAMPTZ DEFAULT NOW(),
  is_online        BOOLEAN DEFAULT FALSE,
  hardware_model   TEXT,
  firmware_version TEXT,
  public_key       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  advert_count     INTEGER NOT NULL DEFAULT 0,
  elevation_m      DOUBLE PRECISION,
  network          TEXT NOT NULL DEFAULT 'uk/north',
  location_locked  BOOLEAN NOT NULL DEFAULT FALSE,
  last_predicted_online_at  TIMESTAMPTZ,
  last_path_evidence_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes (last_seen);
CREATE INDEX IF NOT EXISTS idx_nodes_is_online ON nodes (is_online);
CREATE INDEX IF NOT EXISTS idx_nodes_network ON nodes (network);

-- Packets hypertable - Time-series packet data
CREATE TABLE IF NOT EXISTS packets (
  time            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  packet_hash     TEXT NOT NULL,
  rx_node_id      TEXT,
  src_node_id     TEXT,
  topic           TEXT NOT NULL,
  packet_type     INTEGER,
  route_type      INTEGER,
  hop_count       INTEGER,
  rssi            DOUBLE PRECISION,
  snr             DOUBLE PRECISION,
  payload         JSONB,
  raw_hex         TEXT,
  advert_count    INTEGER,
  path_hashes     TEXT[],
  path_hash_size_bytes INTEGER,
  network         TEXT NOT NULL DEFAULT 'uk/north'
);

SELECT create_hypertable('packets', 'time');

CREATE INDEX IF NOT EXISTS idx_packets_src_node ON packets (src_node_id);
CREATE INDEX IF NOT EXISTS idx_packets_rx_node ON packets (rx_node_id);
CREATE INDEX IF NOT EXISTS idx_packets_packet_hash ON packets (packet_hash);

-- Node status samples - Telemetry hypertable
CREATE TABLE IF NOT EXISTS node_status_samples (
  time                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  node_id              TEXT NOT NULL,
  network              TEXT NOT NULL DEFAULT 'uk/north',
  battery_mv           INTEGER,
  uptime_secs          BIGINT,
  tx_air_secs          BIGINT,
  rx_air_secs          BIGINT,
  channel_utilization  DOUBLE PRECISION,
  air_util_tx          DOUBLE PRECISION,
  stats                JSONB
);

SELECT create_hypertable('node_status_samples', 'time');

CREATE INDEX IF NOT EXISTS idx_status_samples_node ON node_status_samples (node_id);

-- Node links - Observed RF links between nodes
CREATE TABLE IF NOT EXISTS node_links (
  node_a_id        TEXT NOT NULL,
  node_b_id        TEXT NOT NULL,
  observed_count   INTEGER NOT NULL DEFAULT 1,
  last_observed    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  itm_path_loss_db DOUBLE PRECISION,
  itm_viable       BOOLEAN,
  itm_computed_at  TIMESTAMPTZ,
  count_a_to_b     INTEGER NOT NULL DEFAULT 0,
  count_b_to_a     INTEGER NOT NULL DEFAULT 0,
  force_viable     BOOLEAN NOT NULL DEFAULT FALSE,
  multibyte_observed_count INTEGER NOT NULL DEFAULT 0,
  terrain_profile_json JSONB,
  PRIMARY KEY (node_a_id, node_b_id)
);

CREATE INDEX IF NOT EXISTS idx_links_last_observed ON node_links (last_observed);

-- Node coverage - RF coverage polygons
CREATE TABLE IF NOT EXISTS node_coverage (
  node_id          TEXT PRIMARY KEY,
  geom             JSONB NOT NULL,
  strength_geoms   JSONB,
  antenna_height_m DOUBLE PRECISION DEFAULT 10,
  radius_m         DOUBLE PRECISION DEFAULT 30000,
  model_version    INTEGER NOT NULL DEFAULT 1,
  calculated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Node network sightings - Cross-network visibility
CREATE TABLE IF NOT EXISTS node_network_sightings (
  node_id       TEXT NOT NULL,
  network       TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (node_id, network)
);

-- Worker health snapshots
CREATE TABLE IF NOT EXISTS worker_health_snapshots (
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  worker_name     TEXT NOT NULL,
  status          TEXT NOT NULL,
  queue_depth     INTEGER NOT NULL DEFAULT 0,
  processed_5m    INTEGER NOT NULL DEFAULT 0,
  processed_1h    INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  cpu_load_1m     DOUBLE PRECISION,
  mem_used_pct    DOUBLE PRECISION,
  disk_used_pct   DOUBLE PRECISION
);

SELECT create_hypertable('worker_health_snapshots', 'ts');

-- Continuous aggregates for packet statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS packets_5m
WITH (timescaledb.continuous) AS
SELECT time_bucket('5 minutes', time) AS bucket,
       src_node_id,
       packet_type,
       COUNT(*) as packet_count,
       AVG(rssi) as avg_rssi,
       AVG(snr) as avg_snr
FROM packets
GROUP BY bucket, src_node_id, packet_type;

CREATE MATERIALIZED VIEW IF NOT EXISTS packets_1h
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket,
       src_node_id,
       packet_type,
       COUNT(*) as packet_count,
       AVG(rssi) as avg_rssi,
       AVG(snr) as avg_snr
FROM packets
GROUP BY bucket, src_node_id, packet_type;
