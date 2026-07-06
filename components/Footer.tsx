import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="container-blend py-10">
        <div className="flex flex-col gap-6 text-left">
          {/* 브랜드 */}
          <div>
            <p className="text-sm font-extrabold tracking-widest uppercase" style={{ color: "var(--text-primary)" }}>Blend Pick</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>인플루언서 공구 플랫폼</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <Link href="/hotel/lookup" className="transition-colors hover:underline font-semibold" style={{ color: "var(--accent)" }}>예약 조회</Link>
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

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>© 2026 Blend Pick. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
