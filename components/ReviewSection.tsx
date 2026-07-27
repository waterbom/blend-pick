"use client";

import { useMemo, useState } from "react";
import ReviewForm from "@/components/ReviewForm";

/**
 * 상품 상세 리뷰 섹션 — 딥 포레스트 시안 10a(목록)/10b(작성 폼·빈 상태) 재현.
 * radius 0 · 헤어라인 보더 · serif 타이틀 · 모노 숫자. 평점 요약 → 포토 스트립 → 정렬 → 카드.
 */
export interface ReviewItem {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  created_at: string;
  option_label?: string | null;
  helpful_count?: number;
}
export interface ReviewSummary {
  total: number;
  average: number;
  distribution: number[]; // [1점, 2점, 3점, 4점, 5점]
  photoCount: number;
}

const INK = "#1C2418", GREEN = "#244B1F", HAIR = "#E4E1D6", SAGE = "#7A8B6F";
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const SORTS = ["최신순", "평점 높은순", "도움된순"] as const;

export default function ReviewSection({
  productId, loggedIn, reviews, summary,
}: {
  productId: string; loggedIn: boolean; reviews: ReviewItem[]; summary: ReviewSummary;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useState<(typeof SORTS)[number]>("최신순");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [shown, setShown] = useState(3);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [helped, setHelped] = useState<Record<string, number>>({});

  const allPhotos = useMemo(() => reviews.flatMap((r) => r.images || []), [reviews]);
  // 베스트: 도움돼요 1 이상 중 최다 리뷰 1건
  const bestId = useMemo(() => {
    const top = [...reviews].sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0))[0];
    return top && (top.helpful_count || 0) > 0 ? top.id : null;
  }, [reviews]);

  const list = useMemo(() => {
    let l = photoOnly ? reviews.filter((r) => r.images && r.images.length > 0) : [...reviews];
    if (sort === "평점 높은순") l.sort((a, b) => b.rating - a.rating);
    else if (sort === "도움된순") l.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
    return l;
  }, [reviews, sort, photoOnly]);

  async function markHelpful(id: string) {
    const key = `rv_help_${id}`;
    if (typeof window !== "undefined" && localStorage.getItem(key)) return; // 중복 방지
    const res = await fetch("/api/reviews/helpful", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.setItem(key, "1");
      setHelped((p) => ({ ...p, [id]: d.helpful_count }));
    }
  }

  return (
    <div id="review">
      {/* 섹션 헤더 */}
      <div className="flex items-end justify-between pb-3 mb-6" style={{ borderBottom: `2px solid ${INK}` }}>
        <div className="flex items-baseline gap-2">
          <h2 className="ds-serif text-xl font-semibold" style={{ color: INK }}>리뷰</h2>
          <span className="ds-mono text-[13px]" style={{ color: SAGE }}>{summary.total}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] hidden sm:inline" style={{ color: "#8B927F" }}>구매하신 분만 작성할 수 있어요</span>
          <button onClick={() => setFormOpen((v) => !v)}
            className="text-[13px] font-bold px-5 py-2.5 text-white"
            style={{ background: GREEN }}>
            리뷰 작성
          </button>
        </div>
      </div>

      {/* 작성 폼 (10b) */}
      {formOpen && (
        <div className="mb-8">
          <ReviewForm productId={productId} loggedIn={loggedIn} onClose={() => setFormOpen(false)} />
        </div>
      )}

      {summary.total === 0 ? (
        /* 빈 상태 */
        <div className="text-center" style={{ border: `1px solid ${HAIR}`, padding: "56px 32px" }}>
          <p className="text-xl mb-3 tracking-[0.2em]" style={{ color: "#D8D4C6" }}>☆☆☆☆☆</p>
          <p className="ds-serif text-lg font-semibold mb-2" style={{ color: INK }}>첫 번째 리뷰를 남겨주세요</p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: "#8B927F" }}>
            이 상품을 구매하신 분들의 후기가 아직 없습니다.<br />작성해주신 리뷰는 다음 공구를 준비하는 데 큰 도움이 됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 평점 요약 */}
          <div className="grid sm:grid-cols-[240px_1fr] gap-px mb-6" style={{ background: HAIR, border: `1px solid ${HAIR}` }}>
            <div className="bg-white p-6 flex flex-col justify-center">
              <p className="text-[44px] leading-none font-bold" style={{ color: INK }}>{summary.average.toFixed(1)}</p>
              <p className="text-sm mt-2" style={{ color: GREEN }}>{stars(Math.round(summary.average))}</p>
              <p className="text-[11.5px] mt-2" style={{ color: "#8B927F" }}>{summary.total}개 리뷰 · 구매자 인증 100%</p>
            </div>
            <div className="bg-white p-6 flex flex-col justify-center gap-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[n - 1] || 0;
                const pct = summary.total ? (count / summary.total) * 100 : 0;
                return (
                  <div key={n} className="grid items-center gap-3" style={{ gridTemplateColumns: "34px 1fr 34px" }}>
                    <span className="ds-mono text-[11px]" style={{ color: "#6B7263" }}>{n}점</span>
                    <div style={{ height: 6, background: "#EEEBE1" }}>
                      <div style={{ height: 6, width: `${pct}%`, background: n >= 4 ? GREEN : "#A8BC94" }} />
                    </div>
                    <span className="ds-mono text-[11px] text-right" style={{ color: "#6B7263" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 포토 리뷰 스트립 */}
          {allPhotos.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-[0.14em]" style={{ color: SAGE }}>포토 리뷰 {summary.photoCount}</span>
                <button onClick={() => setPhotoOnly(true)} className="text-[11.5px]" style={{ color: "#4A5442" }}>전체 보기 →</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-px" style={{ background: HAIR, border: `1px solid ${HAIR}` }}>
                {allPhotos.slice(0, allPhotos.length > 6 ? 5 : 6).map((p, i) => (
                  <button key={i} onClick={() => setLightbox(p)} className="block h-[120px] bg-white"
                    style={{ backgroundImage: `url(${p})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    aria-label={`포토 리뷰 ${i + 1}`} />
                ))}
                {allPhotos.length > 6 && (
                  <button onClick={() => setPhotoOnly(true)} className="h-[120px] flex items-center justify-center ds-mono text-[13px]"
                    style={{ background: "#F6F4EE", color: "#4A5442" }}>
                    +{allPhotos.length - 5} 더 보기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 정렬·필터 바 */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3" style={{ borderBottom: `1px solid ${HAIR}` }}>
            <div className="flex">
              {SORTS.map((s, i) => (
                <button key={s} onClick={() => setSort(s)}
                  className="text-[12px] font-semibold px-3.5 py-2"
                  style={{
                    border: "1px solid", marginLeft: i > 0 ? -1 : 0,
                    background: sort === s ? INK : "#fff",
                    color: sort === s ? "#fff" : "#6B7263",
                    borderColor: sort === s ? INK : HAIR,
                  }}>
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[12px] cursor-pointer" style={{ color: "#4A5442" }}>
              <input type="checkbox" checked={photoOnly} onChange={(e) => setPhotoOnly(e.target.checked)}
                style={{ accentColor: GREEN, borderRadius: 0 }} />
              사진 있는 리뷰만
            </label>
          </div>

          {/* 리뷰 카드 */}
          {list.slice(0, shown).map((r) => {
            const helpCount = helped[r.id] ?? r.helpful_count ?? 0;
            return (
              <div key={r.id} className="flex gap-5" style={{ borderBottom: `1px solid ${HAIR}`, padding: "26px 0" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px]" style={{ color: GREEN }}>{stars(r.rating)}</span>
                    {r.id === bestId && (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5" style={{ background: "#EAF0E6", color: GREEN }}>베스트</span>
                    )}
                  </div>
                  <p className="text-[11.5px] mb-2" style={{ color: "#8B927F" }}>
                    <span className="font-semibold" style={{ color: "#4A5442" }}>{r.buyer_name}</span>
                    {" · "}<span className="ds-mono">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                    {r.option_label ? <>{" · "}{r.option_label}</> : null}
                  </p>
                  <p className="text-[13.5px] whitespace-pre-wrap" style={{ color: "#2A3126", lineHeight: 1.75, maxWidth: 640 }}>{r.content}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={() => markHelpful(r.id)}
                      className="text-[11.5px] px-3 py-1.5 transition-colors"
                      style={{ border: `1px solid ${HAIR}`, color: "#4A5442", background: "#fff" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = GREEN)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = HAIR)}>
                      도움돼요 {helpCount > 0 ? helpCount : ""}
                    </button>
                    <a href="http://pf.kakao.com/_VyING/chat" target="_blank" rel="noopener noreferrer"
                      className="text-[11.5px]" style={{ color: "#B4B0A2" }}>신고</a>
                  </div>
                </div>
                {r.images && r.images.length > 0 && (
                  <div className="shrink-0 w-24">
                    <button onClick={() => setLightbox(r.images![0])} className="block w-24 h-24"
                      style={{ backgroundImage: `url(${r.images[0]})`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${HAIR}` }}
                      aria-label="리뷰 사진 보기" />
                    <p className="ds-mono text-[10.5px] mt-1 text-center" style={{ color: "#8B927F" }}>사진 {r.images.length}장</p>
                  </div>
                )}
              </div>
            );
          })}

          {list.length > shown && (
            <div className="text-center mt-6">
              <button onClick={() => setShown((n) => n + 10)}
                className="text-[13px] font-semibold px-8 py-3"
                style={{ border: `1px solid ${HAIR}`, color: "#4A5442", background: "#fff" }}>
                리뷰 더 보기 ({summary.total}개 중 {Math.min(shown, list.length)}개)
              </button>
            </div>
          )}
        </>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(28,36,24,.88)" }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="리뷰 사진" className="max-w-full max-h-[85vh] object-contain" />
          <button className="absolute top-5 right-6 text-white text-2xl" aria-label="닫기">✕</button>
        </div>
      )}
    </div>
  );
}
