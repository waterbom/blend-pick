import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { CORE_CARRIERS } from "@/lib/carriers";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 스위트트래커 공식 택배사 목록 캐시 (24시간) — 코드표를 하드코딩하지 않기 위함
let cache: { at: number; carriers: { code: string; name: string }[] } | null = null;
const TTL = 24 * 60 * 60 * 1000;

// GET /api/admin/shipments/carriers
// 키가 있으면 스위트트래커 companylist에서 실제 코드표를 받아오고, 없으면 주요 6사 폴백
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SWEETTRACKER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ carriers: CORE_CARRIERS, source: "builtin", keyMissing: true });
  }

  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ carriers: cache.carriers, source: "sweettracker" });
  }

  try {
    const url = new URL("https://info.sweettracker.co.kr/api/v1/companylist");
    url.searchParams.set("t_key", apiKey);
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();
    const list: { Code: string; Name: string; International?: string }[] = data?.Company ?? [];
    if (!res.ok || list.length === 0) throw new Error("companylist 응답 이상");

    // 국내 택배사 우선 정렬 + 주요 6사 최상단
    const coreCodes = CORE_CARRIERS.map((c) => c.code);
    const carriers = list
      .map((c) => ({ code: c.Code, name: c.Name, intl: c.International === "true" }))
      .sort((a, b) => {
        const ai = coreCodes.indexOf(a.code), bi = coreCodes.indexOf(b.code);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        if (a.intl !== b.intl) return a.intl ? 1 : -1;
        return a.name.localeCompare(b.name, "ko");
      })
      .map(({ code, name }) => ({ code, name }));

    cache = { at: Date.now(), carriers };
    return NextResponse.json({ carriers, source: "sweettracker" });
  } catch (e) {
    console.error("[carriers] companylist 조회 실패:", e);
    return NextResponse.json({ carriers: CORE_CARRIERS, source: "builtin", error: "목록 조회 실패 (주요 택배사만 표시)" });
  }
}
