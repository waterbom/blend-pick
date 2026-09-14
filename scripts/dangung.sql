BEGIN;
CREATE TABLE IF NOT EXISTS dangung_settings (
 id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 1,
 config jsonb NOT NULL DEFAULT '{"enabled":false,"extraGuestFee":null,"extraGuestUnit":"","bbqFee":null,"depositAmount":null,"depositTerms":"","refundTerms":"","minLeadDays":1,"maxNights":7}'::jsonb
);
INSERT INTO dangung_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dangung_dates (
 day date PRIMARY KEY, price integer NOT NULL CHECK(price>0 AND price<=10000000),
 season text NOT NULL CHECK(length(season) BETWEEN 1 AND 40), available boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS dangung_reservations (
 id uuid PRIMARY KEY, request_id uuid NOT NULL, owner_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','confirming','paid','expired','cancelled','cancelling')),
 check_in date NOT NULL, check_out date NOT NULL CHECK(check_out>check_in),
 guests integer NOT NULL CHECK(guests BETWEEN 1 AND 16), buyer_name text NOT NULL,
 buyer_phone text NOT NULL, memo text NOT NULL DEFAULT '', quote jsonb NOT NULL,
 amount integer NOT NULL CHECK(amount>0), payment_key text UNIQUE, receipt_url text,
 refund_amount integer, cancel_reason text, cancel_requested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 paid_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_hash,request_id)
);
CREATE TABLE IF NOT EXISTS dangung_occupancy (
 day date PRIMARY KEY REFERENCES dangung_dates(day),
 reservation_id uuid NOT NULL REFERENCES dangung_reservations(id)
);
CREATE INDEX IF NOT EXISTS dangung_occupancy_reservation ON dangung_occupancy(reservation_id);
CREATE INDEX IF NOT EXISTS dangung_reservation_status ON dangung_reservations(status,expires_at);
CREATE TABLE IF NOT EXISTS dangung_audit (
 id bigserial PRIMARY KEY, action text NOT NULL, reservation_id uuid,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
