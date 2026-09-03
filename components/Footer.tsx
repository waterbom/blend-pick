import Link from "next/link";
import { currentSite } from "@/lib/site-server";

// 공용 푸터 — 사이트별로 브랜드 표기만 갈린다 (사업자 정보는 블랜드펀치 공통)
export default async function Footer() {
  const site = await currentSite();
  const sanji = site.key === "sanjipick";
  return (
    <footer className="mt-auto border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="container-blend py-10">
        <div className="flex flex-col gap-6 text-left">
          {/* 브랜드 */}
          <div>
            {sanji ? (
              <p className="flex items-center gap-2 m-0" style={{ color: "var(--accent)" }}>
                <img src="/sanji/logo.png" alt="" className="w-8 h-8 rounded-full" />
                <span className="text-base font-extrabold" style={{ letterSpacing: "-0.03em" }}>산지픽</span>
                <span className="text-[10px] font-bold tracking-[0.18em] opacity-80">SANJI PICK</span>
              </p>
            ) : (
              <p className="text-sm font-extrabold tracking-widest uppercase" style={{ color: "var(--text-primary)" }}>Blend Pick</p>
            )}
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sanji ? "산지에서 바로, 제철 그대로 · 농가 직송 공동구매 by BLEND PUNCH" : "인플루언서 공구 플랫폼"}</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {!sanji && <Link href="/hotel/lookup" className="transition-colors hover:underline font-semibold" style={{ color: "var(--accent)" }}>예약 조회</Link>}
            <Link href="/orders/lookup" className="transition-colors hover:underline font-semibold" style={{ color: "var(--accent)" }}>주문 조회</Link>
            <Link href="/terms" className="transition-colors hover:underline" style={{ color: "var(--text-secondary)" }}>이용약관</Link>
            <Link href="/privacy" className="transition-colors hover:underline font-semibold" style={{ color: "var(--text-primary)" }}>개인정보처리방침</Link>
            <Link href="/guide" className="transition-colors hover:underline" style={{ color: "var(--text-secondary)" }}>이용안내</Link>
          </div>

          {/* 사업자 정보 */}
          <div className="text-xs space-y-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <p>상호명: 블랜드 펀치(BLEND PUNCH) &nbsp;|&nbsp; 대표: 유혁 &nbsp;|&nbsp; 사업자등록번호: 697-22-02084</p>
            <p>통신판매업 신고번호: 제 2024-안양만안-0082 호</p>
            <p>교환·반품 주소: 경기도 안양시 만안구 병목안로 15</p>
            <p>대표전화: 010-4792-3646 &nbsp;|&nbsp; 고객센터: blendpick@blendpunch.com</p>
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>© 2026 {sanji ? "SANJI PICK by BLEND PUNCH" : "Blend Pick"}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
