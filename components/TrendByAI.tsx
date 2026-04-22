import Link from "next/link";

interface TrendItem {
  category: string;
  title: string;
  summary: string;
  trend_score: number;
  tags: string[];
  brands: string[];
  matched_products: { name: string; brand: string }[];
}

const DUMMY_TRENDS: TrendItem[] = [
  {
    category: "뷰티",
    title: "저자극 미네랄 선크림 급부상",
    summary: "화학 자외선 차단제 성분 우려로 산화아연·산화티타늄 기반 제품 검색량이 전월 대비 340% 급증. 민감성 피부 타겟 채널에서 특히 반응이 높음.",
    trend_score: 9.2,
    tags: ["선크림", "저자극", "미네랄", "민감성피부"],
    brands: ["라운드랩", "아누아", "조선미녀"],
    matched_products: [
      { name: "톤업 미네랄 선크림 SPF50+", brand: "라운드랩" },
      { name: "어성초 진정 선세럼", brand: "아누아" },
    ],
  },
  {
    category: "건강",
    title: "단백질 음료 시장 2배 성장",
    summary: "헬스 유튜버 중심으로 고단백 저칼로리 RTD 제품 콘텐츠가 폭발적 반응. 20~30대 여성 구매 비율이 60%로 기존 남성 위주 시장 판도 변화.",
    trend_score: 8.7,
    tags: ["단백질", "헬시플레저", "다이어트", "RTD"],
    brands: ["마이프로틴", "뉴트리원", "일동후디스"],
    matched_products: [
      { name: "제로 그릭 쉐이크 초코", brand: "마이프로틴" },
    ],
  },
  {
    category: "리빙",
    title: "무형광 친환경 주방용품 관심↑",
    summary: "환경 인식 확대로 무형광·무독성 주방 제품 수요 증가. 특히 실리콘 조리도구·유리 용기류가 인스타그램 홈카페 콘텐츠와 맞물려 급성장.",
    trend_score: 7.8,
    tags: ["친환경", "주방", "무형광", "홈카페"],
    brands: ["락앤락", "글라스락", "에코쿡"],
    matched_products: [
      { name: "내열 유리 밀폐용기 세트", brand: "글라스락" },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  뷰티: "bg-pink-50 text-pink-600",
  건강: "bg-green-50 text-green-600",
  리빙: "bg-blue-50 text-blue-600",
  식품: "bg-orange-50 text-orange-600",
  다이어트: "bg-purple-50 text-purple-600",
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-black rounded-full"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      <span className="text-xs font-bold text-black">{score.toFixed(1)}</span>
    </div>
  );
}

function TrendCard({ item }: { item: TrendItem }) {
  const colorClass = CATEGORY_COLORS[item.category] || "bg-gray-50 text-gray-600";

  return (
    <div className="border border-gray-100 p-6 flex flex-col gap-4 h-full">
      {/* 카테고리 + 점수 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-1 rounded ${colorClass}`}>
          {item.category}
        </span>
        <span className="text-xs text-gray-400">트렌드 스코어</span>
      </div>

      {/* 제목 */}
      <h3 className="text-base font-black leading-snug">{item.title}</h3>

      {/* 스코어 바 */}
      <ScoreBar score={item.trend_score} />

      {/* 요약 */}
      <p className="text-xs text-gray-500 leading-relaxed flex-1">{item.summary}</p>

      {/* 태그 */}
      <div className="flex flex-wrap gap-1.5">
        {item.tags.map((tag) => (
          <span key={tag} className="text-[10px] border border-gray-200 px-2 py-0.5 text-gray-500">
            #{tag}
          </span>
        ))}
      </div>

      {/* 매칭 제품 */}
      {item.matched_products.length > 0 && (
        <div className="border-t border-gray-50 pt-3">
          <p className="text-[10px] text-gray-400 mb-2">AI 매칭 제품</p>
          <ul className="space-y-1">
            {item.matched_products.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="w-1 h-1 bg-black rounded-full shrink-0" />
                <span className="text-xs text-gray-700">
                  <span className="font-medium">{p.brand}</span> · {p.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TrendByAI() {
  const [first, ...rest] = DUMMY_TRENDS;

  return (
    <section className="px-6 py-20">
      {/* 헤더 */}
      <div className="mb-10">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">POWERED BY AI</p>
        <h2 className="text-2xl font-black">BLEND PICK TREND BY AI</h2>
        <p className="text-sm text-gray-400 mt-2">OS 시스템이 분석한 이번 주 공구 트렌드</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 첫 번째 카드 — 완전 공개 */}
        <TrendCard item={first} />

        {/* 나머지 2개 — 블러 + CTA */}
        <div className="relative md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {rest.map((item) => (
            <div key={item.title} className="relative">
              <div className="blur-sm pointer-events-none select-none">
                <TrendCard item={item} />
              </div>
            </div>
          ))}

          {/* 오버레이 CTA */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
            <p className="text-sm font-bold text-center mb-1">지금 트렌드에 맞는 제품이 궁금하다면?</p>
            <p className="text-xs text-gray-400 text-center mb-5">구독하면 매주 AI 트렌드 리포트를 확인할 수 있어요</p>
            <Link
              href="/brands"
              className="bg-black text-white text-sm font-bold px-6 py-3 hover:bg-gray-800 transition-colors"
            >
              구독하기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
