import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join } from "path";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// UUID 파일명만 허용 — 경로 조작(../) 원천 차단
const NAME_RE = /^[0-9a-f-]{36}\.(pdf|jpe?g|png)$/i;

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: "잘못된 파일명" }, { status: 400 });
  }

  try {
    const buf = await readFile(join(process.cwd(), "private-uploads", name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  }
}
