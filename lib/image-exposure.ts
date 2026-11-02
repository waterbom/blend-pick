import { SANJI_IMAGE_ASPECT_RATIO, SANJI_IMAGE_OBJECT_POSITION } from "@/lib/sanji-image-layout";
import type { SiteKey } from "@/lib/sites";

/** Visible source pixels under the same fit and position used by the storefront. */
export function imageVisibleRegion(width: number, height: number, site: SiteKey) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (site !== "sanjipick") return { x: 0, y: 0, width, height };

  const [frameWidth, frameHeight] = SANJI_IMAGE_ASPECT_RATIO.split("/").map(Number);
  const ratio = frameWidth / frameHeight;
  const [positionX, positionY] = SANJI_IMAGE_OBJECT_POSITION.split(" ").map(value => parseFloat(value) / 100);
  const visibleWidth = Math.min(width, height * ratio);
  const visibleHeight = Math.min(height, width / ratio);
  return {
    x: (width - visibleWidth) * positionX,
    y: (height - visibleHeight) * positionY,
    width: visibleWidth,
    height: visibleHeight,
  };
}
