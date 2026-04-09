import pool from "@/lib/db";
import Header from "@/components/Header";

interface Brand {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
}

async function getBrands(): Promise<Brand[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, logo, description
       FROM brands
       WHERE is_archived = false
       ORDER BY RANDOM()
       LIMIT 8`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function BlendPickedPage() {
  const brands = await getBrands();

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* 브랜드 한 줄 나열 */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-10">Partners</p>
        <div className="flex items-center justify-between gap-6">
          {brands.map((brand) => (
            <div key={brand.id} className="flex flex-col items-center text-center shrink-0">
              <div className="w-16 h-16 bg-gray-50 rounded-full overflow-hidden flex items-center justify-center mb-2">
                {brand.logo ? (
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-xl font-black text-gray-200">
                    {brand.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-gray-700">{brand.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 전광판 */}
      <div className="overflow-hidden bg-white py-5 select-none border-y border-gray-100">
        <div className="flex whitespace-nowrap" style={{ animation: "marquee 18s linear infinite" }}>
          {[...Array(4)].map((_, i) => (
            <span key={i} className="text-2xl font-black text-black mx-12 tracking-widest">
              브랜드가 당신을 원합니다&nbsp;&nbsp;★&nbsp;&nbsp;BLEND PICKED YOU&nbsp;&nbsp;★&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* OS 시스템 소개 섹션 */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">BLEND PICK OS</p>
        <h2 className="text-3xl font-black mb-16">
          BLEND PICK이 개발한<br />공구 맞춤 전용 OS 시스템
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 카드 1 - 인플루언서 혜택 */}
          <div className="border border-gray-100 p-10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-orange-500 tracking-widest uppercase">For Influencers</span>
              <h3 className="text-xl font-black mt-3 mb-5">
                인플루언서들에겐<br />든든한 매니저
              </h3>
              <ul className="space-y-4 text-sm text-gray-500 leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-black font-bold shrink-0">📅</span>
                  <span>저희와 함께 잡은 공구일정은 내부 OS 시스템 캘린더에 등록되고, 카카오톡 알림으로 일정을 알려드려요.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-black font-bold shrink-0">🤖</span>
                  <span>AI 알고리즘을 통해 딱 맞는 제품을 추천해드리고, 추가 기능을 함께 경험할 수 있어요.</span>
                </li>
              </ul>
            </div>

            {/* 구독 지원 배지 */}
            <div className="mt-10 bg-gray-50 p-5">
              <p className="text-xs text-gray-400 mb-1">인플루언서 신청 혜택</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">구독 지원</span>
                <span className="text-sm text-gray-400 line-through">월 80,000원</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                인플루언서 신청 승인 시 OS 구독료를 BLEND PICK이 지원해드려요.
              </p>
              <button className="mt-5 w-full bg-black text-white text-sm font-bold py-3 hover:bg-gray-800 transition-colors">
                인플루언서 신청하기
              </button>
            </div>
          </div>

          {/* 카드 2 - 기능 소개 */}
          <div className="bg-black text-white p-10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-orange-400 tracking-widest uppercase">OS Features</span>
              <h3 className="text-xl font-black mt-3 mb-8">
                공구 전용으로<br />설계된 기능들
              </h3>
              <ul className="space-y-5">
                {[
                  { icon: "📆", title: "공구 일정 캘린더", desc: "일정 등록부터 마감까지 한눈에" },
                  { icon: "💬", title: "카카오톡 알림", desc: "공구 하루 전 자동 알림 발송" },
                  { icon: "✨", title: "AI 제품 추천", desc: "채널 특성에 맞는 제품 자동 매칭" },
                  { icon: "📊", title: "수익 정산 관리", desc: "캠페인별 수수료 자동 계산" },
                ].map((item) => (
                  <li key={item.title} className="flex gap-4 items-start">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-bold text-sm">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-10">* 기능은 지속적으로 업데이트됩니다.</p>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
