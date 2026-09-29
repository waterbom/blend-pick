// Current public cover images: 1254×1254 and 1149×883 (2026-09-29).
// Their mean canvas is 1201.5×1068.5, approximately 9:8. Keep original URLs
// and pixels: contain the whole image in this shared responsive display frame.
export const SANJI_IMAGE_ASPECT_RATIO = "9 / 8";
// 560 CSS px stays below half the smaller cover's 1149px source width.
// Limit both dimensions together on short screens so the ratio never changes.
export const SANJI_LARGE_IMAGE_MAX_WIDTH = "min(560px, 67.5svh)";
