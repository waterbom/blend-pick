-- Additive, repeatable migration. Customer records are scoped to the storefront.
CREATE TABLE IF NOT EXISTS commerce_feature_state (
 key text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO commerce_feature_state(key) VALUES ('customer-notifications') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_interests (
 id uuid PRIMARY KEY, site text NOT NULL CHECK(site IN ('blendpick','sanjipick')),
 user_id text NOT NULL, product_id uuid NOT NULL REFERENCES products_shop(id) ON DELETE CASCADE,
 option_id text NOT NULL DEFAULT '', kind text NOT NULL CHECK(kind IN ('wish','restock','opening')),
 phone text, consent_at timestamptz, consent_version text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','notified','cancelled','expired')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+INTERVAL '90 days',
 UNIQUE(site,user_id,product_id,option_id,kind)
);
CREATE INDEX IF NOT EXISTS customer_interests_owner ON customer_interests(site,user_id);

CREATE TABLE IF NOT EXISTS customer_notifications (
 id uuid PRIMARY KEY, site text NOT NULL CHECK(site IN ('blendpick','sanjipick')),
 event_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('paid','refund','delay','restock','opening','answer')),
 user_id text, order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
 interest_id uuid REFERENCES customer_interests(id) ON DELETE SET NULL,
 phone text, title text NOT NULL, body text NOT NULL, href text NOT NULL,
 variables jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','delivered','review','blocked','cancelled','site_only')),
 provider_id text, last_error text, attempts integer NOT NULL DEFAULT 0,
 read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(site,event_key)
);
CREATE INDEX IF NOT EXISTS customer_notifications_owner ON customer_notifications(site,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS customer_notifications_queue ON customer_notifications(status,created_at);

CREATE TABLE IF NOT EXISTS customer_questions (
 id uuid PRIMARY KEY, site text NOT NULL CHECK(site IN ('blendpick','sanjipick')),
 user_id text, guest_hash text,
 product_id uuid REFERENCES products_shop(id) ON DELETE SET NULL,
 order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
 request_key uuid NOT NULL, category text NOT NULL, message text NOT NULL,
 public_requested boolean NOT NULL DEFAULT false, is_public boolean NOT NULL DEFAULT false,
 reply text, replied_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(user_id IS NOT NULL OR guest_hash IS NOT NULL),
 UNIQUE(site,request_key)
);
CREATE INDEX IF NOT EXISTS customer_questions_owner ON customer_questions(site,user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS customer_addresses (
 id uuid PRIMARY KEY, site text NOT NULL CHECK(site IN ('blendpick','sanjipick')),
 user_id text NOT NULL, label text NOT NULL, recipient text NOT NULL, phone text NOT NULL,
 zipcode text NOT NULL, address text NOT NULL, detail text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(site,user_id,label)
);

CREATE TABLE IF NOT EXISTS product_customer_info (
 product_id uuid PRIMARY KEY REFERENCES products_shop(id) ON DELETE CASCADE,
 producer text NOT NULL DEFAULT '', storage text NOT NULL DEFAULT '', shelf_life text NOT NULL DEFAULT '',
 allergens text NOT NULL DEFAULT '', quality_policy text NOT NULL DEFAULT '', return_fee text NOT NULL DEFAULT '',
 certification_number text NOT NULL DEFAULT '', certification_scope text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_shipping_promises (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 expected_date date NOT NULL, reason text NOT NULL, revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS review_replies (
 review_id uuid PRIMARY KEY REFERENCES reviews(id) ON DELETE CASCADE,
 reply text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_reorder_requests (
 site text NOT NULL,user_id text NOT NULL,request_key uuid NOT NULL,order_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(site,user_id,request_key)
);
