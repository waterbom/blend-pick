"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ orders: DetailOrder[]; reviewCount: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const loadRequest = useRef(0), detailRequest = useRef(0), acting = useRef(false);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    ++detailRequest.current;
    setExpanded(null); setDetail(null); setDetailError("");
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (role) p.set("role", role);
      if (status) p.set("status", status);
      if (pendingOnly) p.set("pending", "1");
      const d = await readApiJson(await fetch(`/api/admin/members?${p}`), "회원 목록을 불러오지 못했습니다.");
      if (request !== loadRequest.current) return;
      setMembers(Array.isArray(d.members) ? d.members : []);
      setSummary(d.summary ?? null);
    } catch (error) {
      if (request !== loadRequest.current) return;
      setMembers([]); setSummary(null); setError(apiErrorMessage(error));
    } finally { if (request === loadRequest.current) setLoading(false); }
  }, [q, role, status, pendingOnly]);

  useEffect(() => { load(); }, [role, status, pendingOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { ++loadRequest.current; ++detailRequest.current; }, []);

  async function toggleExpand(id: string, retry = false) {
    const request = ++detailRequest.current;
    if (expanded === id && !retry) { setExpanded(null); setDetail(null); return; }
    setExpanded(id); setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const data = await readApiJson(await fetch(`/api/admin/members/${id}`), "회원 정보를 불러오지 못했습니다.");
      if (request === detailRequest.current) setDetail(data);
    } catch (error) {
      if (request === detailRequest.current) setDetailError(apiErrorMessage(error));
    } finally { if (request === detailRequest.current) setDetailLoading(false); }
  }

  async function act(m: Member, action: string, extra: Record<string, unknown> = {}, confirmMsg?: string) {
    if (acting.current || (confirmMsg && !confirm(confirmMsg))) return;
    acting.current = true; setActingId(m.id);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, action, ...extra }),
      });
      await readApiJson(res, "처리에 실패했어요.");
      await load();
    } catch (error) { alert(apiErrorMessage(error)); }
    finally { acting.current = false; setActingId(null); }
  }

  const displayName = (m: Member) => m.nickname || m.name || "(이름 없음)";
  return <div className="ops-workspace">
    <header className="ops-page-heading"><div><h1>회원 관리</h1><p>심사 승인과 계정 관리를 목록에서 바로 처리하세요.</p></div>
      <button className="ops-button" onClick={load} disabled={loading || !!actingId}>새로고침</button>
    </header>
    {summary && !loading && <div className="ops-summary-grid">
      <div><span>전체 회원</span><strong>{summary.total.toLocaleString()}<small>명</small></strong><small>두 스토어 공통</small></div>
      <div><span>이번 달 신규</span><strong>{summary.new_month.toLocaleString()}<small>명</small></strong><small>가입일 기준</small></div>
      <button aria-pressed={pendingOnly} onClick={() => { setQ(""); setRole(""); setStatus(""); setPendingOnly(!pendingOnly); }}><span>신청 심사 대기</span><strong>{summary.pending.toLocaleString()}<small>명</small></strong><small>{pendingOnly ? "전체로 돌아가기" : "대기 회원 보기 →"}</small></button>
      <div><span>최근 30일 구매 회원</span><strong>{summary.buyers30.toLocaleString()}<small>명</small></strong><small>현재 스토어 기준</small></div>
    </div>}
    <section className="ops-list-panel" aria-label="회원 목록">
      <form className="ops-toolbar" onSubmit={e => { e.preventDefault(); load(); }}>
        <input className="ops-search" aria-label="회원 검색" value={q} onChange={e => setQ(e.target.value)} placeholder="이름·닉네임·이메일 검색" />
        <button type="submit" className="ops-button ops-button-primary" disabled={!!actingId}>검색</button>
        <select aria-label="회원 역할 필터" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">역할 전체</option><option value="customer">일반</option><option value="influencer">인플루언서</option><option value="vendor">벤더</option>
        </select>
        <select aria-label="계정 상태 필터" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">상태 전체</option><option value="active">활성</option><option value="inactive">비활성</option>
        </select>
        <label className="ops-check"><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />심사 대기만</label>
      </form>
      {loading ? <p className="ops-empty" role="status">회원 목록 불러오는 중…</p>
      : error ? <div className="ops-error" role="alert">{error} <button className="ops-button" onClick={load}>다시 조회</button></div>
      : <>
        <div className="ops-sales-summary"><strong>{members.length}명 표시</strong><span>구매·취소·교환반품은 현재 스토어 기준</span><small>검색 조건별 최근 최대 500명</small></div>
        {members.length === 0 ? <p className="ops-empty">조건에 맞는 회원이 없습니다</p> : <div className="ops-table-scroll"><table className="ops-table ops-members-table">
          <thead><tr>{["회원 · 가입일", "역할 · 심사", "구매 활동", "취소 · 교환반품", "계정 상태", "처리"].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{members.map(m => {
            const isOpen = expanded === m.id, busy = !!actingId;
            return [<tr key={m.id} data-selected={isOpen}>
              <td><div className="ops-member-identity">
                {m.profile_image && <img src={m.profile_image} alt="" width={30} height={30} />}
                <div><strong>{displayName(m)}</strong><span className="ops-meta">{m.email || (m.via_kakao ? "카카오 가입" : "이메일 없음")}</span>
                  <span className="ops-meta">가입 {m.joined_at ?? "미상"}{m.joined_estimated && <abbr title="가입일 미상 — 첫 주문일로 표시">*</abbr>}</span></div>
              </div></td>
              <td><select aria-label={`${displayName(m)} 역할 변경`} value={m.role} disabled={busy} className="ops-cell-select"
                onChange={e => act(m, "set_role", { role: e.target.value }, `역할을 "${ROLE_BADGE[e.target.value]?.label}"(으)로 변경할까요?`)}>
                <option value="customer">일반</option><option value="influencer">인플루언서</option><option value="vendor">벤더</option>
              </select>{m.role_status === "pending" && <span className="ops-meta ops-warning">신청 심사 중</span>}</td>
              <td><strong>{m.spent.toLocaleString()}원</strong><span className="ops-meta">주문 {m.orders}건 · 최근 {m.last_order_at ?? "없음"}</span></td>
              <td><span>취소 {m.cancels}건</span><span className="ops-meta">교환·반품 {m.returns}건</span></td>
              <td><span className={`ops-status ${m.is_active === false ? "ops-status-cancelled" : "ops-status-selling"}`}>{m.is_active === false ? "비활성" : "활성"}</span>
                <button disabled={busy} className="ops-text-button ops-account-toggle" onClick={() => act(m, m.is_active === false ? "activate" : "deactivate", {}, m.is_active === false ? "계정을 다시 활성화할까요?" : `${displayName(m)} 계정을 비활성화할까요?\n비활성화하면 로그인이 차단됩니다.`)}>{m.is_active === false ? "계정 활성화" : "계정 비활성화"}</button></td>
              <td><div className="ops-member-actions">
                {m.role_status === "pending" && <><button className="ops-button ops-button-primary" disabled={busy} onClick={() => act(m, "approve", {}, `${displayName(m)}의 신청을 승인할까요?`)}>신청 승인</button><button className="ops-text-button" disabled={busy} onClick={() => act(m, "reject", {}, `${displayName(m)}의 신청을 반려할까요?`)}>신청 반려</button></>}
                <button className="ops-text-button" aria-expanded={isOpen} aria-controls={`member-history-${m.id}`} onClick={() => toggleExpand(m.id)}>{isOpen ? "이력 닫기" : "주문 이력"}</button>
              </div></td>
            </tr>, isOpen && <tr key={`${m.id}-detail`}><td colSpan={6} id={`member-history-${m.id}`} className="ops-member-history">
              {detailLoading ? <p role="status">주문 이력 불러오는 중…</p> : detailError ? <p role="alert" className="ops-error">{detailError} <button className="ops-button" onClick={() => toggleExpand(m.id, true)}>다시 조회</button></p> : <>
                <strong>{displayName(m)} · 최근 주문 {detail?.orders.length ?? 0}건 · 리뷰 {detail?.reviewCount ?? 0}개</strong>
                {detail?.orders.length ? detail.orders.map(o => <p key={o.order_number}><span>{o.paid_date ?? "미결제"} · {o.order_number}</span> {o.product_name ?? (o.order_type === "hotel" ? "호텔 예약" : "상품명 없음")}{o.item_count > 1 && ` 외 ${o.item_count - 1}건`} · {Number(o.total_amount).toLocaleString()}원 · {ORDER_STATUS[o.status] ?? o.status}</p>) : <p>주문 이력이 없어요</p>}
              </>}
            </td></tr>];
          })}</tbody>
        </table></div>}
      </>}
    </section>
    <p className="ops-meta">회원 계정·역할은 블랜드픽과 산지픽 공통입니다. * 가입일 기록이 없는 회원은 첫 주문일로 표시합니다. 인플루언서 프로필·요율은 인플루언서 관리에서 설정합니다.</p>
  </div>;
}
