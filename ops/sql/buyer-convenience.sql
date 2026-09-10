CREATE TABLE IF NOT EXISTS guest_cart_imports (
 site text NOT NULL, user_id uuid NOT NULL, entry_id uuid NOT NULL,
 product_id uuid NOT NULL, option_id uuid, quantity integer NOT NULL CHECK(quantity>0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(site,user_id,entry_id)
);
