"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneVerifyField from "@/components/PhoneVerifyField";

/**
 * 상품 상세의 리뷰 작성 폼 — 배송완료 구매자만 작성 가능(서버 검증).
 * 비회원은 주문 때 쓴 휴대폰 번호로 문자 인증 후 작성.
 * 사진 첨부: accept="image/*" 라 모바일에선 갤러리/카메라 선택창이 자동으로 뜬다.
 */
export default function ReviewForm({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 3); // 최대 3장
    setFiles(next);
  }

  async function submit() {
    if (rating < 1) { alert("별점을 선택해주세요."); return; }
    if (content.trim().length < 5) { alert("리뷰 내용을 5자 이상 입력해주세요."); return; }
    if (!loggedIn && !phoneVerified) { alert("주문하실 때 쓴 휴대폰 번호로 인증해주세요."); return; }
    setBusy(true);
    try {
      // 1) 사진 업로드
      const urls: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const up = await fetch("/api/reviews/upload", { method: "POST", body: fd });
        const ud = await up.json().catch(() => ({}));
        if (!up.ok) { alert(ud.error || "사진 업로드에 실패했어요."); return; }
        urls.push(ud.url);
      }
      // 2) 리뷰 저장
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, rating, content: content.trim(), images: urls }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "리뷰 등록에 실패했어요."); return; }
      alert("리뷰가 등록되었습니다. 감사합니다!");
      setOpen(false); setRating(0); setContent(""); setFiles([]);
      router.refresh(); // 목록 갱신
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-2xl py-3.5 mb-4 text-sm font-bold transition-colors"
        style={{ border: "1.5px solid var(--accent)", color: "var(--accent)", background: "#fff" }}>
        ✍️ 리뷰 작성하기 (구매자만 가능)
      </button>
    );
  }

  return (
    <div className="rounded-2xl p-5 mb-4 space-y-4" style={{ background: "#fff", border: "1.5px solid var(--accent)" }}>
      {/* 별점 */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)}
            className="text-2xl leading-none" style={{ color: n <= rating ? "#F5A524" : "#D6D6CF" }}
            aria-label={`별점 ${n}점`}>
            ★
          </button>
        ))}
        {rating > 0 && <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{rating}점</span>}
      </div>

      {/* 내용 */}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={1000}
        placeholder="상품은 어떠셨나요? (5자 이상)"
        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
        style={{ border: "1px solid var(--line)" }} />

      {/* 사진 첨부 — 모바일은 갤러리/카메라 자동 연동 */}
      <div>
        <label className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer"
          style={{ border: "1px dashed var(--line)", color: "var(--text-secondary)" }}>
          📷 사진 첨부 ({files.length}/3)
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {files.length > 0 && (
          <div className="flex gap-2 mt-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs leading-none"
                  style={{ background: "#A6412F" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 비회원: 주문 번호로 본인 인증 */}
      {!loggedIn && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            주문하실 때 입력한 휴대폰 번호로 본인 확인이 필요해요.
          </p>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric"
            placeholder="주문 시 연락처 ( - 없이 숫자만 )"
            className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ border: "1px solid var(--line)" }} />
          <PhoneVerifyField phone={phone} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold"
          style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>
          취소
        </button>
        <button type="button" onClick={submit} disabled={busy}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {busy ? "등록 중..." : "리뷰 등록"}
        </button>
      </div>
    </div>
  );
}
