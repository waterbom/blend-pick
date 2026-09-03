"use client";

import { createContext, useContext } from "react";
import type { SiteKey } from "@/lib/sites";

// 클라이언트 컴포넌트(로그인·회원가입 등 공용 페이지)에서 현재 사이트를 알기 위한 컨텍스트.
// 루트 레이아웃이 서버에서 판별한 사이트 키를 내려주므로 SSR/CSR 불일치가 없다.
const SiteCtx = createContext<SiteKey>("blendpick");

export function SiteProvider({ site, children }: { site: SiteKey; children: React.ReactNode }) {
  return <SiteCtx.Provider value={site}>{children}</SiteCtx.Provider>;
}

export function useSiteKey(): SiteKey {
  return useContext(SiteCtx);
}

// 공용 페이지 상단 워드마크 — 산지픽이면 로고 이미지 + 산지픽, 아니면 BLEND PICK 텍스트
export function BrandMark({ onDark = false, size = 17 }: { onDark?: boolean; size?: number }) {
  const site = useSiteKey();
  if (site === "sanjipick") {
    return (
      <span className="inline-flex items-center gap-2" style={{ color: onDark ? "#fff" : "var(--accent)" }}>
        <img src="/sanji/logo.png" alt="" style={{ width: size + 13, height: size + 13, borderRadius: "50%", display: "block" }} />
        <span className="font-extrabold" style={{ fontSize: size + 1, letterSpacing: "-0.03em" }}>산지픽</span>
      </span>
    );
  }
  return <span className="font-extrabold" style={{ fontSize: size, letterSpacing: "0.06em", color: onDark ? "#fff" : "var(--text-primary)" }}>BLEND PICK</span>;
}
