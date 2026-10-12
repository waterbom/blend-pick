import { SANJI_IMAGE_ASPECT_RATIO } from "@/lib/sanji-image-layout";

export default function SanjiProductStyles() {
  return <style>{`
    .sj-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 12px}
    .sj-product-card{display:flex;flex-direction:column;min-width:0;align-items:flex-start;color:#202020;text-decoration:none}
    .sj-product-image{position:relative;aspect-ratio:${SANJI_IMAGE_ASPECT_RATIO};width:100%;overflow:hidden;border-radius:6px;background:#f6f5f2}
    .sj-product-image img{width:100%;height:100%;object-fit:contain;object-position:center;display:block}
    .sj-product-placeholder{display:grid;place-items:center;width:100%;height:100%;font-size:24px;font-weight:700;color:#aaa598;background:#f3f1eb}
    .sj-product-tag{position:absolute;left:0;top:0;padding:5px 7px;background:#C9430E;color:#fff;font-size:11px;font-weight:600}
    .sj-product-brand{margin:10px 0 3px;font-size:11px;font-weight:600;color:#727272;line-height:1.4}
    .sj-product-name{margin-top:8px;font-size:14px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
    .sj-product-brand+.sj-product-name{margin-top:0}
    .sj-product-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px;margin-top:6px;font-size:18px;line-height:1.35;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
    .sj-product-price em{font-style:normal;font-weight:700;color:#C9430E}
    .sj-product-price strong{font-weight:700}
    .sj-product-original{margin-top:2px;font-size:11px;color:#797979;line-height:1.4}
    .sj-product-state{display:inline-flex;margin-top:8px;padding:2px 5px;background:#f5f5f5;border:1px solid #e9e9e9;color:#6d6d6d;font-size:10px;line-height:1.4}
    .sj-product-state.open{background:#fff5ed;border-color:#f8e5d8;color:#a9451d}
    .sj-product-card.is-closed .sj-product-image img{opacity:.42;filter:grayscale(.45)}
    .sj-product-status{position:absolute;inset:auto 0 0;display:flex;justify-content:center;padding:9px;background:#8e3037;color:#fff;font-size:13px;font-weight:700}
    .sj-product-status.upcoming{background:#4c6472}
    .sj-product-state.closed{color:#8e3037;background:#fff1f2;border-color:#edc9cd}
    .sj-product-card:focus-visible{outline:2px solid #C9430E;outline-offset:4px}
  `}</style>;
}
