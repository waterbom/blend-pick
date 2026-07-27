import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { verifiedPhoneOf } from "@/lib/phone-verify";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// 리뷰 사진 업로드 — 로그인 회원 또는 휴대폰 인증을 마친 비회원만
export async function POST(req: Request) {
  const store = await cookies();
  const logged = store.get("shop_token")?.value
    ? await verifyToken(store.get("shop_token")!.value)
    : null;
  const verifiedPhone = await verifiedPhoneOf(store.get("phone_verified")?.value);
  if (!logged && !verifiedPhone) {
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
  const uploadDir = join(process.cwd(), "public", "uploads", "reviews");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/reviews/${filename}` });
}
