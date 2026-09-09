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
