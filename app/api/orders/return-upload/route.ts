import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없어요" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "이미지 파일만 업로드 가능해요" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "사진은 8MB 이하만 업로드 가능해요" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads", "returns");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/returns/${filename}` });
}
