// 브라우저에서 업로드 전에 사진을 줄인다 — 어드민 상품 이미지·상세 에디터 공용.
// 휴대폰 사진(3~8MB)을 그대로 올리면 서버 앞단(nginx) 업로드 한도에 걸리거나 상세 페이지가 무거워진다.
// 긴 변 maxDim 이하·JPEG 품질 quality 로 다시 인코딩. GIF(애니메이션)와 작은 파일은 그대로 둔다.
export async function shrinkImage(file: File, opts: { maxWidth?: number; maxDim?: number; quality?: number; skipBelow?: number } = {}): Promise<File> {
  const { maxDim = 1600, quality = 0.86, skipBelow = 700 * 1024 } = opts;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= skipBelow) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, opts.maxWidth ? opts.maxWidth / bitmap.width : maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    // 투명 PNG 는 PNG 유지(배경이 검게 변하는 것 방지), 그 외는 JPEG
    const keepPng = file.type === "image/png" && (await hasTransparency(ctx, w, h));
    const type = keepPng ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, quality));
    if (!blob || blob.size >= file.size) return file; // 줄어들지 않으면 원본 그대로
    const name = file.name.replace(/\.[^.]+$/, "") + (keepPng ? ".png" : ".jpg");
    return new File([blob], name, { type });
  } catch {
    return file; // 브라우저가 지원하지 않으면 원본 업로드
  }
}

async function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): Promise<boolean> {
  // 모서리·중앙 몇 점만 샘플링 (전체 픽셀 검사는 큰 이미지에서 느림)
  const pts: [number, number][] = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, h >> 1], [w >> 2, h >> 2], [(w * 3) >> 2, (h * 3) >> 2]];
  for (const [x, y] of pts) {
    if (ctx.getImageData(x, y, 1, 1).data[3] < 250) return true;
  }
  return false;
}

// 업로드 응답을 사람이 읽을 안내문으로 — nginx 등 앞단이 막으면 JSON 이 아니라 HTML 이 온다
export function uploadErrorMessage(status: number, data: { error?: string } | null): string {
  if (status === 413) return "사진 파일이 너무 커서 서버가 받지 못했어요. (서버 업로드 한도 초과) 더 작은 사진으로 다시 시도해주세요.";
  if (status === 401) return "관리자 로그인이 만료됐어요. 새 탭에서 다시 로그인한 뒤 시도해주세요.";
  if (data?.error) return data.error;
  return `사진 업로드에 실패했어요 (오류 ${status}). 잠시 후 다시 시도해주세요.`;
}
