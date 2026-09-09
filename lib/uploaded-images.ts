import { mkdir, realpath, readFile, writeFile } from 'fs/promises';
import { join, resolve, sep, isAbsolute, extname } from 'path';
import { randomUUID } from 'crypto';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
const mime: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif' };
export function uploadsDirectory() {
  const configured = process.env.UPLOADS_DIR;
  if (configured && !isAbsolute(configured)) throw Error('UPLOADS_DIR must be absolute');
  return configured || join(process.cwd(), 'public', 'uploads');
}
export async function saveUploadedImage(file: File, folder = '') {
  const ext = extensions[file.type];
  if (!ext) throw Error('jpg, png, webp, gif만 업로드 가능해요');
  if (!['','reviews','returns'].includes(folder)) throw Error('잘못된 업로드 경로입니다');
  const name = `${randomUUID()}.${ext}`;
  const dir = join(uploadsDirectory(), folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()), { flag: 'wx', mode: 0o644 });
  return `/uploads/${folder ? folder+'/' : ''}${name}`;
}
export async function readUploadedImage(parts: string[]) {
  if (!parts.length || parts.some(p => !/^[a-zA-Z0-9_.-]+$/.test(p) || p === '.' || p === '..')) return null;
  const type = mime[extname(parts.at(-1)!).toLowerCase()];
  if (!type) return null;
  // Read legacy files as well if operators later configure an external persistent directory.
  const roots = [...new Set([uploadsDirectory(), join(process.cwd(), 'public', 'uploads')])];
  for (const root of roots) {
    try {
      const base = await realpath(root), file = await realpath(resolve(base, ...parts));
      if (!file.startsWith(base + sep)) return null;
      return { data: await readFile(file), type };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw e;
    }
  }
  return null;
}
