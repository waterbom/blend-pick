-- JS하우스(연남동) 예약 원장 (예약 신청 + 카드 결제) — 단궁·유탑 예약과 분리해 관리한다.
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
-- 카드 결제(토스) 정보 — 신청 방식 예약은 모두 비어 있다. 이미 만들어진 테이블에도 그대로 덧붙는다.
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS amount integer CHECK(amount IS NULL OR amount>0);
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS payment_key text UNIQUE;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS refund_amount integer CHECK(refund_amount IS NULL OR refund_amount>=0);
ALTER TABLE jshouse_bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
-- 상태: requested(신청) · pending(결제 대기, 15분) · confirming(결제 승인 확인 중) · confirmed(확정)
--       · cancelling(환불 확인 중) · cancelled · declined · expired(결제하지 않고 끝남)
ALTER TABLE jshouse_bookings DROP CONSTRAINT IF EXISTS jshouse_bookings_status_check;
ALTER TABLE jshouse_bookings ADD CONSTRAINT jshouse_bookings_status_check
 CHECK(status IN ('requested','pending','confirming','confirmed','cancelling','cancelled','declined','expired'));
CREATE INDEX IF NOT EXISTS jshouse_bookings_status ON jshouse_bookings(status,check_in);
CREATE INDEX IF NOT EXISTS jshouse_bookings_pending ON jshouse_bookings(expires_at) WHERE status='pending';
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
