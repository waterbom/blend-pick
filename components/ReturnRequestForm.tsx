"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RETURN_REASONS, SELLER_FAULT_REASONS, type ReturnItem } from "@/lib/returns";

// 교환·반품 신청 폼 — 상품·수량 선택 → 사유 → 사진(선택) → 수거지 → 배송비 동의 → 접수
export default function ReturnRequestForm({
  orderId,
  items,
  defaultAddress,
  defaultAddressDetail,
  doneHref = "/mypage",
}: {
  orderId: string;
  items: ReturnItem[];
  defaultAddress: string;
  defaultAddressDetail: string;
  doneHref?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"exchange" | "return">("exchange");
  const [qty, setQty] = useState<Record<string, number>>({}); // item_id → 신청 수량 (0 = 미선택)
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState(defaultAddress);
  const [addressDetail, setAddressDetail] = useState(defaultAddressDetail);
  const [feeAgreed, setFeeAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sellerFault = SELLER_FAULT_REASONS.includes(reason);
  const selectedCount = Object.values(qty).filter((n) => n > 0).length;

  function toggleItem(it: ReturnItem) {
    setQty((p) => ({ ...p, [it.item_id]: p[it.item_id] ? 0 : it.quantity }));
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (photos.length + files.length > 5) {
      alert("사진은 최대 5장까지 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/orders/return-upload", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { alert(d.error || "사진 업로드에 실패했어요."); break; }
        setPhotos((p) => [...p, d.url]);
      }
    } catch {
      alert("네트워크 문제로 사진이 업로드되지 않았어요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (selectedCount === 0) { alert("교환·반품할 상품을 선택해주세요."); return; }
    if (!reason) { alert("사유를 선택해주세요."); return; }
    if (reason === "기타" && !detail.trim()) { alert("기타 사유는 상세 내용을 입력해주세요."); return; }
    if (!address.trim()) { alert("수거지 주소를 입력해주세요."); return; }
    if (!sellerFault && !feeAgreed) { alert("배송비 부담 동의에 체크해주세요."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          items: Object.entries(qty)
            .filter(([, n]) => n > 0)
            .map(([item_id, quantity]) => ({ item_id, quantity })),
          reason,
          detail,
          photos,
          pickup_address: address,
          pickup_detail: addressDetail,
          fee_agreed: feeAgreed,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "신청에 실패했어요. 잠시 후 다시 시도해주세요."); return; }
      alert(d.message || "신청이 접수되었습니다.");
      router.push(doneHref);
      router.refresh();
    } catch {
      alert("네트워크 문제로 신청이 전달되지 않았어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full border px-3 py-2.5 text-sm focus:outline-none";
  const inputStyle = { borderColor: "#E4E1D6", background: "#fff", color: "#1C2418" };

  return (
    <div className="space-y-6">
      {/* 유형 */}
      <div className="ds-card p-5">
        <p className="text-xs font-bold mb-3" style={{ color: "#4A5442" }}>신청 유형</p>
        <div className="flex gap-2">
          {([["exchange", "교환 (같은 상품으로 다시 받기)"], ["return", "반품 (환불 받기)"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className="flex-1 py-3 text-sm font-bold transition-colors"
              style={{
                border: "1px solid",
                borderColor: kind === k ? "#244B1F" : "#E4E1D6",
                background: kind === k ? "#EAF0E6" : "#fff",
                color: kind === k ? "#244B1F" : "#8B927F",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 상품 선택 */}
      <div className="ds-card p-5">
        <p className="text-xs font-bold mb-3" style={{ color: "#4A5442" }}>상품 선택</p>
        <div className="space-y-2">
          {items.map((it) => {
            const on = (qty[it.item_id] ?? 0) > 0;
            return (
              <div key={it.item_id} className="flex items-center gap-3 py-2 px-3"
                style={{ border: "1px solid", borderColor: on ? "#C7D6C0" : "#F0EDE4", background: on ? "#FAFBF8" : "#fff" }}>
                <input type="checkbox" checked={on} onChange={() => toggleItem(it)}
                  className="w-4 h-4 accent-[#2D5A27] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: "#1C2418" }}>{it.product_name}</p>
                  {it.option_label && <p className="text-xs truncate" style={{ color: "#8B927F" }}>{it.option_label}</p>}
                </div>
                {on && (
                  <select value={qty[it.item_id]} onChange={(e) => setQty((p) => ({ ...p, [it.item_id]: Number(e.target.value) }))}
                    className="border px-2 py-1.5 text-sm shrink-0" style={inputStyle}>
                    {Array.from({ length: it.quantity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}개</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 사유 */}
      <div className="ds-card p-5">
        <p className="text-xs font-bold mb-3" style={{ color: "#4A5442" }}>사유</p>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">사유를 선택해주세요</option>
          {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3}
          placeholder={reason === "기타" ? "사유를 자세히 적어주세요 (필수)" : "상세 내용 (선택)"}
          className={`${inputCls} mt-2 resize-none`} style={inputStyle} maxLength={1000} />

        {/* 사진 */}
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {photos.map((url) => (
              <div key={url} className="relative w-16 h-16" style={{ border: "1px solid #E4E1D6" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="첨부 사진" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-[10px] text-white"
                  style={{ background: "#1A1D18", borderRadius: "50%" }}>✕</button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="w-16 h-16 flex flex-col items-center justify-center cursor-pointer text-xs"
                style={{ border: "1px dashed #C9C5B8", color: "#8B927F" }}>
                {uploading ? "…" : "＋ 사진"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhoto} disabled={uploading} />
              </label>
            )}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "#B4B0A2" }}>
            불량·오배송은 상태를 확인할 수 있는 사진을 함께 올려주시면 처리가 빨라져요. (최대 5장)
          </p>
        </div>
      </div>

      {/* 수거지 */}
      <div className="ds-card p-5">
        <p className="text-xs font-bold mb-3" style={{ color: "#4A5442" }}>수거지 주소</p>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="주소"
          className={inputCls} style={inputStyle} maxLength={300} />
        <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="상세 주소"
          className={`${inputCls} mt-2`} style={inputStyle} maxLength={200} />
      </div>

      {/* 배송비 안내 */}
      <div className="ds-card p-5">
        <p className="text-xs font-bold mb-3" style={{ color: "#4A5442" }}>배송비 안내</p>
        {sellerFault ? (
          <p className="text-sm" style={{ color: "#244B1F" }}>
            상품 하자·오배송 사유는 교환·반품 배송비를 저희가 부담해요. 동의 없이 바로 신청할 수 있어요.
          </p>
        ) : (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={feeAgreed} onChange={(e) => setFeeAgreed(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-[#2D5A27] shrink-0" />
            <span className="text-sm leading-relaxed" style={{ color: "#4A5442" }}>
              고객 사유(단순 변심 등)의 {kind === "exchange" ? "교환은 왕복 배송비" : "반품은 반송 배송비"}를
              고객이 부담하는 것에 동의합니다.
              {kind === "return" && " (환불 시 배송비를 제외한 금액이 환불될 수 있어요)"}
            </span>
          </label>
        )}
      </div>

      <button onClick={handleSubmit} disabled={submitting || uploading}
        className="ds-btn ds-btn-primary w-full disabled:opacity-50" style={{ height: "48px", fontSize: "14px" }}>
        {submitting ? "접수 중..." : `${kind === "exchange" ? "교환" : "반품"} 신청하기`}
      </button>
    </div>
  );
}
