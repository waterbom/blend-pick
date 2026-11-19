-- LIMEN(리멘 · 연남동) 예약 원장 (예약 신청 + 카드 결제) — 단궁·유탑 예약과 분리해 관리한다.
-- 테이블 이름의 jshouse 는 브랜드명 확정 전 작업명이다. 운영 데이터를 그대로 두려고 바꾸지 않았다.
-- 재실행해도 기존 설정·예약·날짜 설정을 바꾸지 않는다 (idempotent). 이전 버전의 테이블에는 아래 ALTER 가 그대로 덧붙는다.
BEGIN;
CREATE TABLE IF NOT EXISTS jshouse_settings (
 id integer PRIMARY KEY CHECK(id=1),
 config jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO jshouse_settings(id) VALUES(1) ON CONFLICT DO NOTHING;

-- 객실(room): one = 원룸(2인) · two = 투룸(4인). 서로 다른 공간이라 날짜를 따로 잡는다.
-- 날짜별 설정: 예약 닫기(closed) · 시즌(season: shoulder 준성수기 / peak 극성수기) · 그날만의 1박 요금(price).
-- 행이 없으면 요금표의 요일 요금(주중·금·토)을 따른다.
CREATE TABLE IF NOT EXISTS jshouse_days (
 room text NOT NULL DEFAULT 'two',
 day date NOT NULL,
 closed boolean NOT NULL DEFAULT false,
 price integer CHECK(price IS NULL OR (price>0 AND price<=10000000)),
 season text NOT NULL DEFAULT '',
 note text NOT NULL DEFAULT '' CHECK(length(note)<=80)
);
CREATE TABLE IF NOT EXISTS jshouse_bookings (
 id uuid PRIMARY KEY,
 code text NOT NULL UNIQUE,
 request_id uuid NOT NULL,
 owner_hash text NOT NULL,
 status text NOT NULL,
 room text NOT NULL DEFAULT 'two',
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
-- 같은 객실의 같은 밤은 한 예약만 잡을 수 있다 (아래 유일 인덱스).
CREATE TABLE IF NOT EXISTS jshouse_nights (
 room text NOT NULL DEFAULT 'two',
 day date NOT NULL,
 booking_id uuid NOT NULL REFERENCES jshouse_bookings(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS jshouse_events (
 id bigserial PRIMARY KEY,
 booking_id uuid,
 action text NOT NULL,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jshouse_attempts (
 key_hash text PRIMARY KEY,
 attempts integer NOT NULL,
 resets_at timestamptz NOT NULL
);

-- ── 이전 버전에서 올라오는 경우 ─────────────────────────────────
-- 카드 결제(토스) 정보 — 신청 방식 예약은 모두 비어 있다.
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS amount integer CHECK(amount IS NULL OR amount>0);
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS payment_key text UNIQUE;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS refund_amount integer CHECK(refund_amount IS NULL OR refund_amount>=0);
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
-- 객실이 하나이던 때의 예약·날짜 설정은 모두 투룸(two)으로 본다 (그때 소개한 공간이 침실 둘·4인 기준이었다).
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT 'two';
ALTER TABLE jshouse_nights ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT 'two';
ALTER TABLE jshouse_days ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT 'two';
ALTER TABLE jshouse_days ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '';
-- 날짜 하나가 기본키이던 것을 (객실, 날짜)로 바꾼다.
ALTER TABLE jshouse_nights DROP CONSTRAINT IF EXISTS jshouse_nights_pkey;
ALTER TABLE jshouse_days DROP CONSTRAINT IF EXISTS jshouse_days_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS jshouse_nights_room_day ON jshouse_nights(room,day);
CREATE UNIQUE INDEX IF NOT EXISTS jshouse_days_room_day ON jshouse_days(room,day);

-- 허용 값 (다시 실행해도 같은 결과가 되도록 지우고 다시 건다)
-- 상태: requested(신청) · pending(결제 대기, 15분) · confirming(결제 승인 확인 중) · confirmed(확정)
--       · cancelling(환불 확인 중) · cancelled · declined · expired(결제하지 않고 끝남)
ALTER TABLE jshouse_bookings DROP CONSTRAINT IF EXISTS jshouse_bookings_status_check;
ALTER TABLE jshouse_bookings ADD CONSTRAINT jshouse_bookings_status_check
 CHECK(status IN ('requested','pending','confirming','confirmed','cancelling','cancelled','declined','expired'));
ALTER TABLE jshouse_bookings DROP CONSTRAINT IF EXISTS jshouse_bookings_room_check;
ALTER TABLE jshouse_bookings ADD CONSTRAINT jshouse_bookings_room_check CHECK(room IN ('one','two'));
ALTER TABLE jshouse_nights DROP CONSTRAINT IF EXISTS jshouse_nights_room_check;
ALTER TABLE jshouse_nights ADD CONSTRAINT jshouse_nights_room_check CHECK(room IN ('one','two'));
ALTER TABLE jshouse_days DROP CONSTRAINT IF EXISTS jshouse_days_room_check;
ALTER TABLE jshouse_days ADD CONSTRAINT jshouse_days_room_check CHECK(room IN ('one','two'));
ALTER TABLE jshouse_days DROP CONSTRAINT IF EXISTS jshouse_days_season_check;
ALTER TABLE jshouse_days ADD CONSTRAINT jshouse_days_season_check CHECK(season IN ('','shoulder','peak'));

CREATE INDEX IF NOT EXISTS jshouse_bookings_status ON jshouse_bookings(status,check_in);
CREATE INDEX IF NOT EXISTS jshouse_bookings_pending ON jshouse_bookings(expires_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS jshouse_bookings_owner ON jshouse_bookings(owner_hash,status);
CREATE INDEX IF NOT EXISTS jshouse_nights_booking ON jshouse_nights(booking_id);
CREATE INDEX IF NOT EXISTS jshouse_events_booking ON jshouse_events(booking_id,created_at);
COMMIT;
