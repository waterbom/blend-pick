"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneVerifyField from "@/components/PhoneVerifyField";

/**
 * 리뷰 작성 폼 — 딥 포레스트 시안 10b 재현.
 * · 별점 호버 미리보기 + 상태 문구, 미선택 시 등록 버튼 비활성
 * · 글자수 카운터(모노), 빠른 입력 칩, 88px 사진 슬롯(0/3, 이모지 없음)
 * · 구매자 확인은 연한 패널로 격하 (비회원만, accept=image/* 로 모바일 카메라 연동)
 */
const INK = "#1C2418", GREEN = "#244B1F", HAIR = "#E4E1D6";
const STAR_HINTS = ["별점을 선택해 주세요", "별로예요", "아쉬워요", "보통이에요", "좋아요", "아주 좋아요"];
const CHIPS = ["아이가 좋아해요", "구성이 알차요", "배송이 빨라요"];

export default function ReviewForm({
  productId, loggedIn, onClose,
}: { productId: string; loggedIn: boolean; onClose?: () => void }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const preview = hover || rating;

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 3));
  }

  async function submit() {
    if (rating < 1) return;
    if (content.trim().length < 5) { alert("리뷰 내용을 5자 이상 입력해주세요."); return; }
    if (!loggedIn && !phoneVerified) { alert("주문 시 입력한 휴대폰 번호로 인증해주세요."); return; }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/reviews/upload", { method: "POST", body: fd });
        const ud = await up.json().catch(() => ({}));
        if (!up.ok) { alert(ud.error || "사진 업로드에 실패했어요."); return; }
        urls.push(ud.url);
      }
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, rating, content: content.trim(), images: urls }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "리뷰 등록에 실패했어요."); return; }
      alert("리뷰가 등록되었습니다. 감사합니다!");
      onClose?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { border: `1px solid ${HAIR}`, borderRadius: 0 } as const;

  return (
    <div className="bg-white p-6 space-y-5" style={{ border: `1px solid ${HAIR}` }}>
      {/* 별점 — 호버 미리보기 + 상태 문구 */}
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
              className="text-[30px] leading-none px-0.5 transition-colors"
              style={{ color: n <= preview ? GREEN : "#D8D4C6" }}
              aria-label={`별점 ${n}점`}>
              ★
            </button>
          ))}
        </div>
        <span className="text-[12.5px]" style={{ color: rating ? "#4A5442" : "#8B927F" }}>
          {STAR_HINTS[preview]}
        </span>
      </div>

      {/* 본문 + 글자수 카운터 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold tracking-[0.14em]" style={{ color: "#7A8B6F" }}>리뷰 내용</span>
          <span className="ds-mono text-[11px]" style={{ color: "#8B927F" }}>{content.length} / 1000</span>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={1000}
          placeholder="어떤 점이 좋았는지, 아쉬웠던 점은 없었는지 알려주세요. (5자 이상)"
          className="w-full px-4 py-3 text-[13.5px] focus:outline-none"
          style={{ ...inputStyle, minHeight: 120, lineHeight: 1.7 }}
          onFocus={(e) => (e.target.style.borderColor = GREEN)}
          onBlur={(e) => (e.target.style.borderColor = HAIR)} />
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {CHIPS.map((c) => (
            <button key={c} type="button"
              onClick={() => setContent((p) => (p ? `${p} ${c}` : c))}
              className="text-[11.5px] px-2.5 py-1.5"
              style={{ border: `1px solid ${HAIR}`, color: "#6B7263", background: "#fff" }}>
              + {c}
            </button>
          ))}
        </div>
      </div>

      {/* 사진 첨부 — 88px 슬롯, 모바일은 갤러리/카메라 자동 연동 */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-bold tracking-[0.14em]" style={{ color: "#7A8B6F" }}>사진 첨부</span>
          <span className="ds-mono text-[11px]" style={{ color: "#8B927F" }}>{files.length}/3</span>
        </div>
        <div className="flex gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative w-[88px] h-[88px]" style={{ border: `1px solid ${HAIR}` }}>
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute top-0 right-0 w-5 h-5 text-white text-[11px] leading-none"
                style={{ background: INK }} aria-label="사진 제거">✕</button>
            </div>
          ))}
          {files.length < 3 && (
            <label className="w-[88px] h-[88px] flex flex-col items-center justify-center cursor-pointer gap-1"
              style={{ border: "1px dashed #C9C4B4", color: "#8B927F" }}>
              <span className="text-lg leading-none">+</span>
              <span className="text-[10.5px]">사진 추가</span>
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
            </label>
          )}
          {Array.from({ length: Math.max(0, 2 - files.length) }).map((_, i) => (
            <div key={i} className="w-[88px] h-[88px]" style={{ border: `1px solid #EEEBE1` }} />
          ))}
        </div>
      </div>

      {/* 구매자 확인 — 비회원만, 연한 패널 */}
      {!loggedIn && (
        <div className="p-4 space-y-2" style={{ background: "#F6F4EE" }}>
          <p className="text-[11px] font-bold tracking-[0.14em]" style={{ color: "#7A8B6F" }}>구매자 확인</p>
          <p className="text-[12px]" style={{ color: "#6B7263" }}>주문 시 입력한 휴대폰 번호로 본인 확인이 필요해요</p>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric"
            placeholder="01012345678"
            className="w-full px-3.5 ds-mono text-[13px] bg-white focus:outline-none"
            style={{ ...inputStyle, height: 44 }} />
          <PhoneVerifyField phone={phone} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
        </div>
      )}

      {/* 하단 버튼 — 취소 1 : 등록 1.4, 별점 미선택 시 비활성 */}
      <div className="flex gap-2">
        <button type="button" onClick={onClose}
          className="flex-1 text-[13.5px] font-semibold"
          style={{ height: 52, border: `1px solid ${HAIR}`, color: "#6B7263", background: "#fff" }}>
          취소
        </button>
        <button type="button" onClick={submit} disabled={rating < 1 || busy}
          className="text-[13.5px] font-bold"
          style={{
            height: 52, flex: 1.4,
            background: rating < 1 ? "#DDD9CC" : GREEN,
            color: rating < 1 ? "#8B927F" : "#fff",
            cursor: rating < 1 ? "default" : "pointer",
          }}>
          {busy ? "등록 중..." : "리뷰 등록"}
        </button>
      </div>
    </div>
  );
}
