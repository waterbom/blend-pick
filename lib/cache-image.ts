import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * 외부 이미지 URL을 서버로 내려받아 /uploads 경로로 치환.
 * (인스타그램 등 만료되는 서명 URL 대응 — 저장 시점에 사본을 떠둠)
 * 실패하면 원본 URL 그대로 반환.
 */
export async function cacheExternalImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url; // 이미 로컬 경로(/uploads/...) 등
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlendPickBot/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return url;

    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return url;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8 * 1024 * 1024) return url;

    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(join(dir, name), buf);
    return `/uploads/${name}`;
  } catch {
    return url;
  }
}
