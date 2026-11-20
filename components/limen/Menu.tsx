"use client";

import { useRef, type CSSProperties } from "react";
import { BRAND } from "@/components/limen/content";

// 좁은 화면의 메뉴 — 넓은 화면 헤더에 펼쳐져 있는 링크를 휴대폰에서는 전체 화면으로 연다.
// 위에서 문이 내려오듯 열리고 항목이 차례로 떠오른다. 항목을 누르면 닫히고 그 구간으로 이동한다.
// <dialog> 를 써서 포커스 가두기 · Esc 닫기는 브라우저가 처리한다. 스크립트가 꺼져 있으면 버튼을 숨긴다 (limen.css).
const LINKS: { href: string; ko: string; en: string }[] = [
  { href: "#story", ko: "스토리", en: "STORY" },
  { href: "#rooms", ko: "객실·요금", en: "ROOMS & RATES" },
  { href: "#space", ko: "공간 둘러보기", en: "SPACE" },
  { href: "#location", ko: "위치", en: "LOCATION" },
  { href: "#reserve", ko: "예약", en: "RESERVE" },
  { href: "#lookup", ko: "예약 조회", en: "MY BOOKING" },
  { href: "#guide", ko: "이용 안내", en: "GUIDE" },
];

export default function Menu() {
  const dialog = useRef<HTMLDialogElement>(null), overflow = useRef("");
  const open = () => {
    const el = dialog.current;
    if (!el || el.open) return;
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // 메뉴가 열린 동안 뒤 화면이 따라 움직이지 않게
    el.showModal();
  };
  const close = () => dialog.current?.close();
  return <>
    <button type="button" className="lm-menu-open" aria-haspopup="dialog" aria-label="메뉴 열기" onClick={open}><i aria-hidden="true" /><span>메뉴</span></button>
    <dialog ref={dialog} className="lm-menu" aria-label="LIMEN 메뉴" onClose={() => { document.body.style.overflow = overflow.current; }}>
      <div className="lm-menu-top">
        <span className="lm-menu-brand">{BRAND.name}</span>
        <button type="button" className="lm-menu-close" onClick={close} aria-label="메뉴 닫기">닫기 ×</button>
      </div>
      <nav aria-label="LIMEN 메뉴">
        <ol>
          {LINKS.map((link, i) => <li key={link.href} style={{ "--i": i } as CSSProperties}>
            <a href={link.href} onClick={close}><span>{String(i + 1).padStart(2, "0")}</span><b>{link.ko}</b><small>{link.en}</small></a>
          </li>)}
        </ol>
      </nav>
      <p className="lm-menu-foot">{BRAND.tagline}</p>
    </dialog>
  </>;
}
