import { NextRequest, NextResponse } from "next/server";
import { currentAdminSite } from "@/lib/admin-site";

export async function POST(req: NextRequest) {
  const site = await currentAdminSite();
  const origin = process.env.NODE_ENV === "production" ? `https://${site.host}` : req.nextUrl.origin;
  const res = NextResponse.redirect(new URL("/login?redirect=%2Fadmin", origin), 303);
  res.cookies.set("admin_token", "", { maxAge: 0, path: "/" });
  return res;
}
