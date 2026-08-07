"use client";

import { useCallback, useEffect, useState } from "react";

interface Member {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string | null;
  role: string;
  role_status: string | null;
  is_active: boolean | null;
  profile_image: string | null;
  via_kakao: boolean;
  joined_at: string | null;
  joined_estimated: boolean;
  orders: number;
  spent: number;
  cancels: number;
  returns: number;
  last_order_at: string | null;
}

interface Summary { total: number; new_month: number; influencers: number; pending: number; buyers30: number }

interface DetailOrder {
  order_number: string; status: string; order_type: string; total_amount: number;
  paid_date: string | null; product_name: string | null; item_count: number;
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  customer:   { label: "일반",       cls: "bg-gray-100 text-gray-600" },
  influencer: { label: "인플루언서", cls: "bg-orange-50 text-orange-600" },
  vendor:     { label: "벤더",       cls: "bg-blue-50 text-blue-600" },
};

const ORDER_STATUS: Record<string, string> = {
  paid: "결제완료", confirmed: "주문확인", preparing: "배송준비", shipped: "배송중",
  delivered: "배송완료", cancelled: "취소", cancel_requested: "취소요청",
  exchange_requested: "교환신청", exchange_completed: "교환완료",
  return_requested: "반품신청", return_completed: "반품완료",
  checked_in: "체크인", no_show: "노쇼", awaiting: "예약대기",
};

export default function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ orders: DetailOrder[]; reviewCount: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (role) p.set("role", role);
      if (status) p.set("status", status);
      if (pendingOnly) p.set("pending", "1");
      const res = await fetch(`/api/admin/members?${p}`);
      const d = await res.json();
      setMembers(Array.isArray(d.members) ? d.members : []);
      if (d.summary) setSummary(d.summary);
    } finally {
      setLoading(false);
    }
  }, [q, role, status, pendingOnly]);

  useEffect(() => { load(); }, [role, status, pendingOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    setExpanded(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${id}`);
      setDetail(await res.json());
    } finally {
      setDetailLoading(false);
    }
  }

  async function act(m: Member, action: string, extra: Record<string, unknown> = {}, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setActingId(m.id);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { alert(d.error || "처리에 실패했어요."); return; }
      await load();
    } catch {
      alert("네트워크 문제로 요청이 전달되지 않았어요.");
    } finally {
      setActingId(null);
    }
  }

  const displayName = (m: Member) => m.nickname || m.name || "(이름 없음)";

  return (
    <div>
      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
          {[
            ["전체 회원", summary.total],
            ["이번 달 신규", summary.new_month],
            ["인플루언서", summary.influencers],
            ["가입 심사 중", summary.pending],
            ["최근 30일 구매", summary.buyers30],
          ].map(([label, val]) => (
            <div key={String(label)} className="bg-white border border-gray-100 rounded-none px-4 py-3">
              <p className="text-[11px] text-gray-400 m-0">{label}</p>
              <p className="text-lg font-bold text-gray-800 m-0 ds-mono">{Number(val).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* 검색·필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·닉네임·이메일 검색"
            className="border border-gray-200 rounded-none px-3 py-2 text-sm w-56 focus:outline-none focus:border-[#C7D6C0]" />
          <button type="submit" className="bg-[#1A1D18] text-white text-xs font-bold px-4 rounded-none">검색</button>
        </form>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="border border-gray-200 rounded-none px-2 py-2 text-xs bg-white">
          <option value="">역할 전체</option>
          <option value="customer">일반</option>
          <option value="influencer">인플루언서</option>
          <option value="vendor">벤더</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-none px-2 py-2 text-xs bg-white">
          <option value="">상태 전체</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)}
            className="w-4 h-4 accent-[#2D5A27]" />
          심사 중만
        </label>
        <span className="text-xs text-gray-400 ml-auto">{members.length}명 표시</span>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="bg-white border border-gray-100 p-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : members.length === 0 ? (
        <div className="bg-white border border-gray-100 p-16 text-center text-sm text-gray-400">조건에 맞는 회원이 없습니다</div>
      ) : (
        <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                {["회원", "역할", "가입", "주문", "누적 구매액", "취소·반품", "최근 주문", "상태", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => {
                const rb = ROLE_BADGE[m.role] ?? ROLE_BADGE.customer;
                const isOpen = expanded === m.id;
                return [
                  <tr key={m.id} onClick={() => toggleExpand(m.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${isOpen ? "bg-[#EAF0E6]/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 shrink-0 overflow-hidden bg-gray-100 border border-gray-100">
                          {m.profile_image
                            ? /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-sm text-gray-300">👤</div>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 m-0 truncate">{displayName(m)}</p>
                          <p className="text-[11px] text-gray-400 m-0 truncate">{m.via_kakao ? "카카오" : m.email || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 ${rb.cls}`}>{rb.label}</span>
                      {m.role_status === "pending" && (
                        <span className="ml-1 text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700">심사 중</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {m.joined_at ?? "-"}{m.joined_estimated && <span className="text-gray-300" title="가입일 미상 — 첫 주문일로 표시">*</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 ds-mono">{m.orders}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800 ds-mono whitespace-nowrap">{m.spent.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {m.cancels + m.returns > 0
                        ? <span className="text-orange-500">취소 {m.cancels} · 반품 {m.returns}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{m.last_order_at ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.is_active === false
                        ? <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-500">비활성</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700">활성</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</td>
                  </tr>,
                  isOpen && (
                    <tr key={`${m.id}-detail`}>
                      <td colSpan={9} className="px-6 py-4" style={{ background: "#FAFAF6" }}>
                        {/* 액션 */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {m.role_status === "pending" && (
                            <>
                              <button disabled={actingId === m.id}
                                onClick={(e) => { e.stopPropagation(); act(m, "approve", {}, `${displayName(m)}의 ${ROLE_BADGE[m.role]?.label ?? m.role} 신청을 승인할까요?`); }}
                                className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-xs font-bold px-4 py-2 rounded-none disabled:opacity-50">
                                신청 승인
                              </button>
                              <button disabled={actingId === m.id}
                                onClick={(e) => { e.stopPropagation(); act(m, "reject", {}, "신청을 반려할까요?"); }}
                                className="border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold px-4 py-2 rounded-none disabled:opacity-50">
                                신청 반려
                              </button>
                            </>
                          )}
                          <select value={m.role} disabled={actingId === m.id}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => act(m, "set_role", { role: e.target.value }, `역할을 "${ROLE_BADGE[e.target.value]?.label}"(으)로 변경할까요?`)}
                            className="border border-gray-200 rounded-none px-2 py-1.5 text-xs bg-white">
                            <option value="customer">일반</option>
                            <option value="influencer">인플루언서</option>
                            <option value="vendor">벤더</option>
                          </select>
                          {m.is_active === false ? (
                            <button disabled={actingId === m.id}
                              onClick={(e) => { e.stopPropagation(); act(m, "activate", {}, "계정을 다시 활성화할까요?"); }}
                              className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold px-4 py-2 rounded-none disabled:opacity-50">
                              계정 활성화
                            </button>
                          ) : (
                            <button disabled={actingId === m.id}
                              onClick={(e) => { e.stopPropagation(); act(m, "deactivate", {}, `${displayName(m)} 계정을 비활성화할까요?\n비활성화하면 로그인이 차단됩니다.`); }}
                              className="border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold px-4 py-2 rounded-none disabled:opacity-50">
                              계정 비활성화
                            </button>
                          )}
                          {m.role === "influencer" && (
                            <span className="text-[11px] text-gray-400 self-center">
                              인플루언서 프로필·요율은 인플루언서 관리에서 연결·설정해요
                            </span>
                          )}
                        </div>
                        {/* 최근 주문 */}
                        {detailLoading ? (
                          <p className="text-xs text-gray-400 m-0">주문 이력 불러오는 중...</p>
                        ) : detail && detail.orders.length > 0 ? (
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 mb-1.5">
                              최근 주문 {detail.orders.length}건 · 리뷰 {detail.reviewCount}개
                            </p>
                            <div className="space-y-1">
                              {detail.orders.map((o) => (
                                <p key={o.order_number} className="text-xs text-gray-600 m-0">
                                  <span className="ds-mono text-gray-400">{o.paid_date}</span>{" "}
                                  <span className="ds-mono">{o.order_number}</span>{" "}
                                  {o.product_name ?? (o.order_type === "hotel" ? "호텔 예약" : "-")}
                                  {o.item_count > 1 && ` 외 ${o.item_count - 1}건`}{" · "}
                                  <span className="ds-mono">{Number(o.total_amount).toLocaleString()}원</span>{" "}
                                  <span className="text-gray-400">({ORDER_STATUS[o.status] ?? o.status})</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 m-0">주문 이력이 없어요</p>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2">* 표시는 가입일 기록이 없는 기존 회원 — 첫 주문일로 대신 표시해요</p>
    </div>
  );
}
