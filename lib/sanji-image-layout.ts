// Fill stable square covers without stretching. Bias portrait crops upward to
// preserve the headline and central product; the lightbox shows the full original.
export const SANJI_IMAGE_ASPECT_RATIO = "1 / 1";
export const SANJI_IMAGE_OBJECT_POSITION = "50% 30%";
// Reserve the sticky header, purchase bar and device safe area on short screens.
export const SANJI_LARGE_IMAGE_MAX_WIDTH = "min(560px, 67.5svh, max(120px, calc(100svh - 150px - env(safe-area-inset-bottom, 0px))))";

