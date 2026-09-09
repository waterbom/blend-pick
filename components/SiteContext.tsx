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

// 공용 페이지 상단 워드마크 — 사이트별 직사각 로고 이미지 (산지픽 public/sanji/logo-wide.png · 블랜드픽 public/logo-wide.png)
// 어두운 바탕(로그인 밴드)에선 크림 바탕이 깔린 버전, 밝은 바탕에선 투명 버전
export function BrandMark({ onDark = false, size = 17 }: { onDark?: boolean; size?: number }) {
  const site = useSiteKey();
  const sanji = site === "sanjipick";
  const src = sanji
    ? (onDark ? "/sanji/logo-wide-cream.png" : "/sanji/logo-wide.png")
    : (onDark ? "/logo-wide-cream.png" : "/logo-wide.png");
  return (
    <img
      src={src}
      alt={sanji ? "산지픽 SANJI PICK" : "BLEND PICK"}
      style={{ height: size + (sanji ? 30 : 22), width: "auto", display: "block", borderRadius: onDark ? 8 : 0 }}
    />
  );
}
