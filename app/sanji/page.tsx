import SanjiHero from "@/components/sanji/SanjiHero";
import SanjiWhy from "@/components/sanji/SanjiWhy";

// 산지픽 랜딩 (sanjipick.blendpunch.com/) — 모바일 전용, 검색·광고 유입 첫 화면.
// 섹션은 시안 확정되는 대로 하나씩 추가한다. 쇼핑 메인은 별도 경로로 분리 예정.
export default function SanjiLanding() {
  return (
    <main style={{ background: "#0b150e", minHeight: "100svh" }}>
      <SanjiHero />
      <SanjiWhy />
      {/* 다음 섹션 자리 — #deals (지금 열린 산지 공구) 부터 순서대로 */}
      <div id="deals" />
    </main>
  );
}
