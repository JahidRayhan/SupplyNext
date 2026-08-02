-- SDCIP schema. Idempotent (safe to run on every boot).

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN (
                   'sales_planner','production_manager','warehouse_manager',
                   'logistics_coordinator','executive','admin'
                 )),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  sku             TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  unit_cost       NUMERIC NOT NULL,
  lead_time_days  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id    TEXT PRIMARY KEY,
  type  TEXT NOT NULL CHECK (type IN ('factory','warehouse','in_transit')),
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS retail_partners (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_records (
  id                  TEXT PRIMARY KEY,
  sku                 TEXT NOT NULL REFERENCES products(sku),
  retail_partner_id   TEXT NOT NULL REFERENCES retail_partners(id),
  quantity_sold       INTEGER NOT NULL,
  sale_date           DATE NOT NULL,
  region              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON sales_records (sku, sale_date);

CREATE TABLE IF NOT EXISTS inventory_records (
  sku              TEXT NOT NULL REFERENCES products(sku),
  location_id      TEXT NOT NULL REFERENCES locations(id),
  quantity_on_hand INTEGER NOT NULL,
  reorder_point    INTEGER NOT NULL DEFAULT 0,
  safety_stock     INTEGER NOT NULL DEFAULT 0,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sku, location_id)
);

CREATE TABLE IF NOT EXISTS forecast_overrides (
  id                    SERIAL PRIMARY KEY,
  sku                   TEXT NOT NULL REFERENCES products(sku),
  period_start          DATE NOT NULL,
  overridden_quantity   INTEGER NOT NULL,
  reason                TEXT NOT NULL,
  overridden_by         TEXT NOT NULL REFERENCES users(id),
  overridden_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_audit_trail (
  id            SERIAL PRIMARY KEY,
  sku           TEXT NOT NULL REFERENCES products(sku),
  location_id   TEXT NOT NULL REFERENCES locations(id),
  delta         INTEGER NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Release 2: logistics + IoT
CREATE TABLE IF NOT EXISTS shipments (
  id                              TEXT PRIMARY KEY,
  sku                             TEXT NOT NULL REFERENCES products(sku),
  quantity                        INTEGER NOT NULL,
  origin_location_id              TEXT NOT NULL REFERENCES locations(id),
  destination_retail_partner_id   TEXT NOT NULL REFERENCES retail_partners(id),
  status                          TEXT NOT NULL CHECK (status IN ('pending','in_transit','delivered','delayed')),
  expected_delivery               DATE NOT NULL,
  actual_delivery                 DATE,
  created_by                      TEXT REFERENCES users(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iot_sensor_events (
  id            SERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('rfid_scan','gps_ping','temperature','humidity')),
  sku           TEXT REFERENCES products(sku),
  shipment_id   TEXT REFERENCES shipments(id),
  value         NUMERIC,
  latitude      NUMERIC,
  longitude     NUMERIC,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced        BOOLEAN NOT NULL DEFAULT true,
  recorded_by   TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_iot_shipment ON iot_sensor_events (shipment_id, ts);
