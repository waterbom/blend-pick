-- Additive migration only. Historical rates/tax values are not guessed from today's product.
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE product_addons ADD COLUMN IF NOT EXISTS supply_price integer CHECK (supply_price >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_ref uuid;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_rate numeric;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tax_type text;
UPDATE order_items SET product_ref=product_id WHERE product_ref IS NULL AND product_id IS NOT NULL;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS fee_estimated boolean NOT NULL DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_checked_at timestamptz;
CREATE TABLE IF NOT EXISTS payment_attempts (
 payment_key text PRIMARY KEY, provider_order_id text NOT NULL UNIQUE, site text NOT NULL,
 request_hash text NOT NULL, amount integer NOT NULL CHECK(amount>0),
 snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'prepared',
 lease_until timestamptz, order_id uuid REFERENCES orders(id), last_error text,
 created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_attempts_recovery_idx ON payment_attempts(site,status,updated_at);
-- Serialize product-code allocation in application transactions without renumbering existing products.

ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS rejection_code text;
CREATE TABLE IF NOT EXISTS refund_operations (
 source_key text PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id),
 amount integer NOT NULL CHECK(amount>=0), baseline integer NOT NULL CHECK(baseline>=0),
 reason text NOT NULL, payment_key text, total integer NOT NULL,
 idempotency_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'prepared', actual_amount integer,
 lease_until timestamptz, first_sent_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS refund_operations_pending_order ON refund_operations(order_id)
 WHERE status NOT IN ('completed','rejected');
-- Any committed sale/refund change advances the version used when marking a payout paid.
CREATE TABLE IF NOT EXISTS finance_revisions(site text PRIMARY KEY, version bigint NOT NULL DEFAULT 0);
INSERT INTO finance_revisions(site) VALUES('blendpick'),('sanjipick') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION bump_finance_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_site text; new_site text;
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF TG_OP<>'INSERT' THEN old_site:=OLD.site; END IF;
  IF TG_OP<>'DELETE' THEN new_site:=NEW.site; END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN SELECT site INTO old_site FROM orders WHERE id=OLD.order_id; END IF;
  IF TG_OP<>'DELETE' THEN SELECT site INTO new_site FROM orders WHERE id=NEW.order_id; END IF;
 END IF;
 UPDATE finance_revisions SET version=version+1 WHERE site IN (old_site,new_site);
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS finance_orders_changed ON orders;
CREATE TRIGGER finance_orders_changed AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION bump_finance_revision();
DROP TRIGGER IF EXISTS finance_items_changed ON order_items;
CREATE TRIGGER finance_items_changed AFTER INSERT OR UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION bump_finance_revision();
DROP TRIGGER IF EXISTS finance_refunds_changed ON order_refund_amounts;
CREATE TRIGGER finance_refunds_changed AFTER INSERT OR UPDATE OR DELETE ON order_refund_amounts FOR EACH ROW EXECUTE FUNCTION bump_finance_revision();
DROP TRIGGER IF EXISTS finance_refund_operations_changed ON refund_operations;
CREATE TRIGGER finance_refund_operations_changed AFTER INSERT OR UPDATE OR DELETE ON refund_operations FOR EACH ROW EXECUTE FUNCTION bump_finance_revision();

ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS provider_method text;

-- Removed options retain their historical identity; paused options stay editable.
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Applies to individual, bulk and scheduled shipment writes alike. The UPDATE holds
-- the order row lock also used when creating a refund intent.
CREATE OR REPLACE FUNCTION guard_refund_fulfillment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ((NEW.status IN ('paid','confirmed','preparing','shipped','delivered') AND NEW.status IS DISTINCT FROM OLD.status)
     OR NEW.tracking_company IS DISTINCT FROM OLD.tracking_company
     OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number)
    AND EXISTS(SELECT 1 FROM refund_operations WHERE order_id=NEW.id AND status NOT IN ('completed','rejected')) THEN
   RAISE EXCEPTION USING ERRCODE='P2001', MESSAGE='환불 처리 중인 주문은 발송·배송 상태와 송장을 변경할 수 없습니다.';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_refund_fulfillment_guard ON orders;
CREATE TRIGGER orders_refund_fulfillment_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION guard_refund_fulfillment();
