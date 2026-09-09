import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { saveUploadedImage } from '@/lib/uploaded-images';

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === 'string' || !file.size) return NextResponse.json({error:"파일이 없어요"},{status:400});
  if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) return NextResponse.json({error:"jpg, png, webp, gif만 업로드 가능해요"},{status:400});
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({error:"50MB 이하의 사진을 사용해주세요"},{status:413});
  try { return NextResponse.json({url:await saveUploadedImage(file)}); }
  catch { return NextResponse.json({error:"사진을 서버에 저장하지 못했어요. 다시 시도해주세요."},{status:503}); }
}
