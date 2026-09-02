import Link from "next/link";
import Header from "@/components/Header";
import { SITES, SANJI as C } from "@/lib/sites";

const S = SITES.sanjipick;
const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const metadata = { title: "산지픽 이야기" };

// 산지픽 소개 — 스켈레톤. 브랜드 스토리·농가 소개·사진은 확정되면 채운다.
export default function SanjiAboutPage() {
  return (
    <main>
      <Header />
      <div className="max-w-[840px] mx-auto px-5 lg:px-8 py-16 lg:py-24">
        <div className="text-center mb-10">
          <div className="text-[10px] lg:text-[11px] mb-2.5" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.field }}>
            ABOUT — {S.nameEn}
          </div>
          <h1 className="m-0 text-[28px] lg:text-[40px]" style={{ fontFamily: SERIF, fontWeight: 700, color: C.soil }}>산지픽 이야기</h1>
          <p className="mt-3 mb-0 text-[13.5px]" style={{ color: C.muted }}>브랜드 소개와 함께하는 농가 이야기가 들어갈 자리예요</p>
        </div>

        {[
          ["01", "WHY WE STARTED", "왜 산지픽을 시작했나"],
          ["02", "OUR FARMS", "함께하는 농가"],
          ["03", "HOW IT WORKS", "주문부터 배송까지"],
        ].map(([no, cap, title]) => (
          <section key={no} className="mt-12 first:mt-0">
            <div className="text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".3em", color: C.field }}>{no} — {cap}</div>
            <h2 className="m-0 mb-4 text-[20px] lg:text-[24px]" style={{ fontFamily: SERIF, fontWeight: 600, color: C.soil }}>{title}</h2>
            <div className="flex items-center justify-center w-full" style={{ height: 180, border: `1px solid ${C.hairline}`, background: `repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 12px,${C.cream} 12px,${C.cream} 24px)` }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".22em", color: C.field }}>CONTENT — 준비 중</span>
            </div>
          </section>
        ))}

        <div className="mt-14 text-center">
          <Link href={S.basePath || "/"} className="inline-block text-[13px] font-bold px-7 py-3.5" style={{ border: `1px solid ${C.hairline}`, color: C.soil700, background: "#fff" }}>
            ← 산지픽 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
