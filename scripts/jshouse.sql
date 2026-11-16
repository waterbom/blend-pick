-- JS하우스(연남동) 예약 신청 원장 — 단궁·유탑 예약과 분리해 관리한다.
-- 재실행해도 기존 설정·예약·날짜 설정을 바꾸지 않는다 (idempotent).
BEGIN;
CREATE TABLE IF NOT EXISTS jshouse_settings (
 id integer PRIMARY KEY CHECK(id=1),
 config jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO jshouse_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
-- 날짜별 예외: 예약 닫기(closed) 또는 그날만의 1박 요금(price). 행이 없으면 기본 설정을 따른다.
CREATE TABLE IF NOT EXISTS jshouse_days (
 day date PRIMARY KEY,
 closed boolean NOT NULL DEFAULT false,
 price integer CHECK(price IS NULL OR (price>0 AND price<=10000000)),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=80)
);
CREATE TABLE IF NOT EXISTS jshouse_bookings (
 id uuid PRIMARY KEY,
 code text NOT NULL UNIQUE,
 request_id uuid NOT NULL,
 owner_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('requested','confirmed','declined','cancelled')),
 check_in date NOT NULL,
 check_out date NOT NULL CHECK(check_out>check_in),
 guests integer NOT NULL CHECK(guests BETWEEN 1 AND 20),
 guest_name text NOT NULL,
 guest_phone text NOT NULL,
 memo text NOT NULL DEFAULT '',
 estimate jsonb NOT NULL DEFAULT '{}'::jsonb,
 admin_note text NOT NULL DEFAULT '',
 cancel_requested boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_hash,request_id)
);
CREATE INDEX IF NOT EXISTS jshouse_bookings_status ON jshouse_bookings(status,check_in);
CREATE INDEX IF NOT EXISTS jshouse_bookings_owner ON jshouse_bookings(owner_hash,status);
-- 하루 한 팀: 날짜가 기본키라 같은 밤을 두 예약이 동시에 잡을 수 없다.
CREATE TABLE IF NOT EXISTS jshouse_nights (
 day date PRIMARY KEY,
 booking_id uuid NOT NULL REFERENCES jshouse_bookings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS jshouse_nights_booking ON jshouse_nights(booking_id);
CREATE TABLE IF NOT EXISTS jshouse_events (
 id bigserial PRIMARY KEY,
 booking_id uuid,
 action text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jshouse_events_booking ON jshouse_events(booking_id,created_at);
CREATE TABLE IF NOT EXISTS jshouse_attempts (
 key_hash text PRIMARY KEY,
 attempts integer NOT NULL,
 resets_at timestamptz NOT NULL
);
COMMIT;
