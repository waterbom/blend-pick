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
        <div className="bg-orange-50 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-orange-500 mb-3">
            🔥 {influencers.length}명이 지금 공구 진행중! 함께할 인플루언서를 선택하세요
          </p>
          <div className="flex flex-col gap-2">
            {influencers.map((inf) => {
              const isSelected = selected === inf.id;
              return (
                <button
                  key={inf.id}
                  onClick={() => setSelected(inf.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-colors text-left ${
                    isSelected
                      ? "border-orange-400 bg-orange-100"
                      : "border-transparent bg-white hover:border-orange-200"
                  }`}
                >
                  {inf.profile_image ? (
                    <img
                      src={inf.profile_image}
                      alt={inf.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-600 text-sm font-bold shrink-0">
                      {inf.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{inf.name}</p>
                    {inf.platform && (
                      <p className="text-xs text-gray-400">{inf.platform}</p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-orange-500 text-sm font-bold shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedInf && (
            <p className="text-xs text-orange-600 mt-2 font-medium">
              {selectedInf.name}의 공구로 구매합니다
            </p>
          )}
        </div>
      )}

      {/* 구매 버튼 */}
      <button
        onClick={handleBuy}
        disabled={isUpcoming}
        className="w-full text-center bg-gray-900 text-white font-semibold py-4 rounded-xl hover:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isUpcoming ? "곧 열릴 제품입니다" : `구매하기 · ${displayPrice.toLocaleString()}원`}
      </button>
    </div>
  );
}
