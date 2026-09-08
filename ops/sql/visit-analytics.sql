-- 검토용/수동 마이그레이션. 대상은 ANALYTICS_DATABASE_URL의 DB만 해당한다.
BEGIN;
CREATE TABLE IF NOT EXISTS analytics_sessions (
  site text NOT NULL CHECK (site IN ('blendpick','sanjipick')),
  id uuid NOT NULL,
  visitor_hash char(64) NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (site,id)
);
CREATE INDEX IF NOT EXISTS analytics_sessions_visitor_idx ON analytics_sessions(site,visitor_hash,last_seen_at DESC);
CREATE TABLE IF NOT EXISTS analytics_pageviews (
  site text NOT NULL CHECK (site IN ('blendpick','sanjipick')),
  event_id uuid NOT NULL,
  visitor_hash char(64) NOT NULL,
  session_id uuid NOT NULL,
  page text NOT NULL CHECK (page IN ('home','catalog','product','cart','checkout','login','signup','mypage','about','guide','terms','privacy','hotel','campaign','influencer')),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (site,event_id),
  FOREIGN KEY (site,session_id) REFERENCES analytics_sessions(site,id)
);
CREATE INDEX IF NOT EXISTS analytics_pageviews_time_idx ON analytics_pageviews(site,occurred_at);
CREATE INDEX IF NOT EXISTS analytics_pageviews_visitor_idx ON analytics_pageviews(site,visitor_hash,occurred_at);
COMMIT;
