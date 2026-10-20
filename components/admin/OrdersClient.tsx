"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useEffect, useState, useMemo, useRef } from "react";
import { orderQueue, dispatchIssues } from "@/lib/admin-workflow";
import Link from "next/link";
import OrderQuickView from "@/components/admin/OrderQuickView";
import { downloadXlsx } from "@/lib/xlsx-download";
import { matchesOrderSearch, selectionAction } from "@/lib/admin-list-workspace";
import { useSiteKey } from "@/components/SiteContext";
import { SITES } from "@/lib/sites";
import { formatPhone } from "@/lib/phone-format";

interface OrderItem {
  id: string;
  product_id: string | null; // 추가옵션 행은 null
  product_name: string;
  product_code: string | null;
  option_label: string | null;
  unit_price: number;
  quantity: number;
  supplier_name?: string | null; expected_ship_date?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  site: string | null; // 결제된 사이트 — 'blendpick' | 'sanjipick'
  buyer_name: string;
  buyer_phone: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  addr_zipcode: string;
  addr_address: string;
  addr_detail: string | null;
  addr_memo: string | null;
  total_amount: number;
  shipping_fee: number;
  tracking_company: string | null;
  tracking_number: string | null;
  influencer_name: string | null;
  link_code?: string | null; // 비밀링크(링크가)로 결제된 주문이면 그 코드
  created_at: string;
  paid_at?: string | null; payment_verified?: boolean; pending_refunds?: boolean; sales_channel?: string;
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  paid:               "신규주문",
  confirmed:          "주문확인",
  preparing:          "배송준비",
  shipped:            "배송중",
  delivered:          "배송완료",
  cancelled:          "취소완료",
  cancel_requested:   "취소요청",
  exchange_requested: "교환신청",
  exchange_completed: "교환완료",
  return_requested:   "반품신청",
  return_completed:   "반품완료",
};

const STATUS_STYLE: Record<string, string> = {
  paid:               "bg-blue-50 text-blue-600",
  confirmed:          "bg-indigo-50 text-indigo-600",
  preparing:          "bg-yellow-50 text-yellow-600",
  shipped:            "bg-purple-50 text-purple-600",
  delivered:          "bg-green-50 text-green-600",
  cancelled:          "bg-gray-100 text-gray-400",
  cancel_requested:   "bg-red-50 text-red-500",
  exchange_requested: "bg-violet-50 text-violet-600",
  exchange_completed: "bg-violet-50 text-violet-400",
  return_requested:   "bg-[#EAF0E6] text-[#2D5A27]",
  return_completed:   "bg-[#EAF0E6] text-[#7A8B6F]",
};

// 공동구매 판별 — 지금 공구는 상품 상세(?inf= 링크·쿠키 귀속)로 팔려 order_type이 'shop'으로
// 저장되므로, 인플루언서가 귀속된 주문은 전부 공동구매로 분류한다 (옛 캠페인 링크 주문 포함)
const isCampaign = (o: { order_type: string; influencer_name: string | null }) =>
  o.order_type === "campaign" || !!o.influencer_name;

const COLUMNS = [
  "주문일시", "주문일자", "주문시간", "주문번호", "구매자", "구매자번호",
  "수령인", "수령인번호", "수령인주소", "우편번호", "배송메모",
  "상품명", "선택옵션", "선택수량", "판매금액", "배송비", "총 결제 금액", "구매 구분", "비전시 링크 코드", "발주 공급사", "출고 예정일",
];

// 발주용 엑셀(.xlsx) 행 데이터 — 수량·금액은 숫자 셀
// 총 결제 금액(배송비 포함, 주문 단위)은 주문의 첫 줄에만 기재 → 컬럼 SUM해도 중복 없음
export function toOrderRows(orders: Order[], includeStatus = false): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const o of orders) {
    // 추가옵션 행도 상품명은 공구명(본상품)으로 통일하고, 추가상품 이름은 선택옵션 칸에
    // ("[추가] 손잡이 — 라벤더 440ml" → 선택옵션 "텀블러 실리콘 손잡이") — 업체 발주 양식 요청
    const main = o.items.find((i) => i.product_id) ?? o.items[0];
    const items = includeStatus && !o.items.length
      ? [{ product_id: null, product_name: "상품 정보 없음", option_label: null, quantity: "", supplier_name: null, expected_ship_date: null }]
      : o.items;
    items.forEach((item, idx) => {
      const isAddon = !item.product_id;
      const addr = [o.addr_address, o.addr_detail].filter(Boolean).join(" ");
      const d = new Date(o.created_at);
      rows.push([
        d.toLocaleString("ko-KR", { hour12: false }),
        d.toLocaleDateString("ko-KR"),
        d.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        o.order_number,
        o.buyer_name,
        formatPhone(o.buyer_phone),
        o.recipient_name ?? o.buyer_name,
        formatPhone(o.recipient_phone || o.buyer_phone),
        addr,
        o.addr_zipcode ?? "",
        o.addr_memo ?? "",
        isAddon ? (main?.product_name ?? item.product_name) : item.product_name,
        isAddon
          ? item.product_name.replace(/^\[추가\]\s*/, "").replace(/\s*—[^—]*$/, "")
          : (item.option_label ?? ""),
        item.quantity,
        // 금액 3종은 주문 첫 행에만 — 상품 줄마다 반복하면 컬럼 합계가 실제보다 커진다
        // (판매금액 = 총결제 − 배송비. 각 컬럼 SUM이 그대로 전체 판매금액/배송비/결제액)
        idx === 0 ? Number(o.total_amount) - Number(o.shipping_fee ?? 0) : "",
        idx === 0 ? Number(o.shipping_fee ?? 0) : "",
        idx === 0 ? Number(o.total_amount) : "",
        (o.sales_channel ?? (o.link_code?"non_display":"display")) === "non_display" ? "비전시" : "전시", o.link_code ?? "", item.supplier_name || "미지정", item.expected_ship_date?.slice(0,10) || "미지정",
        ...(includeStatus ? [STATUS_LABEL[o.status] || o.status] : []),
      ]);
    });
  }
  return rows.sort((a,b)=>String(a[19]).localeCompare(String(b[19]),"ko") || String(a[20]).localeCompare(String(b[20])));
}

export default function OrdersClient({ sharedOrders, onChanged }: {sharedOrders?: Order[]; onChanged?: () => Promise<void>} = {}) {
  const [queue, setQueue] = useState("work");
  const [loadError, setLoadError] = useState("");
  const [batches, setBatches] = useState<{id:string;request_key:string;created_at:string;order_count:number}[]>([]);
  const pendingDispatch = useRef<{key:string;ids:string[]} | null>(null);
  const [orders, setOrders] = useState<Order[]>(sharedOrders??[]);
  const [loading, setLoading] = useState(!sharedOrders);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const siteFilter = useSiteKey(); // '' | 'blendpick' | 'sanjipick'
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [productFilter, setProductFilter] = useState("");

  async function loadBatches(){try{const r=await fetch("/api/admin/dispatches");const rows=await readApiJson(r);if(!r.ok||!Array.isArray(rows))throw Error(apiErrorMessage(rows,"발주 이력을 불러오지 못했습니다."));setBatches(rows);if(rows.some((b:{request_key:string})=>b.request_key===pendingDispatch.current?.key))pendingDispatch.current=null;}catch(e){setLoadError(apiErrorMessage(e, "발주 이력을 불러오지 못했습니다. 새로고침해주세요."));}}
  async function load(_status = "") {
    if(sharedOrders){await onChanged?.();return;}
    setLoading(true);setLoadError("");
    try{const res=await fetch("/api/admin/orders");const data=await readApiJson(res);if(!res.ok||!Array.isArray(data))throw Error(apiErrorMessage(data,"주문을 불러오지 못했습니다."));setOrders(data);setSelected(new Set());}
    catch(e){setOrders([]);setLoadError(apiErrorMessage(e, "주문을 불러오지 못했습니다. 새로고침해주세요."));}
    finally{setLoading(false);}
  }
  useEffect(() => { if(!sharedOrders)load();loadBatches(); }, []);
  useEffect(() => {if(sharedOrders){setOrders(sharedOrders);setLoading(false);setSelected(prev=>new Set([...prev].filter(id=>sharedOrders.some(o=>o.id===id && orderQueue(o)==="ready"))));}},[sharedOrders]);
  // 검색 — 주문번호·구매자·수령인·연락처·상품명·옵션·인플루언서 통합
  const [query, setQuery] = useState("");
  useEffect(()=>{setSelected(new Set());},[queue,statusFilter,typeFilter,channelFilter,query,productFilter]);
  const siteOf = (o: Order) => o.site || "blendpick";
  const visibleOrders = useMemo(() => {
    let list =
      typeFilter === "campaign" ? orders.filter(isCampaign)
      : typeFilter === "shop" ? orders.filter((o) => !isCampaign(o))
      : orders;
    if(queue!=="history")list=list.filter(o=>queue === "work" ? orderQueue(o)!=="history" : orderQueue(o)===queue);
    if(statusFilter)list=list.filter(o=>o.status===statusFilter);
    if (siteFilter) list = list.filter((o) => siteOf(o) === siteFilter);
    if (channelFilter) list = list.filter(o=>(o.sales_channel ?? (o.link_code ? "non_display" : "display")) === channelFilter);
    if (productFilter) list = list.filter(o => o.items.some(i => i.product_name === productFilter));
    return list.filter(o => matchesOrderSearch(o, query));
  }, [orders, typeFilter, siteFilter, query, channelFilter, queue, statusFilter, productFilter]);
  const scopedOrders = orders.filter(o => siteOf(o) === siteFilter);
  const selectedAction = selectionAction(visibleOrders, selected);

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleOrders.forEach((o) => next.delete(o.id));
      else visibleOrders.forEach((o) => next.add(o.id));
      return next;
    });
  }

  async function handleBatchAction(action: string, label: string, withCSV = false, deductShipping = false) {
    if (selectedAction !== "cancel") return;
    const extra = action === "cancel_confirm"
      ? deductShipping
        ? "\n각 주문의 배송비를 뺀 금액이 토스로 환불됩니다."
        : "\n결제 금액이 토스로 전액 환불됩니다."
      : "";
    if (!confirm(`선택한 ${selected.size}건을 ${label} 처리할까요?${extra}${action === "cancel_confirm" ? "\n공급사에 모든 선택 주문의 출고 중지 또는 회수 완료를 확인한 경우에만 승인하세요." : ""}`)) return;
    setActing(true);

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selected], action, deduct_shipping: deductShipping, dispatch_stop_confirmed: action === "cancel_confirm" }),
      });
      const d = await readApiJson(res);
      if (!res.ok || d.error) alert(apiErrorMessage(d, "처리에 실패했어요."));

      await load(statusFilter);
    } catch (error) { alert(apiErrorMessage(error, "처리 결과를 확인하지 못했습니다. 새로고침해 상태를 확인해주세요.")); } finally { setActing(false); }
  }

  // 개별 주문 취소 — 토스 전액 환불 + 상태 취소 + 재고 복원까지 서버가 한 번에 처리
  const CANCELLABLE = ["paid", "confirmed", "preparing", "cancel_requested"];
  async function handleCancelOne(o: { id: string; order_number: string; buyer_name: string; total_amount: number; status: string }) {
    const needsStop = ["preparing", "shipped", "delivered", "cancel_requested"].includes(o.status);
    if (!confirm(
      `${o.order_number} (${o.buyer_name}) 주문을 취소할까요?\n결제금액 ${Number(o.total_amount).toLocaleString()}원이 토스로 전액 환불됩니다.${needsStop ? "\n공급사 출고 중지 또는 회수 완료를 확인한 경우에만 승인하세요." : ""}`
    )) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", dispatch_stop_confirmed: needsStop }),
      });
      const d = await readApiJson(res);
      if (!res.ok) { alert(apiErrorMessage(d, "취소에 실패했어요.")); return; }
      await load(statusFilter);
    } catch (error) {
      alert(apiErrorMessage(error, "네트워크 문제로 취소 요청이 전달되지 않았어요. 목록을 새로고침해 상태를 확인해주세요."));
    } finally {
      setActing(false);
    }
  }

  async function saveDispatchDownload(b: {snapshot:Order[];excluded:{order_number:string;reason:string}[]}, filename:string) {
    if (b.excluded?.length) alert(`출고 대상에서 ${b.excluded.length}건을 제외했습니다.\n${b.excluded.map(o=>`${o.order_number}: ${o.reason}`).join("\n")}`);
    if (!b.snapshot?.length) { alert("현재 출고 가능한 주문이 없습니다."); return; }
    await downloadXlsx(filename, COLUMNS, toOrderRows(b.snapshot), "발주");
  }
  async function handleDownloadOnly() {
    if (!selected.size) return;
    try {
      const r=await fetch("/api/admin/orders/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderIds:[...selected]})});
      const b=await readApiJson(r);if(!r.ok)throw Error(apiErrorMessage(b, "주문 목록을 확인하지 못했습니다."));
      if (!Array.isArray(b.orders)) throw Error("주문 목록 응답을 확인하지 못했습니다.");
      await downloadXlsx(`주문목록_조회용_${new Date().toISOString().slice(0,10)}.xlsx`, [...COLUMNS, "주문 상태"], toOrderRows(b.orders, true), "주문목록(출고용 아님)");
    } catch(e) { alert(apiErrorMessage(e, "파일을 받지 못했습니다.")); }
  }
  async function downloadBatch(id:string){
    try{const r=await fetch(`/api/admin/dispatches?id=${id}`);const b=await readApiJson(r);if(!r.ok)throw Error(apiErrorMessage(b));await saveDispatchDownload(b,`발주확정_${id.slice(0,8)}.xlsx`);}
    catch(e){alert(apiErrorMessage(e, "파일을 받지 못했습니다. 발주 이력에서 다시 다운로드해주세요."));}
  }
  async function handleDispatch(){
    if (selectedAction !== "dispatch") { alert("발주 가능한 주문만 선택해주세요."); return; }
    const ids=[...selected].sort();if(!ids.length||!confirm(`${ids.length}건을 발주 확정할까요? 확정 후 배송준비로 이동합니다. 공급사 전송은 별도로 진행해주세요.`))return;
    if(pendingDispatch.current&&JSON.stringify(pendingDispatch.current.ids)!==JSON.stringify(ids)){alert("이전 요청 결과부터 발주 이력에서 확인해주세요. 같은 주문 선택으로 다시 시도할 수 있습니다.");return;}
    const request=pendingDispatch.current??{key:crypto.randomUUID(),ids};pendingDispatch.current=request;setActing(true);
    try{const r=await fetch("/api/admin/dispatches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_key:request.key,orderIds:request.ids})});const b=await readApiJson(r);if(!r.ok){if(r.status<500)pendingDispatch.current=null;throw Error(apiErrorMessage(b, "발주에 실패했습니다."));}pendingDispatch.current=null;await load();await loadBatches();await downloadBatch(b.id);}
    catch(e){alert(apiErrorMessage(e, "발주 이력에서 처리 결과를 확인해주세요."));await loadBatches();}
    finally{setActing(false);}
  }
  const actionButton = () => {
    if (selected.size === 0) return null;
    if(selectedAction==="dispatch")return <button disabled={acting} onClick={handleDispatch} className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-4 py-2 rounded-none transition-colors disabled:opacity-50">{acting?"확정 중…":`발주 확정 · 엑셀 (${selected.size}건)`}</button>;
    // 취소요청 탭 — 배송관리와 같은 3버튼 (전액 환불 / 배송비 차감 / 반려)
    if (selectedAction === "cancel") return (
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleBatchAction("cancel_confirm", "취소 승인 · 전액 환불", false, false)} disabled={acting}
          className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-none transition-colors disabled:opacity-50">
          {acting ? "처리 중..." : `승인 · 전액 환불 (${selected.size}건)`}
        </button>
        <button onClick={() => handleBatchAction("cancel_confirm", "취소 승인 · 배송비 차감(단순 변심)", false, true)} disabled={acting}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-none transition-colors disabled:opacity-50">
          승인 · 배송비 차감
        </button>
        <button onClick={() => handleBatchAction("cancel_reject", "취소요청 반려 (주문 유지, 환불 없음)")} disabled={acting}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-bold px-4 py-2 rounded-none transition-colors disabled:opacity-50">
          반려
        </button>
      </div>
    );
    return null;
  };

  return (
    <div className="ops-workspace">
      {!sharedOrders && <header className="ops-page-heading">
        <div><h1>주문 관리</h1><p>{SITES[siteFilter].name} · 주문 확인부터 발주까지 한 목록에서 처리합니다.</p></div>
        <div className="ops-heading-actions"><Link href="/admin/shipments" className="ops-button">배송·반품 관리 →</Link><button onClick={()=>{void load();void loadBatches();}} className="ops-button" disabled={loading}>새로고침</button></div>
      </header>}
      <section className="ops-list-panel" aria-label="주문 목록">
        <div className="ops-filter-strip" aria-label="주문 범위">
          {[{key:"work",label:"처리할 주문"},{key:"ready",label:"발주 가능"},{key:"check",label:"확인 필요"},{key:"requests",label:"고객 요청"},{key:"history",label:"전체 주문"}].map(t=>{
            const count = scopedOrders.filter(o=>t.key==="history" || (t.key==="work" ? orderQueue(o)!=="history" : orderQueue(o)===t.key)).length;
            return <button key={t.key} aria-pressed={queue===t.key} onClick={()=>{setQueue(t.key);setStatusFilter("");}} className="ops-filter-chip">{t.label}<b>{loading || loadError && !orders.length ? '—' : count}</b></button>;
          })}
        </div>
        <div className="ops-toolbar">
          <input aria-label="주문 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="주문번호 · 이름 · 연락처 · 상품 검색" className="ops-search" />
          <select aria-label="상품별 주문" value={productFilter} onChange={e=>setProductFilter(e.target.value)}><option value="">상품 전체</option>{[...new Set(scopedOrders.flatMap(o=>o.items.map(i=>i.product_name)))].map(name=><option key={name}>{name}</option>)}</select>
          <select aria-label="처리 상태" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setQueue("history");}}><option value="">처리상태 전체</option>{Object.entries(STATUS_LABEL).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
          <select aria-label="판매 방식" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">판매방식 전체</option><option value="shop">일반 상품</option><option value="campaign">공동구매</option></select>
          <select aria-label="구매 구분" value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="">구매구분 전체</option><option value="display">전시</option><option value="non_display">비전시</option></select>
          {(query||productFilter||typeFilter||channelFilter||statusFilter) && <button className="ops-text-button" onClick={()=>{setQuery("");setProductFilter("");setTypeFilter("");setChannelFilter("");setStatusFilter("");}}>검색 초기화</button>}
        </div>
        {loadError && <p role="alert" className="ops-error">{loadError}</p>}
        {<div className="ops-selection-bar" aria-live="polite">
          <span>{visibleOrders.length}건 표시{selected.size ? ` · ${selected.size}건 선택` : ' · 주문번호를 누르면 요약을 볼 수 있습니다'}</span>
          {actionButton()}
          {selected.size>0 && <button onClick={handleDownloadOnly} disabled={acting} className="ops-button">선택 주문 목록 다운로드</button>}
          {selectedAction==='mixed' && <span className="ops-warning">일괄 처리는 같은 처리 단계의 주문만 선택해주세요.</span>}
        </div>}
        {loading ? <p className="ops-empty" role="status">주문을 불러오는 중입니다.</p>
         : !visibleOrders.length ? <p className="ops-empty">{loadError ? '주문을 확인하지 못했습니다. 새로고침해주세요.' : '조건에 맞는 주문이 없습니다.'}</p>
         : <div className="ops-table-scroll"><table className="ops-table ops-orders-table">
          <thead><tr><th><input type="checkbox" aria-label="표시된 주문 전체 선택" checked={visibleOrders.every(o=>selected.has(o.id))} onChange={toggleAll}/></th><th>주문 · 주문일시 <small>한국시간</small></th><th>상품 · 옵션</th><th>구매자 · 수령인</th><th>결제 금액 · 경로</th><th>상태 · 확인 사항</th><th>처리</th></tr></thead>
          <tbody>{visibleOrders.map(o=>{
            const needsCheck=orderQueue(o)==='check';
            return <tr key={o.id} data-selected={selected.has(o.id)}>
              <td><input type="checkbox" aria-label={`${o.order_number} 선택`} checked={selected.has(o.id)} onChange={()=>toggleOrder(o.id)}/></td>
              <td><OrderQuickView order={o}/><time dateTime={o.created_at} className="ops-meta">{new Date(o.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></td>
              <td>{o.items.length ? o.items.map((it,i)=><div key={it.id||i} className="ops-order-item"><strong>{it.product_name}</strong><span className="ops-meta">{it.option_label||'기본 구성'} · {it.quantity}개{it.supplier_name ? ` · ${it.supplier_name}` : ''}</span></div>):<span className="ops-warning">상품 정보 없음</span>}</td>
              <td><strong>{o.buyer_name}</strong><span className="ops-meta">{formatPhone(o.buyer_phone)}</span>{((o.recipient_name && o.recipient_name!==o.buyer_name)||(o.recipient_phone && o.recipient_phone!==o.buyer_phone))&&<span className="ops-meta">수령 {o.recipient_name||o.buyer_name} · {formatPhone(o.recipient_phone||o.buyer_phone)}</span>}</td>
              <td className="ops-nowrap"><strong>{Number(o.total_amount).toLocaleString()}원</strong><span className="ops-meta">{isCampaign(o)?'공동구매':'일반 상품'} · {(o.sales_channel??(o.link_code?'non_display':'display'))==='non_display'?'비전시':'전시'}</span>{o.influencer_name&&<span className="ops-meta">@{o.influencer_name}</span>}</td>
              <td><span className={`ops-status ${STATUS_STYLE[o.status]||'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[o.status]||o.status}</span>{needsCheck&&<p className="ops-warning">{dispatchIssues(o).join(' · ')}</p>}{orderQueue(o)==='ready'&&<span className="ops-meta">발주 가능</span>}</td>
              <td><div className="ops-row-actions"><Link href={`/admin/orders/${o.id}`}>상세</Link>{["exchange_requested","return_requested"].includes(o.status)&&<Link href={`/admin/shipments?tab=${o.status}`}>요청 처리 →</Link>}{CANCELLABLE.includes(o.status)&&<button onClick={()=>handleCancelOne(o)} disabled={acting} className="ops-danger">취소</button>}</div></td>
            </tr>;
          })}</tbody>
         </table></div>}
      </section>
      <section className="ops-dispatch-history" aria-label="최근 발주 확정 이력">
        <div className="ops-section-heading"><h2>최근 발주 확정</h2><span>확정 이력에서 현재 출고 가능 여부를 다시 확인한 뒤 엑셀을 받습니다.</span></div>
        {!batches.length ? <p className="ops-meta">표시할 발주 이력이 없습니다.</p> : <div className="ops-history-recent">{batches.slice(0,3).map(b=><div key={b.id}><span>{new Date(b.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · <b>{b.order_count}건</b></span><button className="ops-text-button" onClick={()=>downloadBatch(b.id)}>엑셀 다시 받기 ↓</button></div>)}</div>}
        {batches.length>3&&<details className="ops-details"><summary>이전 발주 이력 {batches.length-3}건 더 보기</summary>{batches.slice(3).map(b=><div key={b.id} className="ops-history-row"><span>{new Date(b.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {b.order_count}건</span><button className="ops-text-button" onClick={()=>downloadBatch(b.id)}>다시 받기 ↓</button></div>)}</details>}
      </section>
    </div>
  );
}
