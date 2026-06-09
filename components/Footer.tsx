import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-6">
          {/* 브랜드 */}
          <div>
            <p className="text-sm font-bold tracking-widest text-gray-900 uppercase">Blend Pick</p>
            <p className="text-xs text-gray-400 mt-1">인플루언서 공구 플랫폼</p>
          </div>

          {/* 링크 */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-gray-900 transition-colors">이용약관</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors font-semibold">개인정보처리방침</Link>
            <Link href="/guide" className="hover:text-gray-900 transition-colors">이용안내</Link>
          </div>

          {/* 사업자 정보 */}
          <div className="text-xs text-gray-400 space-y-1 leading-relaxed">
            <p>상호명: 블렌드픽 &nbsp;|&nbsp; 대표: 유혁 &nbsp;|&nbsp; 사업자등록번호: 697-22-02084</p>
            <p>통신판매업 신고번호: 제 2024-안양만안-0082 호</p>
            <p>교환·반품 주소: 경기도 안양시 만안구 병목안로 15</p>
            <p>고객센터: blendpick@blendpunch.com</p>
          </div>

          <p className="text-xs text-gray-300">© 2026 Blend Pick. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
