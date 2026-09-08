-- Run in the existing deployment transaction. Old undated links fail closed until configured.
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS link_start_at timestamptz;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS link_end_at timestamptz;
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS link_price integer CHECK (link_price >= 0);
CREATE TABLE IF NOT EXISTS product_secret_links (
  code text PRIMARY KEY,
  product_id uuid REFERENCES products_shop(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, starts_at, ends_at)
);
-- Channel derives only from the immutable code saved by the payment verifier, never from a referrer.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_channel text GENERATED ALWAYS AS
  (CASE WHEN link_code IS NOT NULL THEN 'non_display' ELSE 'display' END) STORED;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS link_start_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS link_end_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount_unresolved boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS order_refund_amounts (
  source_key text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id),
  amount integer NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_refund_amounts_order_idx ON order_refund_amounts(order_id);
CREATE INDEX IF NOT EXISTS orders_channel_paid_idx ON orders(site, sales_channel, paid_at);
