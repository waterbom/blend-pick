"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Influencer {
  id: string;
  name: string;
  platform: string | null;
  profile_image: string | null;
}

export default function InfluencerSelector({
  influencers,
  productId,
  displayPrice,
  isUpcoming = false,
}: {
  influencers: Influencer[];
  productId: string;
  displayPrice: number;
  isUpcoming?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(
    influencers.length === 1 ? influencers[0].id : null
  );

  const selectedInf = influencers.find((i) => i.id === selected);

  function handleBuy() {
    if (influencers.length > 1 && !selected) {
      alert("함께할 인플루언서를 선택해주세요.");
      return;
    }
    const params = selectedInf
      ? `?influencer_id=${selectedInf.id}&influencer_name=${encodeURIComponent(selectedInf.name)}`
      : "";
    router.push(`/campaigns/${productId}/checkout${params}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 인플루언서 선택 */}
      {influencers.length > 0 && (
        <div className="rounded-2xl px-4 py-3.5" style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}>
          <p className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
            <span aria-hidden>🔥</span>
            {influencers.length}명이 지금 공구 진행중! 함께할 인플루언서를 선택하세요
          </p>
          <div className="flex flex-col gap-2">
            {influencers.map((inf) => {
              const isSelected = selected === inf.id;
              return (
                <button
                  key={inf.id}
                  onClick={() => setSelected(inf.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    border: isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                    background: isSelected ? "#fff" : "rgba(255,255,255,0.6)",
                    boxShadow: isSelected ? "var(--card-shadow)" : "none",
                  }}
                >
                  {inf.profile_image ? (
                    <img
                      src={inf.profile_image}
                      alt={inf.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {inf.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{inf.name}</p>
                    {inf.platform && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{inf.platform}</p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-sm font-bold shrink-0" style={{ color: "var(--accent)" }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedInf && (
            <p className="text-xs mt-2.5 font-medium" style={{ color: "var(--accent)" }}>
              {selectedInf.name}의 공구로 구매합니다
            </p>
          )}
        </div>
      )}

      {/* 구매 버튼 */}
      <button
        onClick={handleBuy}
        disabled={isUpcoming}
        className="w-full text-center text-white font-bold py-4 rounded-2xl transition-all hover:brightness-95 disabled:cursor-not-allowed"
        style={{ background: isUpcoming ? "var(--warm-gray)" : "var(--accent)" }}
      >
        {isUpcoming ? "곧 열릴 제품입니다" : `구매하기 · ${displayPrice.toLocaleString()}원`}
      </button>
    </div>
  );
}
