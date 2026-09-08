-- 방문 원시 기록 90일 보관 기준. 운영 활성화 때 주기 실행 연결 필요. 이번에 실행하지 않음.
BEGIN;
DELETE FROM analytics_pageviews WHERE occurred_at < NOW() - INTERVAL '90 days';
DELETE FROM analytics_sessions s WHERE s.last_seen_at < NOW() - INTERVAL '90 days'
  AND NOT EXISTS (SELECT 1 FROM analytics_pageviews p WHERE p.site=s.site AND p.session_id=s.id);
COMMIT;
