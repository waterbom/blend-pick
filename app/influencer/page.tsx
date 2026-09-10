import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import { verifyToken } from "@/lib/auth";
import { currentSite } from "@/lib/site-server";
import { SITES } from "@/lib/sites";
import { influencerFinance } from "@/lib/influencer-finance";
import { validDateRange } from "@/lib/order-finance";
import { storefrontSale } from "@/lib/storefront-sale";
import { BUSINESS_TYPE_LABEL } from "@/lib/settlement";
import Header from "@/components/Header";
import CopyLinkButton from "@/components/CopyLinkButton";
import FirstBuyersClient from "@/components/FirstBuyersClient";
export const metadata = { title: "인플루언서 활동", robots: { index:false, follow:false } };
const won=(n:number|null|undefined)=>n==null?"확인 필요":Number(n).toLocaleString("ko-KR")+"원";
export default async function InfluencerPage({searchParams=Promise.resolve({})}:{searchParams?:Promise<{from?:string;to?:string}>}) {
 const site=await currentSite();
 const token=(await cookies()).get("shop_token")?.value;
 const payload=token?await verifyToken(token):null;
 if(!payload)redirect("/login?redirect=%2Finfluencer");
 const {rows:users}=await pool.query("SELECT id,role FROM shop_users WHERE id=$1 AND is_active=true",[payload.id]);
 if(!users[0])redirect("/login?redirect=%2Finfluencer");
 if(users[0].role!=="influencer")redirect("/mypage");
 const {rows:infos}=await pool.query("SELECT * FROM influencers WHERE user_id=$1",[payload.id]);
 const inf=infos[0];
 if(!inf)return <main><Header/><div className="max-w-3xl mx-auto p-8"><h1>인플루언서 연결 준비 중</h1><p>관리자에게 계정 연결을 요청해주세요.</p><Link href="/mypage">내 구매내역</Link></div></main>;
 const raw=await searchParams;
 const valid=validDateRange(raw.from||null,raw.to||null);
 const from=valid?raw.from:undefined,to=valid?raw.to:undefined;
 const filtered=!!(from||to);
 let failure=false;
 let finance:Awaited<ReturnType<typeof influencerFinance>>=[];
 let period:Awaited<ReturnType<typeof influencerFinance>>=[];
 let products:any[]=[],campaigns:any[]=[];
 try {
  finance=await influencerFinance(site.key,shopPool,{influencerId:inf.id});
  period=filtered?(await influencerFinance(site.key,shopPool,{influencerId:inf.id,from,to})).filter(r=>r.orders>0):finance;
  products=(await shopPool.query(`SELECT p.*,
   NOT EXISTS(SELECT 1 FROM product_options po WHERE po.product_id=p.id)
    OR EXISTS(SELECT 1 FROM product_options po WHERE po.product_id=p.id AND po.is_active=true AND po.stock<>0) AS options_available
   FROM products_shop p WHERE p.influencer_rate IS NOT NULL AND p.is_visible=true
    AND (p.influencer_id IS NULL OR p.influencer_id::text=$1)
    AND (($2='sanjipick' AND p.category=ANY($3::text[])) OR ($2='blendpick' AND NOT(COALESCE(p.category,'')=ANY($3::text[]))))
   ORDER BY p.created_at DESC`,[inf.id,site.key,SITES.sanjipick.categories])).rows;
  if(site.key==="blendpick") campaigns=(await pool.query(`SELECT c.id,c.commission_rate,c.is_archived,
   to_char(c.start_date,'YYYY-MM-DD') start_date,to_char(c.end_date,'YYYY-MM-DD') end_date,p.name product_name
   FROM campaigns c JOIN products p ON p.id=c.product_id WHERE c.influencer_id=$1 ORDER BY c.end_date DESC`,[inf.id])).rows;
 } catch {failure=true;}
 const day=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"});
 const docs=!!(inf.bankbook_file&&(inf.business_type==="freelancer"?inf.id_card_file:inf.biz_cert_file));
 const card="ds-card p-5 mb-4";
 const origin="https://"+site.host;
 const total=period.reduce((n,r)=>n+r.gross,0);
 const active=products.filter(p=>p.is_visible===true&&p.options_available&&storefrontSale(p)==="open");
 return <main className="min-h-screen"><Header/><div className="max-w-5xl mx-auto px-4 py-8">
  <h1 className="text-2xl font-bold">{site.name} 인플루언서 활동</h1>
  <p className="mt-2 mb-4">{inf.name}님 · {BUSINESS_TYPE_LABEL[inf.business_type as keyof typeof BUSINESS_TYPE_LABEL]||"사업자 유형 확인 필요"}</p>
  <nav className="flex flex-wrap gap-4 mb-6" aria-label="인플루언서 메뉴"><a href="#tasks">지금 확인할 일</a><a href="#links">공구·공유 링크</a><a href="#sales">판매 실적</a><a href="#payouts">정산·증빙</a><Link href="/mypage">내 구매내역</Link></nav>
  <section id="tasks" className={card}><h2 className="font-bold mb-3">지금 확인할 일</h2>
   <ul className="space-y-2">
    {!docs&&<li>정산 증빙이 부족합니다. 관리자에게 통장 사본과 사업자 유형별 증빙을 제출해주세요.</li>}
    {(!inf.bank_name||!inf.bank_account||!inf.bank_holder)&&<li>정산 계좌 정보 확인이 필요합니다.</li>}
    {products.some(p=>storefrontSale(p)==="upcoming")&&<li>오픈 예정 상품이 있습니다. 아래 판매 시작 일정과 상품 구성을 확인해주세요.</li>}
    {finance.some(r=>r.review_reasons.length)&&<li>환불 또는 주문 당시 요율 확인이 필요한 정산이 있습니다.</li>}
    {failure&&<li role="alert">일부 정보를 불러오지 못했습니다. <a href="/influencer" className="underline">다시 조회</a></li>}
    {!failure&&docs&&inf.bank_name&&inf.bank_account&&inf.bank_holder&&!finance.some(r=>r.review_reasons.length)&&<li>등록된 정산 정보에서 추가 확인 사항이 없습니다.</li>}
   </ul><a href={site.kakaoUrl} target="_blank" rel="noopener noreferrer" className="underline mt-3 inline-block">운영 담당자에게 문의</a>
  </section>
  <section id="links" className={card}><h2 className="font-bold mb-3">공구·공유 링크 · 판매 중 {active.length}개</h2>
   {products.map(p=>{const state=p.is_visible===true&&p.options_available?storefrontSale(p):"closed";return <div key={p.id} className="border-t py-4">
    <p className="font-semibold">{p.name}</p><p className="text-sm my-2">{state==="open"?"판매 중":state==="upcoming"?"오픈 예정":"공유 중지"} · 수수료 {Number(p.influencer_rate)}%</p>
    {p.sale_start_at&&<p className="text-sm">시작 {new Date(p.sale_start_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p>}
    {p.sale_end_at&&<p className="text-sm">마감 {new Date(p.sale_end_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p>}
    {state==="open"&&<CopyLinkButton origin={origin} path={`/products/${p.id}?inf=${inf.id}`}/>}
    <FirstBuyersClient productId={p.id}/>
   </div>;})}
   {campaigns.map(p=>{const upcoming=p.start_date>day;const open=!p.is_archived&&!upcoming&&p.end_date>=day;return <div key={p.id} className="border-t py-4"><p className="font-semibold">{p.product_name}</p><p>{p.start_date} ~ {p.end_date} · {p.is_archived?"보관됨":open?"진행 중":upcoming?"오픈 예정":"종료"}</p>{open&&<CopyLinkButton origin={origin} campaignId={p.id}/>}</div>;})}
   {site.key==="blendpick"&&<div className="border-t py-4"><p className="font-semibold">호텔 공구</p>{inf.hotel_sale_start&&inf.hotel_sale_deadline&&Date.parse(inf.hotel_sale_start)<=Date.now()&&Date.parse(inf.hotel_sale_deadline)>Date.now()?<CopyLinkButton origin={origin} path={`/hotel/utop?inf=${inf.id}`}/>:<p>판매 기간에 공유 링크가 활성화됩니다.</p>}</div>}
   {!failure&&!products.length&&!campaigns.length&&<p>연결된 상품 공구가 없습니다.</p>}
  </section>
  <section id="sales" className={card}><h2 className="font-bold mb-3">판매 실적</h2>
   <form className="flex flex-wrap gap-3 mb-4"><label>시작일 <input type="date" name="from" defaultValue={from}/></label><label>종료일 <input type="date" name="to" defaultValue={to}/></label><button type="submit" className="underline">조회</button><Link href="/influencer#sales">전체 기간</Link></form>
   {!valid&&<p role="alert">날짜 범위를 확인해주세요. 전체 기간을 표시합니다.</p>}
   {failure?<p role="alert">판매 실적을 불러오지 못했습니다.</p>:<><p className="text-lg font-bold">{filtered?"선택 기간":"전체 기간"} 상품 순매출 {won(total)}</p><p className="text-sm mb-4">결제일 기준 · 배송비 제외 · 현재까지의 실제 환불 반영</p>
    {period.map(r=><div key={r.campaign_id} className="border-t py-3"><p>{products.find(p=>p.id===r.campaign_id)?.name||r.product_name}</p><p>{r.orders}건 · {won(r.gross)} · 수수료 {won(r.commission)}</p>{r.review_reasons.length>0&&<p>{r.review_reasons.join(" · ")}</p>}</div>)}
    {!period.length&&<p>해당 기간의 판매 내역이 없습니다.</p>}</>}
  </section>
  <section id="payouts" className={card}><h2 className="font-bold mb-3">정산·증빙</h2><p>관리자 정산과 동일한 계산 기준 · 아래 금액은 전체 기간 누적이며 판매 실적 날짜 필터와 별개입니다.</p>
   <p className="my-3">증빙 {docs?"등록됨":"보완 필요"} · 계좌 {inf.bank_name||"미등록"} {inf.bank_account?"끝 "+String(inf.bank_account).slice(-4):""}</p>
   {failure?<p role="alert">정산 정보를 불러오지 못했습니다.</p>:finance.map(r=><div key={r.campaign_id} className="border-t py-3"><p className="font-semibold">{products.find(p=>p.id===r.campaign_id)?.name||r.product_name}</p>
    <p>{r.payout?(r.payout.status==="paid"?"지급완료":"정산 확정"):"예상 정산"} · {won(r.payout?r.payout.payout_amount:r.breakdown?.payout)}</p>
    {r.payout?.paid_at&&<p>지급일 {new Date(r.payout.paid_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</p>}
    {r.payout&&r.breakdown&&r.payout.payout_amount!==r.breakdown.payout&&<p role="status">현재 계산액과 확정액에 차이가 있습니다. 환불·추가 매출 반영 여부를 관리자에게 확인해주세요.</p>}
    {r.review_reasons.length>0&&<p>{r.review_reasons.join(" · ")}</p>}
   </div>)}
  </section>
 </div></main>;
}
