import { headers } from "next/headers";
import { SITES, siteFromHost } from "@/lib/sites";

// 산지픽 내부 링크 프리픽스 — 산지픽 도메인으로 접속했으면 "" (proxy가 /p/* 를 /sanji/p/* 로 리라이트),
// shop 도메인에서 /sanji 경로로 보고 있으면 "/sanji" 를 앞에 붙여야 링크가 깨지지 않는다.
export async function sanjiLinkBase(): Promise<string> {
  try {
    const h = await headers();
    return siteFromHost(h.get("host")) === "sanjipick" ? "" : SITES.sanjipick.basePath;
  } catch {
    return SITES.sanjipick.basePath;
  }
}
