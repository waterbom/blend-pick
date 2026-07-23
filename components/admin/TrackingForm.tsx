"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CORE_CARRIERS, carrierName } from "@/lib/carriers";

export default function TrackingForm({
  orderId,
  currentStatus,
  trackingCompany,
  trackingNumber,
}: {
  orderId: string;
  currentStatus: string;
  trackingCompany: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(trackingCompany ?? "");
  const [number, setNumber] = useState(trackingNumber ?? "");
  const [carriers, setCarriers] = useState(CORE_CARRIERS);

  // 스위트트래커 공식 코드표 (숫자 코드) — ShipmentsClient와 동일 소스
  useEffect(() => {
    fetch("/api/admin/shipments/carriers")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.carriers) && d.carriers.length > 0) setCarriers(d.carriers); })
      .catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const alreadyShipped = ["shipped", "delivered"].includes(currentStatus);
  const canCancel = currentStatus === "paid";

  async function handleSaveTracking() {
    if (!company || !number.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "shipped",
          tracking_company: company,
          tracking_number: number.trim(),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } else {
        alert("저장에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: string, label: string) {
    if (!confirm(`${label}로 변경할까요?`)) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
      else alert("상태 변경에 실패했습니다.");
    } finally {
      setStatusLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-none border border-gray-100 p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">배송 처리</h2>

      {/* 운송장 입력 */}
      <div className="space-y-3 mb-5">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">택배사</label>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={alreadyShipped}
            className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C7D6C0] disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">택배사 선택</option>
            {carriers.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">운송장번호</label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            disabled={alreadyShipped}
            placeholder="운송장번호 입력"
            className="w-full border border-gray-200 rounded-none px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#C7D6C0] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {!alreadyShipped && (
          <button
            onClick={handleSaveTracking}
            disabled={!company || !number.trim() || loading}
            className="w-full py-2.5 rounded-none text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: "#2D5A27" }}
          >
            {saved ? "저장됐어요 ✓" : loading ? "처리중..." : "운송장 등록 + 배송중으로 변경"}
          </button>
        )}

        {alreadyShipped && trackingCompany && trackingNumber && (
          <div className="text-xs text-gray-400 text-center py-1">
            {carrierName(trackingCompany)} · {trackingNumber}
          </div>
        )}
      </div>

      {/* 기타 상태 버튼 */}
      <div className="flex gap-2 pt-4 border-t border-gray-50">
        {currentStatus === "shipped" && (
          <button
            onClick={() => handleStatusChange("delivered", "배송완료")}
            disabled={statusLoading}
            className="flex-1 py-2 rounded-none text-sm font-semibold border border-green-200 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
          >
            배송완료 처리
          </button>
        )}
        {currentStatus === "preparing" && (
          <button
            onClick={() => handleStatusChange("shipped", "배송중")}
            disabled={statusLoading}
            className="flex-1 py-2 rounded-none text-sm font-semibold border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-40"
          >
            운송장 없이 배송중으로
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => handleStatusChange("cancelled", "취소")}
            disabled={statusLoading}
            className="flex-1 py-2 rounded-none text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            주문 취소
          </button>
        )}
        {["delivered", "cancelled"].includes(currentStatus) && (
          <p className="text-xs text-gray-300 w-full text-center py-2">더 이상 변경할 수 없는 상태입니다.</p>
        )}
      </div>
    </div>
  );
}
