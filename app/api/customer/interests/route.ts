import {randomUUID} from 'node:crypto';
import {ApiError,readJsonObject,rollbackSafely,withApiErrors} from '@/lib/api-errors';
import {customerAccess,isUuid,publicProduct,sameOrigin} from '@/lib/customer-access';
import shopPool from '@/lib/db-shop';
import {configuration} from '@/lib/commerce-provider.cjs';

export const GET=withApiErrors('GET /api/customer/interests',async()=>{
  const a=await customerAccess();
  const rows=await shopPool.query(`SELECT s.id,s.product_id,s.option_id,s.kind,s.status,s.expires_at,s.phone IS NOT NULL AS phone_notice,p.name,p.main_image,
    (p.is_visible=true AND p.status IN ('active','soldout')) AS available,
    CASE WHEN po.removed_at IS NULL THEN po.value END AS option_label
    FROM customer_interests s LEFT JOIN products_shop p ON p.id=s.product_id LEFT JOIN product_options po ON po.id::text=s.option_id
    WHERE s.site=$1 AND s.user_id=$2 AND s.status<>'cancelled' ORDER BY s.created_at DESC LIMIT 200`,[a.site,a.id]);
  return Response.json({items:rows.rows,channels:configuration(a.site)},{headers:{'Cache-Control':'no-store'}});
});
export const POST=withApiErrors('POST /api/customer/interests',async(req:Request)=>{
  sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);
  if(!['wish','restock','opening'].includes(b.kind)|| (b.option_id && !isUuid(b.option_id))) throw new ApiError('INVALID_INPUT');
  const p=await publicProduct(b.product_id,a.site);
  if(b.kind!=='wish' && b.consent!==true) throw new ApiError('INVALID_INPUT','알림 신청 안내에 동의해주세요.');
  if(b.phone_notice===true && (!a.phone || !configuration(a.site)[b.kind])) throw new ApiError('INVALID_INPUT','휴대폰 인증 또는 알림 채널 설정을 확인해주세요.');
  const options=await shopPool.query('SELECT id,stock,is_active FROM product_options WHERE product_id=$1 AND removed_at IS NULL',[p.id]);
  const option=options.rows.find(o=>o.id===b.option_id);
  if(b.option_id && (!option||!option.is_active)) throw new ApiError('INVALID_INPUT','현재 제공하는 옵션을 선택해주세요.');
  const opening=p.sale_start_at && new Date(p.sale_start_at).getTime()>Date.now();
  if(b.kind==='opening' && !opening) throw new ApiError('STATE_CONFLICT','현재 오픈 예정인 상품이 아닙니다.');
  if(b.kind==='restock' && p.status==='active' && p.stock!==0 && (option ? option.stock!==0 : options.rows.length===0 || options.rows.some(o=>o.is_active && o.stock!==0))) throw new ApiError('STATE_CONFLICT','현재 구매 가능한 상품입니다. 상품 화면을 확인해주세요.');
  const db=await shopPool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`interests:${a.site}:${a.id}`]);
    const count=await db.query("SELECT count(*)::int n FROM customer_interests WHERE site=$1 AND user_id=$2 AND status='active'",[a.site,a.id]);
    if(count.rows[0].n>=100) throw new ApiError('INVALID_INPUT','관심 상품은 최대 100개까지 저장할 수 있습니다.');
    const r=await db.query(`INSERT INTO customer_interests(id,site,user_id,product_id,option_id,kind,phone,consent_at,consent_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $6='wish' THEN NULL ELSE now() END,$8)
      ON CONFLICT(site,user_id,product_id,option_id,kind) DO UPDATE SET status='active',phone=EXCLUDED.phone,
      consent_at=EXCLUDED.consent_at,consent_version=EXCLUDED.consent_version,created_at=now(),updated_at=now(),expires_at=now()+INTERVAL '90 days'
      WHERE customer_interests.status IN ('cancelled','expired','notified') RETURNING id`,
      [randomUUID(),a.site,a.id,p.id,b.option_id||'',b.kind,b.phone_notice===true?a.phone:null,b.kind==='wish'?null:'requested-stock-v1']);
    await db.query('COMMIT');return Response.json({ok:true,id:r.rows[0]?.id});
  }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
export const DELETE=withApiErrors('DELETE /api/customer/interests',async(req:Request)=>{
  sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);if(!isUuid(b.id))throw new ApiError('INVALID_INPUT');
  const db=await shopPool.connect();
  try{
    await db.query('BEGIN');
    const r=await db.query("UPDATE customer_interests SET status='cancelled',phone=NULL,updated_at=now() WHERE id=$1 AND site=$2 AND user_id=$3 RETURNING id",[b.id,a.site,a.id]);
    if(!r.rowCount)throw new ApiError('NOT_FOUND');
    await db.query("UPDATE customer_notifications SET status='cancelled',phone=NULL WHERE interest_id=$1 AND site=$2 AND status IN ('pending','blocked')",[b.id,a.site]);
    await db.query('COMMIT');return Response.json({ok:true});
  }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
