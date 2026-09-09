import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { saveUploadedImage } from '@/lib/uploaded-images';
import { verifiedPhoneOf } from "@/lib/phone-verify";

// 교환·반품 신청 사진 업로드 — 로그인 회원 또는 휴대폰 인증(phone_verified)된 비회원
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get("shop_token")?.value;
  const logged = token ? await verifyToken(token) : null;
  const guestPhone = logged ? null : await verifiedPhoneOf(store.get("phone_verified")?.value);
  if (!logged && !guestPhone) {
    return NextResponse.json({ error: "로그인 또는 휴대폰 인증 후 업로드할 수 있어요." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string" || !file.size) return NextResponse.json({ error: "파일이 없어요" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "이미지 파일만 업로드 가능해요" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "사진은 8MB 이하만 업로드 가능해요" }, { status: 400 });
  }

  try { return NextResponse.json({ url: await saveUploadedImage(file, 'returns') }); }
  catch { return NextResponse.json({ error: '사진을 서버에 저장하지 못했어요. 다시 시도해주세요.' }, { status: 503 }); }
}
