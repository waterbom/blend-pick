import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { verifyToken, verifyAdminToken } from '@/lib/auth';
import { verifiedPhoneOf } from '@/lib/phone-verify';
import { currentSite } from '@/lib/site-server';
import { currentAdminSite } from '@/lib/admin-site';
import { ApiError } from '@/lib/api-errors';
import pool from '@/lib/db';
import shopPool from '@/lib/db-shop';
import { SITES, type SiteKey } from '@/lib/sites';

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function inputText(value: unknown, max: number, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new ApiError('INVALID_INPUT');
  return value.trim();
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) throw new ApiError('FORBIDDEN');
  if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError('FORBIDDEN');
}
export async function customerAccess(memberRequired = true) {
  const store = await cookies();
  const token = store.get('shop_token')?.value;
  const user = token ? await verifyToken(token) : null;
  // Reject withdrawn/disabled accounts even while an old session cookie exists.
  let id: string | null = null;
  if (user?.id) {
    const found = await pool.query('SELECT id FROM shop_users WHERE id::text=$1 AND is_active IS DISTINCT FROM false', [String(user.id)]);
    id = found.rows[0] ? String(user.id) : null;
  }
  const phone = await verifiedPhoneOf(store.get('phone_verified')?.value);
  if (!id && (memberRequired || !phone)) throw new ApiError('AUTH_REQUIRED');
  const secret = process.env.JWT_SECRET;
  if (!id && !secret) throw new ApiError('UPSTREAM_UNAVAILABLE');
  return { id, phone, guestHash: phone && secret ? createHmac('sha256', secret).update('support:'+phone).digest('hex') : null,
    site: (await currentSite()).key };
}
export async function adminAccess(req?: Request) {
  if (req) sameOrigin(req);
  const token = (await cookies()).get('admin_token')?.value;
  if (!token || !await verifyAdminToken(token)) throw new ApiError('AUTH_REQUIRED');
  return (await currentAdminSite()).key;
}
export async function publicProduct(id: unknown, site: SiteKey) {
  if (!isUuid(id)) throw new ApiError('INVALID_INPUT');
  const result = await shopPool.query(`SELECT id,name,status,stock,is_visible,sale_start_at,sale_end_at,category
    FROM products_shop WHERE id=$1 AND is_visible=true AND status IN ('active','soldout') AND to_jsonb(products_shop)->>'archived_at' IS NULL
    AND CASE WHEN $2='sanjipick' THEN category=ANY($3::text[]) ELSE NOT COALESCE(category=ANY($3::text[]),false) END`, [id,site,SITES.sanjipick.categories]);
  if (!result.rows[0]) throw new ApiError('NOT_FOUND');
  return result.rows[0];
}
export async function ownedOrder(id: unknown, access: Awaited<ReturnType<typeof customerAccess>>) {
  if (!isUuid(id)) throw new ApiError('INVALID_INPUT');
  const result = await shopPool.query(`SELECT id,order_number,status FROM orders WHERE id=$1 AND site=$2
    AND (user_id::text=$3 OR (user_id IS NULL AND $4::text IS NOT NULL AND regexp_replace(buyer_phone,'[^0-9]','','g')=$4))`,
    [id,access.site,access.id,access.phone]);
  if (!result.rows[0]) throw new ApiError('NOT_FOUND');
  return result.rows[0];
}
