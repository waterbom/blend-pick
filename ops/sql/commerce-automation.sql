CREATE TABLE IF NOT EXISTS shipment_notifications (
 id bigserial PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 site text NOT NULL,
 tracking_number text NOT NULL,
 body text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','retry','review','cancelled')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id)
);
CREATE INDEX IF NOT EXISTS shipment_notifications_due ON shipment_notifications(next_attempt_at) WHERE status IN ('pending','retry');
CREATE TABLE IF NOT EXISTS shipment_tracking_checks (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 tracking_number text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now(),
 failures integer NOT NULL DEFAULT 0,
 error text,
 next_attempt_at timestamptz NOT NULL DEFAULT now()
);

-- Keep automatic and manual lookup outcomes visible after a page refresh.
CREATE TABLE IF NOT EXISTS shipment_tracking_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 site text NOT NULL CHECK(site IN ('blendpick','sanjipick')),
 source text NOT NULL CHECK(source IN ('automatic','manual')),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','success','partial','failed','empty')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 checked integer NOT NULL DEFAULT 0,
 delivered integer NOT NULL DEFAULT 0,
 in_transit integer NOT NULL DEFAULT 0,
 failed integer NOT NULL DEFAULT 0,
 skipped integer NOT NULL DEFAULT 0,
 message text,
 results jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS shipment_tracking_runs_recent ON shipment_tracking_runs(site,started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS shipment_tracking_runs_active ON shipment_tracking_runs(site) WHERE status='running';

-- Response-loss retries reuse this outcome without updating orders or sending SMS again.
CREATE TABLE IF NOT EXISTS admin_shipment_import_batches (
 site text NOT NULL,
 request_key uuid NOT NULL,
 admin_id text NOT NULL,
 input_hash text NOT NULL,
 policy_version integer NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site,request_key)
);
