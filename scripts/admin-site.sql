-- Run in a transaction from migrate-order-site.cjs before deploying the new app.
-- Existing history keeps its original IDs and remains assigned to blendpick.
SELECT pg_advisory_xact_lock(hashtext('blendpick-admin-site-migration'));
ALTER TABLE campaign_costs ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'blendpick';
ALTER TABLE influencer_payouts ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'blendpick';
CREATE INDEX IF NOT EXISTS campaign_costs_site_campaign_idx ON campaign_costs(site, campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS influencer_payouts_site_campaign_influencer_idx
  ON influencer_payouts(site, campaign_id, influencer_id);

-- Replace only the legacy two-column uniqueness constraint; preserve primary keys.
DO $$
DECLARE legacy record;
BEGIN
  FOR legacy IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'influencer_payouts'::regclass AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(c.conkey) AS k(attnum)
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
          = ARRAY['campaign_id', 'influencer_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE influencer_payouts DROP CONSTRAINT %I', legacy.conname);
  END LOOP;
END $$;
