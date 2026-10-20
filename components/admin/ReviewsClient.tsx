"use client";
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';

import { useEffect, useRef, useState } from "react";

interface Review {
  id: string;
  product_id: string | null;
  product_name: string | null;
  product_code: string | null;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  is_hidden: boolean;
  created_at: string;
}

const TABS = [
  { key: "", label: "전체" },
  { key: "visible", label: "표시 중" },
  { key: "hidden", label: "숨김" },
] as const;

export default function ReviewsClient() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<string>("");
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("");
  const [photosOnly, setPhotosOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busy = useRef(false), loadRequest = useRef(0);

  async function load() {
    const request = ++loadRequest.current;
    setLoading(true); setError("");
    try {
      const data = await readApiJson(await fetch("/api/admin/reviews"), "리뷰를 불러오지 못했습니다.");
      if (request === loadRequest.current) setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      if (request === loadRequest.current) { setRows([]); setError(apiErrorMessage(error)); }
    } finally { if (request === loadRequest.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { ++loadRequest.current; }; }, []);
  useEffect(() => { setPage(1); }, [tab, query, rating, photosOnly]);

  async function toggleHidden(rv: Review) {
    if (busy.current) return;
    busy.current = true; setBusyId(rv.id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rv.id, is_hidden: !rv.is_hidden }),
      });
      await readApiJson(res, "리뷰 상태 변경에 실패했습니다.");
      setRows(prev => prev.map(x => x.id === rv.id ? { ...x, is_hidden: !rv.is_hidden } : x));
    } catch (error) { alert(apiErrorMessage(error)); }
    finally { busy.current = false; setBusyId(null); }
  }

  async function remove(rv: Review) {
    if (busy.current || !confirm("이 리뷰를 삭제할까요? 되돌릴 수 없어요.\n(부적절한 내용이 아니라면 삭제보다 숨김을 권장)")) return;
    busy.current = true; setBusyId(rv.id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rv.id }),
      });
      await readApiJson(res, "리뷰 삭제에 실패했습니다.");
      setRows(prev => prev.filter(x => x.id !== rv.id));
    } catch (error) { alert(apiErrorMessage(error)); }
    finally { busy.current = false; setBusyId(null); }
  }

  const q = query.trim().toLowerCase();
  const visible = rows.filter(r => {
    if (tab === "visible" && r.is_hidden || tab === "hidden" && !r.is_hidden) return false;
    if (rating === "low" ? r.rating > 2 : rating && r.rating !== Number(rating)) return false;
    if (photosOnly && !r.images?.length) return false;
    return !q || [r.product_name, r.product_code, r.buyer_name, r.content].some(v => v?.toLowerCase().includes(q));
  });
  const hidden = rows.filter(r => r.is_hidden).length;
  const pages = Math.max(1, Math.ceil(visible.length / 25)), current = Math.min(page, pages);
  const paged = visible.slice((current - 1) * 25, current * 25);
  return <div className="ops-workspace">
    <header className="ops-page-heading"><div><h1>리뷰 관리</h1><p>상품·작성자·내용을 검색하고 공개 상태를 바로 관리하세요.</p></div>
      <button className="ops-button" onClick={load} disabled={loading || !!busyId}>새로고침</button>
    </header>
    <section className="ops-list-panel" aria-label="리뷰 목록">
      <div className="ops-filter-strip">{TABS.map(t => <button key={t.key} className="ops-filter-chip" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{t.label} <b>{loading || error ? "—" : t.key === "hidden" ? hidden : t.key === "visible" ? rows.length - hidden : rows.length}</b></button>)}</div>
      <div className="ops-toolbar">
        <input className="ops-search" aria-label="리뷰 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="상품명·상품코드·작성자·리뷰 내용 검색" />
        <select aria-label="별점 필터" value={rating} onChange={e => setRating(e.target.value)}><option value="">별점 전체</option><option value="low">낮은 별점 (1–2점)</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n}점</option>)}</select>
        <label className="ops-check"><input type="checkbox" checked={photosOnly} onChange={e => setPhotosOnly(e.target.checked)} />사진 리뷰만</label>
        {(query || rating || photosOnly || tab) && <button className="ops-text-button" onClick={() => { setQuery(""); setRating(""); setPhotosOnly(false); setTab(""); }}>필터 초기화</button>}
      </div>
      {loading ? <p role="status" className="ops-empty">리뷰 불러오는 중…</p> : error ? <div role="alert" className="ops-error">{error} <button className="ops-button" onClick={load}>다시 조회</button></div> : <>
        <div className="ops-sales-summary"><strong>조건에 맞는 리뷰 {visible.length}건</strong><small>최근 최대 300건 안에서 검색 · 작성일 최신순</small></div>
        {visible.length === 0 ? <p className="ops-empty">조건에 맞는 리뷰가 없습니다</p> : <div className="ops-review-list">{paged.map(rv => <article key={rv.id} className="ops-review-row" data-hidden={rv.is_hidden} aria-label={`${rv.buyer_name}의 리뷰`}>
          <div className="ops-review-product"><strong>{rv.product_name || "(삭제된 상품)"}</strong>{rv.product_code && <span className="ops-meta">{rv.product_code}</span>}<span className="ops-meta">{rv.buyer_name} · {new Date(rv.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span></div>
          <div className="ops-review-copy"><span className="ops-rating" aria-label={`별점 ${rv.rating}점`}>{"★".repeat(Math.max(0, Math.min(5, Math.round(rv.rating))))}<small>{rv.rating} / 5</small></span><p>{rv.content}</p>
            {!!rv.images?.length && <div className="ops-review-images">{rv.images.map((src, i) => <a key={i} href={src} target="_blank" rel="noopener noreferrer" aria-label={`리뷰 사진 ${i + 1} 크게 보기`}><img src={src} alt={`리뷰 사진 ${i + 1}`} width={52} height={52} loading="lazy" /></a>)}</div>}
          </div>
          <div className="ops-review-actions"><span className={`ops-status ${rv.is_hidden ? "ops-status-cancelled" : "ops-status-selling"}`}>{rv.is_hidden ? "숨김" : "표시 중"}</span>
            <button disabled={!!busyId} className="ops-button" onClick={() => toggleHidden(rv)}>{busyId === rv.id ? "처리 중…" : rv.is_hidden ? "숨김 해제" : "숨기기"}</button>
            <button disabled={!!busyId} className="ops-text-button ops-danger-text" onClick={() => remove(rv)}>삭제</button>
          </div>
        </article>)}</div>}
        {pages > 1 && <nav className="ops-pagination" aria-label="리뷰 페이지"><button className="ops-button" disabled={current === 1} onClick={() => setPage(current - 1)}>이전</button><span>{current} / {pages} 페이지</span><button className="ops-button" disabled={current === pages} onClick={() => setPage(current + 1)}>다음</button></nav>}
      </>}
    </section>
  </div>;
}
