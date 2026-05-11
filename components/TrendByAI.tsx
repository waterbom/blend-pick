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

/**
 * 카테고리별 컬러 매핑
 * 기존: 강한 원색 (pink-600, green-600)
 * 변경: 부드러운 톤 — 배경과 텍스트 모두 muted 처리
 */
const CATEGORY_COLORS: Record<string, string> = {
  뷰티: "bg-rose-50 text-rose-400",
  건강: "bg-emerald-50 text-emerald-500",
  리빙: "bg-sky-50 text-sky-500",
  식품: "bg-amber-50 text-amber-500",
  다이어트: "bg-violet-50 text-violet-500",
};

/**
 * 스코어 바
 * 기존: bg-black 바
 * 변경: accent 그라데이션 바 + 부드러운 배경
 */
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--warm-gray)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${(score / 10) * 100}%`,
            background: "linear-gradient(90deg, var(--accent-light), var(--accent))",
          }}
        />
      </div>
      <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * 트렌드 카드
 * 기존: border border-gray-100 (엑셀 표 느낌)
 * 변경: 둥근 카드 + 부드러운 shadow + 내부 여백 확대
 */
function TrendCard({ item }: { item: TrendItem }) {
  const colorClass = CATEGORY_COLORS[item.category] || "bg-gray-50 text-gray-500";

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 h-full transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "#fff",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* 카테고리 + 라벨 */}
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
          {item.category}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>트렌드 스코어</span>
      </div>

      <h3 className="text-base font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
        {item.title}
      </h3>

      <ScoreBar score={item.trend_score} />

      <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--text-secondary)" }}>
        {item.summary}
      </p>

      {/* 태그 — 부드러운 pill 형태 */}
      <div className="flex flex-wrap gap-1.5">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-2.5 py-1 rounded-full"
            style={{
              background: "var(--cream-dark)",
              color: "var(--text-secondary)",
            }}
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* AI 매칭 제품 */}
      {item.matched_products.length > 0 && (
        <div className="pt-3" style={{ borderTop: "1px solid var(--warm-gray)" }}>
          <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>AI 매칭 제품</p>
          <ul className="space-y-1.5">
            {item.matched_products.map((p) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{p.brand}</span> · {p.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * TREND BY AI 섹션
 *
 * 구조:
 * - 첫 번째 카드: 완전 공개 (맛보기)
 * - 나머지 2개: 블러 처리 + 구독 CTA 오버레이
 * → "더 보고 싶으면 구독하세요" 전략
 */
export default function TrendByAI() {
  const [first, ...rest] = DUMMY_TRENDS;

  return (
    <section className="px-8 py-20">
      {/* 헤더 */}
      <div className="mb-12">
        <p className="text-xs font-medium tracking-[0.2em] uppercase mb-3" style={{ color: "var(--accent)" }}>
          POWERED BY AI
        </p>
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Trend by AI
        </h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          OS 시스템이 분석한 이번 주 공구 트렌드
        </p>
        <div className="mt-3 h-0.5 w-12 rounded-full" style={{ background: "var(--accent)" }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 첫 번째 카드 — 완전 공개 */}
        <TrendCard item={first} />

        {/* 나머지 2개 — 블러 + CTA */}
        <div className="relative md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {rest.map((item) => (
            <div key={item.title} className="relative">
              <div className="blur-sm pointer-events-none select-none">
                <TrendCard item={item} />
              </div>
            </div>
          ))}

          {/* 오버레이 CTA — 따뜻한 cream 반투명 */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl backdrop-blur-[2px]"
            style={{ background: "rgba(250, 248, 245, 0.75)" }}
          >
            <p className="text-base font-bold text-center mb-1" style={{ color: "var(--text-primary)" }}>
              지금 트렌드에 맞는 제품이 궁금하다면?
            </p>
            <p className="text-xs text-center mb-6" style={{ color: "var(--text-muted)" }}>
              구독하면 매주 AI 트렌드 리포트를 확인할 수 있어요
            </p>
            <Link
              href="/brands"
              className="text-white text-sm font-medium px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              style={{ background: "var(--accent)" }}
            >
              구독하기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
