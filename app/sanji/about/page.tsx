import type { Metadata } from "next";
import SanjiHero from "@/components/sanji/SanjiHero";
import SanjiWhy from "@/components/sanji/SanjiWhy";
import SanjiFarmPack from "@/components/sanji/SanjiFarmPack";
import { sanjiLinkBase } from "@/lib/sanji-link";

export const metadata: Metadata = { title: "산지픽 이야기" };

// 산지픽 브랜드 소개 — ① 히어로 → ② WHY → ③ OUR FARM → ④ PACKING (시안 herospec 순서).
// 루트(/)는 바로 판매 페이지라서, 광고·검색용 브랜드 스토리는 여기서 보여준다.
export default async function SanjiAbout() {
  const homeHref = (await sanjiLinkBase()) || "/";
  return (
    <main style={{ background: "#0b150e", minHeight: "100svh" }}>
      <SanjiHero homeHref={homeHref} />
      <SanjiWhy />
      <SanjiFarmPack />
    </main>
  );
}
