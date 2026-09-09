-- Additive migration: preserve existing route categories and bind product ownership independently.
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS site text;
UPDATE products_shop SET site=CASE WHEN category IN ('산지픽','산지픽 농산물','산지픽 해산물') THEN 'sanjipick' ELSE 'blendpick' END WHERE site IS NULL;
ALTER TABLE products_shop ALTER COLUMN site SET NOT NULL;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS supplier_name text;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS expected_ship_date date;
CREATE INDEX IF NOT EXISTS products_shop_site_idx ON products_shop(site);
CREATE TABLE IF NOT EXISTS product_categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar(100) NOT NULL UNIQUE,sort_order int DEFAULT 0,created_at timestamptz DEFAULT NOW());
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS site text;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES product_categories(id);
UPDATE product_categories SET site=CASE WHEN name IN ('산지픽','산지픽 농산물','산지픽 해산물') THEN 'sanjipick' ELSE 'blendpick' END WHERE site IS NULL;
ALTER TABLE product_categories ALTER COLUMN site SET NOT NULL;
CREATE OR REPLACE FUNCTION guard_product_ownership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
 expected:=CASE WHEN NEW.category IN ('산지픽','산지픽 농산물','산지픽 해산물') THEN 'sanjipick' ELSE 'blendpick' END;
 IF TG_OP='INSERT' THEN NEW.site:=COALESCE(NEW.site,expected);
 ELSE IF NEW.site IS DISTINCT FROM OLD.site THEN RAISE EXCEPTION 'Product site is immutable'; END IF;
 END IF;
 IF NEW.site IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Category cannot move a product to another site'; END IF;
 IF TG_OP='INSERT' OR NEW.category IS DISTINCT FROM OLD.category THEN
   PERFORM id FROM product_categories WHERE name=NEW.category FOR SHARE;
   IF EXISTS(SELECT 1 FROM product_categories WHERE name=NEW.category AND (hidden OR merged_into IS NOT NULL)) THEN RAISE EXCEPTION 'Choose an active category'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS products_shop_ownership_guard ON products_shop;
CREATE TRIGGER products_shop_ownership_guard BEFORE INSERT OR UPDATE OF site,category ON products_shop FOR EACH ROW EXECUTE FUNCTION guard_product_ownership();
CREATE TABLE IF NOT EXISTS admin_dispatch_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site text NOT NULL,request_key uuid NOT NULL,
 order_ids uuid[] NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT NOW(),
 UNIQUE(site,request_key)
);
CREATE TABLE IF NOT EXISTS admin_category_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site text NOT NULL,source_id uuid NOT NULL,target_id uuid,
 action text NOT NULL,affected_products int NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO product_categories(name,site) VALUES ('산지픽 농산물','sanjipick'),('산지픽 해산물','sanjipick') ON CONFLICT(name) DO NOTHING;
