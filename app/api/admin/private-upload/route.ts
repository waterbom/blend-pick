import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EXT_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 민감 서류(신분증/사업자등록증/통장사본)용 — public 밖에 저장, 조회는 private-files 라우트로만
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "pdf/jpg/png만 업로드 가능합니다" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "10MB 이하만 업로드 가능합니다" }, { status: 400 });
  }

  const dir = join(process.cwd(), "private-uploads");
  await mkdir(dir, { recursive: true });

  const name = `${randomUUID()}.${EXT_MAP[file.type]}`;
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true, file: name });
}
