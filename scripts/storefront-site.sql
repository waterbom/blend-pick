SELECT pg_advisory_xact_lock(hashtext('blendpick-storefront-site-migration'));
ALTER TABLE cart ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'blendpick';
CREATE UNIQUE INDEX IF NOT EXISTS cart_site_user_product_option_idx ON cart(site, user_id, product_id, option_id);
CREATE INDEX IF NOT EXISTS cart_site_user_idx ON cart(site, user_id);
DO $$ DECLARE legacy record; BEGIN
  FOR legacy IN SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'cart'::regclass AND c.contype = 'u'
    AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(c.conkey) k(attnum)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
      = ARRAY['option_id','product_id','user_id']::text[]
  LOOP EXECUTE format('ALTER TABLE cart DROP CONSTRAINT %I', legacy.conname); END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS oauth_login_flows (
  state_hash text PRIMARY KEY, site text NOT NULL, return_path text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_login_handoffs (
  code_hash text PRIMARY KEY, state_hash text NOT NULL, site text NOT NULL,
  return_path text NOT NULL, session_token text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_login_flows_expiry_idx ON oauth_login_flows(expires_at);
CREATE INDEX IF NOT EXISTS oauth_login_handoffs_expiry_idx ON oauth_login_handoffs(expires_at);
