import { createHmac, randomUUID } from 'node:crypto';
import { analyticsPool, analyticsConfigured } from '@/lib/visit-analytics/db';
import { analyticsRange, sessionExpired, type PageviewInput, type VisitSummary } from '@/lib/visit-analytics/rules';
import type { SiteKey } from '@/lib/sites';

export function visitorHash(site: SiteKey, id: string) {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret || secret.length < 32) throw Error('Analytics key missing');
  return createHmac('sha256', secret).update(site + ':' + id).digest('hex');
}
export async function recordPageview(site: SiteKey, input: PageviewInput, now = new Date()) {
  const hash = visitorHash(site,input.visitorId);
  const client = await analyticsPool().connect();
  try {
    await client.query('BEGIN');
    // 동일 브라우저의 여러 탭에서 세션을 동시에 생성하지 않도록 직렬화.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [site + ':' + hash]);
    const duplicate = await client.query('SELECT 1 FROM analytics_pageviews WHERE site=$1 AND event_id=$2', [site,input.eventId]);
    if (duplicate.rows.length) { await client.query('ROLLBACK'); return 'duplicate'; }
    const rate = await client.query('SELECT COUNT(*)::int AS n FROM analytics_pageviews WHERE site=$1 AND visitor_hash=$2 AND occurred_at >= $3', [site,hash,new Date(now.getTime()-60000)]);
    if (Number(rate.rows[0].n) >= 60) { await client.query('ROLLBACK'); return 'limited'; }
    const old = await client.query('SELECT id,last_seen_at FROM analytics_sessions WHERE site=$1 AND visitor_hash=$2 ORDER BY last_seen_at DESC LIMIT 1', [site,hash]);
    const session = old.rows[0];
    const reuse = session && !sessionExpired(new Date(session.last_seen_at),now);
    const sessionId = reuse ? session.id : randomUUID();
    if (reuse) await client.query('UPDATE analytics_sessions SET last_seen_at=GREATEST(last_seen_at,$3) WHERE site=$1 AND id=$2', [site,sessionId,now]);
    else await client.query('INSERT INTO analytics_sessions(site,id,visitor_hash,started_at,last_seen_at) VALUES($1,$2,$3,$4,$4)', [site,sessionId,hash,now]);
    const inserted = await client.query('INSERT INTO analytics_pageviews(site,event_id,visitor_hash,session_id,page,occurred_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (site,event_id) DO NOTHING RETURNING event_id', [site,input.eventId,hash,sessionId,input.page,now]);
    if (!inserted.rows.length) { await client.query('ROLLBACK'); return 'duplicate'; }
    await client.query('COMMIT'); return 'recorded';
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
export async function getVisitSummary(site: SiteKey, days: number, now = new Date()): Promise<VisitSummary> {
  const {from,to} = analyticsRange(days,now);
  const base: VisitSummary = {site,days,state:'disabled',from:from.toISOString(),to:to.toISOString(),lastEventAt:null,totals:null,pages:[],daily:[]};
  if (process.env.ANALYTICS_ENABLED !== 'true') return base;
  if (!analyticsConfigured()) return {...base,state:'unconfigured'};
  const client = await analyticsPool().connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const params=[site,from,to];
    const totals = await client.query('SELECT COUNT(*)::int AS pageviews,COUNT(DISTINCT visitor_hash)::int AS visitors,COUNT(DISTINCT session_id)::int AS sessions FROM analytics_pageviews WHERE site=$1 AND occurred_at >= $2 AND occurred_at < $3',params);
    const pages = await client.query('SELECT page,COUNT(*)::int AS views FROM analytics_pageviews WHERE site=$1 AND occurred_at >= $2 AND occurred_at < $3 GROUP BY page ORDER BY views DESC,page',params);
    const daily = await client.query("SELECT to_char(occurred_at AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD') AS day,COUNT(*)::int AS pageviews,COUNT(DISTINCT visitor_hash)::int AS visitors,COUNT(DISTINCT session_id)::int AS sessions FROM analytics_pageviews WHERE site=$1 AND occurred_at >= $2 AND occurred_at < $3 GROUP BY day ORDER BY day",params);
    const last = await client.query('SELECT MAX(occurred_at) AS last FROM analytics_pageviews WHERE site=$1',[site]);
    await client.query('COMMIT');
    return {...base,state:totals.rows[0].pageviews?'active':'empty',totals:totals.rows[0],pages:pages.rows,daily:daily.rows,lastEventAt:last.rows[0].last?new Date(last.rows[0].last).toISOString():null};
  } catch(error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
