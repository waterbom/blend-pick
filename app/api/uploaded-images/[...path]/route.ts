import { readUploadedImage } from '@/lib/uploaded-images';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const image = await readUploadedImage((await params).path);
    if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(image.data), { headers: {
      'Content-Type': image.type, 'Content-Length': String(image.data.length),
      'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
