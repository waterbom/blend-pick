import { NextRequest, NextResponse } from "next/server";
import { currentSite } from "@/lib/site-server";
import { SITES, siteFromHost } from "@/lib/sites";

export async function GET(req: NextRequest) {
  const site = await currentSite();
  const sanjiHost = siteFromHost(req.headers.get("host")) === "sanjipick";
  const origin = sanjiHost
    ? `https://${SITES.sanjipick.host}`
    : process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  const home = site.key === "sanjipick" && !sanjiHost ? "/sanji" : "/";
  const res = NextResponse.redirect(new URL(home, origin));
  res.cookies.set("shop_token", "", { maxAge: 0, path: "/" });
  return res;
}
