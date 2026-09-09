"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { orderQueue, dispatchIssues } from "@/lib/admin-workflow";
import Link from "next/link";
import { downloadXlsx } from "@/lib/xlsx-download";
import ReturnsPanel from "@/components/admin/ReturnsPanel";
import SiteBadge from "@/components/admin/SiteBadge";
import { useSiteKey } from "@/components/SiteContext";
import { SITES } from "@/lib/sites";

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

interface Order {
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

const ORDER_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  campaign: { label: "공동구매", cls: "bg-emerald-50 text-emerald-600" },
  shop:     { label: "상품",     cls: "bg-slate-100 text-slate-600" },
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
function toOrderRows(orders: Order[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const o of orders) {
    // 추가옵션 행도 상품명은 공구명(본상품)으로 통일하고, 추가상품 이름은 선택옵션 칸에
    // ("[추가] 손잡이 — 라벤더 440ml" → 선택옵션 "텀블러 실리콘 손잡이") — 업체 발주 양식 요청
    const main = o.items.find((i) => i.product_id) ?? o.items[0];
    o.items.forEach((item, idx) => {
      const isAddon = !item.product_id;
      const addr = [o.addr_address, o.addr_detail].filter(Boolean).join(" ");
      const d = new Date(o.created_at);
      rows.push([
        d.toLocaleString("ko-KR", { hour12: false }),
        d.toLocaleDateString("ko-KR"),
        d.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        o.order_number,
        o.buyer_name,
        o.buyer_phone,
        o.recipient_name ?? o.buyer_name,
        o.recipient_phone ?? o.buyer_phone,
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
      ]);
    });
  }
  return rows.sort((a,b)=>String(a[a.length-2]).localeCompare(String(b[b.length-2]),"ko") || String(a[a.length-1]).localeCompare(String(b[b.length-1])));
}

export default function OrdersClient() {
  const [queue, setQueue] = useState("ready");
  const [loadError, setLoadError] = useState("");
  const [batches, setBatches] = useState<{id:string;request_key:string;created_at:string;order_count:number}[]>([]);
  const pendingDispatch = useRef<{key:string;ids:string[]} | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const siteFilter = useSiteKey(); // '' | 'blendpick' | 'sanjipick'
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 고객 신청(취소·교환·반품) 대기 건수 — 어떤 탭을 보고 있든 항상 최신으로 유지해 배너·배지에 표시
  const [reqCounts, setReqCounts] = useState({ cancel_requested: 0, exchange_requested: 0, return_requested: 0 });
  async function loadReqCounts() {
    try {
      const res = await fetch("/api/admin/orders?status=cancel_requested,exchange_requested,return_requested");
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const c = { cancel_requested: 0, exchange_requested: 0, return_requested: 0 };
      for (const o of data) if (o.status in c) (c as Record<string, number>)[o.status]++;
      setReqCounts(c);
    } catch { /* 배지 갱신 실패는 무시 — 다음 로드에서 다시 시도 */ }
  }

  async function loadBatches(){try{const r=await fetch("/api/admin/dispatches");if(!r.ok)throw Error();const rows=await r.json();setBatches(rows);if(rows.some((b:{request_key:string})=>b.request_key===pendingDispatch.current?.key))pendingDispatch.current=null;}catch{setLoadError("발주 이력을 불러오지 못했습니다. 새로고침해주세요.");}}
  async function load(_status = "") {
    setLoading(true);setLoadError("");
    try{const res=await fetch("/api/admin/orders");const data=await res.json();if(!res.ok||!Array.isArray(data))throw Error();setOrders(data);setSelected(new Set());loadReqCounts();}
    catch{setOrders([]);setLoadError("주문을 불러오지 못했습니다. 새로고침해주세요.");}
    finally{setLoading(false);}
  }
  useEffect(() => { load();loadBatches(); }, []);
  // 검색 — 주문번호·구매자·수령인·연락처·상품명·옵션·인플루언서 통합
  const [query, setQuery] = useState("");
  useEffect(()=>{setSelected(new Set());},[queue,statusFilter,typeFilter,channelFilter,query]);
  const siteOf = (o: Order) => o.site || "blendpick";
  const visibleOrders = useMemo(() => {
    let list =
      typeFilter === "campaign" ? orders.filter(isCampaign)
      : typeFilter === "shop" ? orders.filter((o) => !isCampaign(o))
      : orders;
    if(queue!=="history")list=list.filter(o=>orderQueue(o)===queue);
    if(statusFilter)list=list.filter(o=>o.status===statusFilter);
    if (siteFilter) list = list.filter((o) => siteOf(o) === siteFilter);
    if (channelFilter) list = list.filter(o=>(o.sales_channel ?? (o.link_code ? "non_display" : "display")) === channelFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/[^0-9]/g, "");
      list = list.filter((o) =>
        (o.order_number ?? "").toLowerCase().includes(q) ||
        (o.buyer_name ?? "").toLowerCase().includes(q) ||
        (o.recipient_name ?? "").toLowerCase().includes(q) ||
        (o.influencer_name ?? "").toLowerCase().includes(q) ||
        o.items.some((it) =>
          (it.product_name ?? "").toLowerCase().includes(q) ||
          (it.option_label ?? "").toLowerCase().includes(q)
        ) ||
        (qDigits.length >= 3 && (
          (o.buyer_phone ?? "").replace(/[^0-9]/g, "").includes(qDigits) ||
          (o.recipient_phone ?? "").replace(/[^0-9]/g, "").includes(qDigits)
        ))
      );
    }
    return list;
  }, [orders, typeFilter, siteFilter, query, channelFilter, queue, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of visibleOrders) {
      // 그룹 이름은 본상품 기준 — 추가옵션 행(product_id 없음)이 첫 줄이어도 그룹이 쪼개지지 않게
      const main = o.items.find((i) => i.product_id) ?? o.items[0];
      const key = main?.product_name ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, [visibleOrders]);

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(groupOrders: Order[]) {
    const ids = groupOrders.map((o) => o.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
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

  function toggleGroupExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleBatchAction(action: string, label: string, withCSV = false, deductShipping = false) {
    if (selected.size === 0) return;
    const extra = action === "cancel_confirm"
      ? deductShipping
        ? "\n각 주문의 배송비를 뺀 금액이 토스로 환불됩니다."
        : "\n결제 금액이 토스로 전액 환불됩니다."
      : "";
    if (!confirm(`선택한 ${selected.size}건을 ${label} 처리할까요?${extra}`)) return;
    setActing(true);

    try {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: [...selected], action, deduct_shipping: deductShipping }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.error) alert(d.error || "처리에 실패했어요.");

    await load(statusFilter);
    } catch { alert("처리 결과를 확인하지 못했습니다. 새로고침해 상태를 확인해주세요."); } finally { setActing(false); }
  }

  // 고객 신청 탭 — 취소요청은 이 화면에서 바로 승인/차감/반려, 교환·반품은 상세 패널로.
  // 건수는 항상 전체 기준(reqCounts) — 다른 탭을 보고 있어도 대기 건이 보이게
  const requestTabs = [
    { key: "cancel_requested",   label: "취소요청", count: reqCounts.cancel_requested },
    { key: "exchange_requested", label: "교환신청", count: reqCounts.exchange_requested },
    { key: "return_requested",   label: "반품신청", count: reqCounts.return_requested },
  ];
  const isReturnsTab = statusFilter === "exchange_requested" || statusFilter === "return_requested";

  // 개별 주문 취소 — 토스 전액 환불 + 상태 취소 + 재고 복원까지 서버가 한 번에 처리
  const CANCELLABLE = ["paid", "confirmed", "preparing", "cancel_requested"];
  async function handleCancelOne(o: { id: string; order_number: string; buyer_name: string; total_amount: number }) {
    if (!confirm(
      `${o.order_number} (${o.buyer_name}) 주문을 취소할까요?\n결제금액 ${Number(o.total_amount).toLocaleString()}원이 토스로 전액 환불됩니다.`
    )) return;
    setActing(true);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "취소에 실패했어요."); return; }
      await load(statusFilter);
    } catch {
      alert("네트워크 문제로 취소 요청이 전달되지 않았어요. 목록을 새로고침해 상태를 확인해주세요.");
    } finally {
      setActing(false);
    }
  }

  // 상태 변경 없이 선택 주문의 발주 엑셀만 다시 다운로드 (분실/재출력용)
  function handleDownloadOnly() {
    const selectedOrders = orders.filter((o) => selected.has(o.id));
    if (selectedOrders.length === 0) return;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadXlsx(`발주_${date}.xlsx`, COLUMNS, toOrderRows(selectedOrders), "발주");
  }

  async function downloadBatch(id:string){
    try{const r=await fetch(`/api/admin/dispatches?id=${id}`);const b=await r.json();if(!r.ok)throw Error();await downloadXlsx(`발주확정_${id.slice(0,8)}.xlsx`,COLUMNS,toOrderRows(b.snapshot),"발주");}
    catch{alert("파일을 받지 못했습니다. 발주 이력에서 다시 다운로드해주세요.");}
  }
  async function handleDispatch(){
    const ids=[...selected].sort();if(!ids.length||!confirm(`${ids.length}건을 발주 확정할까요? 확정 후 배송준비로 이동합니다. 공급사 전송은 별도로 진행해주세요.`))return;
    if(pendingDispatch.current&&JSON.stringify(pendingDispatch.current.ids)!==JSON.stringify(ids)){alert("이전 요청 결과부터 발주 이력에서 확인해주세요. 같은 주문 선택으로 다시 시도할 수 있습니다.");return;}
    const request=pendingDispatch.current??{key:crypto.randomUUID(),ids};pendingDispatch.current=request;setActing(true);
    try{const r=await fetch("/api/admin/dispatches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({request_key:request.key,orderIds:request.ids})});const b=await r.json();if(!r.ok){if(r.status<500)pendingDispatch.current=null;throw Error(b.error||"발주에 실패했습니다.");}pendingDispatch.current=null;await load();await loadBatches();await downloadBatch(b.id);}
    catch(e){alert(e instanceof Error?e.message:"발주 이력에서 처리 결과를 확인해주세요.");await loadBatches();}
    finally{setActing(false);}
  }
  const actionButton = () => {
    if (selected.size === 0) return null;
    if(queue==="ready")return <button disabled={acting} onClick={handleDispatch} className="bg-[#2D5A27] text-white px-4 py-2 disabled:opacity-50">{acting?"확정 중…":`발주 확정·엑셀 (${selected.size}건)`}</button>;
    // 취소요청 탭 — 배송관리와 같은 3버튼 (전액 환불 / 배송비 차감 / 반려)
    if (statusFilter === "cancel_requested") return (
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
    <div>
      <div className="bg-white border p-5 mb-4 space-y-4">
        <div className="flex justify-between gap-3 flex-wrap"><h2 className="font-bold">판매 관리 · {SITES[siteFilter].name}</h2><div className="flex gap-4 text-sm underline"><Link href="/admin/shipments">배송 관리</Link><Link href="/admin/link-sales">전시·비전시 집계</Link><button onClick={()=>{load();loadBatches();}}>새로고침</button></div></div>
        <div className="grid grid-cols-3 gap-2">{[{key:"check",label:"신규 확인"},{key:"ready",label:"발주 대기"},{key:"requests",label:"고객 요청"}].map(t=><button key={t.key} onClick={()=>{setQueue(t.key);setStatusFilter("");}} className={`border p-3 text-left ${queue===t.key?"bg-[#2D5A27] text-white":""}`}><span className="block text-sm">{t.label}</span><strong className="text-xl">{orders.filter(o=>orderQueue(o)===t.key).length}건</strong></button>)}</div>
        <p className="text-sm text-gray-500">{queue==="ready"?"결제·배송지·상품 수량을 확인한 주문입니다. 발주 확정 시 서버에서 다시 검사합니다. 공급사가 미지정이면 상품 정보에서 보완해주세요.":queue==="check"?"결제 또는 배송 정보 확인이 필요한 주문입니다. 사유를 확인하고 주문 상세에서 보완해주세요.":queue==="requests"?"취소·교환·반품 요청을 확인하고 처리해주세요.":"배송 진행·완료를 포함한 전체 주문 이력입니다."}</p>
        <div className="flex gap-3 flex-wrap"><input aria-label="주문 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="주문번호·이름·상품명 검색" className="border p-2 text-sm" /><button className="text-sm underline" onClick={()=>{setQueue("history");setStatusFilter("");}}>전체 이력</button></div>
        {queue==="requests"&&<div className="flex gap-2 flex-wrap"><button onClick={()=>setStatusFilter("")} className="border p-2 text-sm">전체 요청</button>{requestTabs.map(t=><button key={t.key} onClick={()=>setStatusFilter(t.key)} className={`border p-2 text-sm ${statusFilter===t.key?"bg-gray-900 text-white":""}`}>{t.label} {t.count}</button>)}</div>}
        <details className="text-sm"><summary className="cursor-pointer">상세 필터 · 판매 방식 / 구매 구분 / 처리 상태</summary><div className="flex flex-wrap gap-3 pt-3"><label>판매 방식 <select className="border p-2" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">전체</option><option value="shop">일반 상품</option><option value="campaign">공동구매</option></select></label><label>구매 구분 <select className="border p-2" value={channelFilter} onChange={e=>setChannelFilter(e.target.value)}><option value="">전체</option><option value="display">전시</option><option value="non_display">비전시</option></select></label>{queue==="history"&&<label>처리 상태 <select className="border p-2" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">전체</option>{Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}</div></details>
      </div>
      {loadError&&<p role="alert" className="text-red-600 mb-3">{loadError}</p>}
      <details className="border bg-white p-4 mb-4 text-sm"><summary className="cursor-pointer">최근 발주 확정 이력 · 재다운로드</summary><p className="text-gray-500 my-2">확정 당시 데이터로 다시 받습니다. 재다운로드는 상태·재고를 변경하지 않습니다.</p>{batches.length===0?<p>표시할 발주 이력이 없습니다.</p>:batches.map(b=><div key={b.id} className="flex justify-between border-t py-2"><span>{new Date(b.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} · {b.order_count}건</span><button onClick={()=>downloadBatch(b.id)} className="underline">다시 받기</button></div>)}</details>
      <div className="flex gap-3 mb-3">{actionButton()}{selected.size>0&&<button onClick={handleDownloadOnly} className="border bg-white p-2 text-sm">주문 목록 다운로드 ({selected.size}건)</button>}</div>
      {/* 주문 테이블 — 교환·반품 신청 탭은 사유·사진·수거지를 보고 건별 처리하는 상세 패널로 */}
      {isReturnsTab ? (
        <ReturnsPanel kind={statusFilter === "exchange_requested" ? "exchange" : "return"} onChanged={()=>{load();}} />
      ) : loading ? (
        <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-white rounded-none border border-gray-100 p-16 text-center text-sm text-gray-400">주문이 없습니다</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-gray-400">
            <input type="checkbox"
              checked={visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id))}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-[#2D5A27]"
            />
            <span>전체 선택 ({visibleOrders.length}건)</span>
          </div>

          {[...groups.entries()].map(([productName, groupOrders]) => {
            // 검색 중엔 결과가 접힌 그룹에 숨지 않게 전부 펼침
            const isExpanded = queue === "check" || query.trim() !== "" || expandedGroups.has(productName);
            const groupSelected = groupOrders.every((o) => selected.has(o.id));
            const groupPartial = groupOrders.some((o) => selected.has(o.id)) && !groupSelected;
            const productCode = groupOrders[0]?.items.find((i) => i.product_id)?.product_code;
            const typeBadge = groupOrders[0] && isCampaign(groupOrders[0]) ? ORDER_TYPE_BADGE.campaign : ORDER_TYPE_BADGE.shop;

            return (
              <div key={productName} className="bg-white rounded-none border border-gray-100 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroupExpand(productName)}
                >
                  <input type="checkbox" checked={groupSelected}
                    ref={(el) => { if (el) el.indeterminate = groupPartial; }}
                    onChange={(e) => { e.stopPropagation(); toggleGroup(groupOrders); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-[#2D5A27]"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${typeBadge.cls}`}>{typeBadge.label}</span>
                    {productCode && (
                      <span className="text-xs font-mono bg-[#EAF0E6] text-[#2D5A27] px-1.5 py-0.5 rounded shrink-0">{productCode}</span>
                    )}
                    <span className="text-sm font-bold text-gray-800 truncate">{productName}</span>
                    <span className="text-xs text-gray-400 shrink-0">{groupOrders.length}건</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="border-b border-gray-50">
                      <tr>
                        <th className="w-8 px-4 py-2" />
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">주문번호</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">주문일시</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">구매자</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">수령인</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">옵션</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">인플루언서</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-400">금액</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">상태</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {groupOrders.map((o) => (
                        <tr key={o.id} className={`hover:bg-gray-50 transition-colors ${selected.has(o.id) ? "bg-[#EAF0E6]/40" : ""}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOrder(o.id)}
                              className="w-4 h-4 rounded accent-[#2D5A27]" />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            <Link href={`/admin/orders/${o.id}`} className="hover:text-[#2D5A27]">{o.order_number}</Link>{queue==="check"&&<p className="text-xs text-red-600">{dispatchIssues(o).join(" · ")}</p>}
                            <SiteBadge site={o.site} className="ml-1.5 font-sans" />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 text-xs">{o.buyer_name}</div>
                            <div className="text-xs text-gray-400">{o.buyer_phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-700">{o.recipient_name ?? o.buyer_name}</div>
                            <div className="text-xs text-gray-400">{o.recipient_phone ?? o.buyer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {/* 주문의 모든 옵션명 표시 (옵션 없는 상품은 상품명, 2개 이상은 × N) */}
                            {o.items.length === 0
                              ? <span className="text-gray-300">—</span>
                              : o.items.map((it, ii) => (
                                  <div key={ii}>
                                    {it.option_label ?? it.product_name}
                                    {it.quantity > 1 ? ` × ${it.quantity}` : ""}
                                  </div>
                                ))}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {o.influencer_name
                              ? <span className="font-medium text-[#2D5A27]">@{o.influencer_name}</span>
                              : o.link_code
                                ? <span className="font-medium text-amber-700" title={`비밀링크 코드 ${o.link_code}`}>비전시</span>
                                : <span className="text-gray-300">—</span>}
                            {o.influencer_name && o.link_code && (
                              <span className="ml-1 text-amber-700" title={`비밀링크 코드 ${o.link_code}`}>🔗</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                            {Number(o.total_amount).toLocaleString()}원
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {CANCELLABLE.includes(o.status) && (
                              <button onClick={() => handleCancelOne(o)} disabled={acting}
                                className="text-xs text-red-400 hover:text-red-600 font-bold mr-3 disabled:opacity-50">
                                취소
                              </button>
                            )}
                            <Link href={`/admin/orders/${o.id}`} className="text-xs text-[#2D5A27] hover:text-[#244B1F] font-bold">
                              상세
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
