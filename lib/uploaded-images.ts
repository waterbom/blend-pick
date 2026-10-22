import { mkdir, realpath, readFile, writeFile } from 'fs/promises';
import { join, resolve, sep, isAbsolute, extname } from 'path';
import { randomUUID } from 'crypto';

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };
const mime: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif' };

function hasPrefix(data: Buffer, bytes: number[]) {
  return data.length >= bytes.length && bytes.every((value, index) => data[index] === value);
}

function imageSignatureMatches(data: Buffer, type: string) {
  if (type === 'image/jpeg') return hasPrefix(data, [0xff, 0xd8, 0xff]);
  if (type === 'image/png') return hasPrefix(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === 'image/gif') {
    const sig = data.subarray(0, 6).toString('ascii');
    return sig === 'GIF87a' || sig === 'GIF89a';
  }
  if (type === 'image/webp') return data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
  if (type === 'image/heic' || type === 'image/heif') {
    if (data.length < 12 || data.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
    const brand = data.subarray(8, 12).toString('ascii');
    return ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].includes(brand);
  }
  return false;
}

export function uploadsDirectory() {
  const configured = process.env.UPLOADS_DIR;
  if (configured && !isAbsolute(configured)) throw Error('UPLOADS_DIR must be absolute');
  return configured || join(process.cwd(), 'public', 'uploads');
}

export async function saveUploadedImage(file: File, folder = '') {
  const ext = extensions[file.type];
  if (!ext) throw Error('jpg, png, webp, gif, heic, heif만 업로드 가능해요');
  if (!['','reviews','returns'].includes(folder)) throw Error('잘못된 업로드 경로입니다');
  const data = Buffer.from(await file.arrayBuffer());
  if (!imageSignatureMatches(data, file.type)) throw Error('파일 내용과 이미지 형식이 일치하지 않습니다');
  const name = `${randomUUID()}.${ext}`;
  const dir = join(uploadsDirectory(), folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), data, { flag: 'wx', mode: 0o644 });
  return `/uploads/${folder ? folder+'/' : ''}${name}`;
}

export async function readUploadedImage(parts: string[]) {
  if (!parts.length || parts.some(p => !/^[a-zA-Z0-9_.-]+$/.test(p) || p === '.' || p === '..')) return null;
  const type = mime[extname(parts.at(-1)!).toLowerCase()];
  if (!type) return null;
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
