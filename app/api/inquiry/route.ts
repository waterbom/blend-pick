import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 로그인 유저면 user_id 추출
  let userId = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      userId = payload?.id || null;
    }
  } catch {}

  const osUrl = process.env.OS_API_URL || "http://localhost:8000";

  const res = await fetch(`${osUrl}/inquiries/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      name: body.name,
      contact: body.contact,
      category: body.category,
      message: body.message,
      ...(userId ? { user_id: userId } : {}),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "전송 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  // 로그인 유저의 문의 내역 조회
  let userId = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      userId = payload?.id || null;
    }
  } catch {}

  if (!userId) {
    return NextResponse.json({ inquiries: [] });
  }

  const osUrl = process.env.OS_API_URL || "http://localhost:8000";
  const res = await fetch(`${osUrl}/inquiries/api/user/${userId}`);

  if (!res.ok) {
    return NextResponse.json({ inquiries: [] });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
