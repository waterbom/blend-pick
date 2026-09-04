import type { SanjiCard, SanjiHomeReview, SanjiOption, SanjiProduct } from "@/lib/sanji-data";

// 산지픽 6개 상품 페이지 원고 — 클래식 농원 스마트스토어 상품명·원산지·리뷰 수를 참고해 작성 (순차발송 안내는 제외).
// 상품 관리에 실제 상품이 등록되기 전까지 이 내용으로 메인·상세가 채워진다 (구매 버튼은 잠김).
// ★ 판매가·옵션가는 확인 필요 — 스마트스토어엔 정가(취소선)만 보여서 판매가는 임시값이다.

const P = (dir: string, file: string) => `/sanji/products/${encodeURIComponent(dir)}/${encodeURIComponent(file)}.webp`;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400e3).toISOString();

export interface SanjiDemoProduct {
  product: SanjiProduct & { origin: string; trust: { rating: number; count: number; source: string } };
  images: string[];
  options: SanjiOption[];
  sold: number;
  created_at: string;
}

const base = {
  category: "산지픽",
  status: "active",
  shipping_type: "free",
  shipping_cost: 0,
  free_shipping_threshold: null,
  per_unit_shipping_cost: null,
  influencer_id: null,
  sale_start_at: null,
  sale_end_at: null,
} as const;

const opt = (id: string, name: string, value: string, price: number, stock = 50): SanjiOption => ({ id, name, value, extra_price: price, stock, is_active: true });

const desc = (title: string, lead: string, points: [string, string][], tips: string[]) => `
<div class="sj-desc">
  <h2 style="font-size:20px;font-weight:800;line-height:1.35;margin:0 0 10px;letter-spacing:-.02em">${title}</h2>
  <p style="font-size:14px;line-height:1.7;color:#4E5B4A;margin:0 0 18px">${lead}</p>
  <ul style="list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:10px">
    ${points.map(([k, v]) => `<li style="display:flex;gap:10px;align-items:flex-start"><span style="flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:#E7EFE3;color:#2F5D34;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">✓</span><span style="font-size:14px;line-height:1.55"><b>${k}</b> ${v}</span></li>`).join("")}
  </ul>
  <div style="background:#F3EDDF;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.6;color:#4E5B4A">
    ${tips.map((t) => `<div>· ${t}</div>`).join("")}
  </div>
</div>`;

export const SANJI_DEMO_PRODUCTS: SanjiDemoProduct[] = [
  {
    product: {
      ...base,
      id: "demo",
      name: "햇 감자 카스테라 홍감자 두백 자영",
      brand: "클래식 농원 · 괴산",
      origin: "국산 (충청북도 괴산군)",
      price: 12900,
      original_price: 18000,
      stock: 137,
      main_image: P("감자", "감자"),
      trust: { rating: 4.6, count: 2022, source: "스마트스토어" },
      description: desc(
        "카스테라 포슬포슬 햇감자",
        "GAP 인증 괴산 노지에서 캔 햇감자예요. 붉은 껍질에 노란 속살 홍감자, 포슬포슬한 두백, 보랏빛 자영까지 세 품종 중 골라 담으세요.",
        [
          ["GAP 인증 노지 재배", "충북 괴산 4만 평 밭에서 직접 심고 직접 캡니다."],
          ["카스테라 식감", "찌면 껍질이 툭 갈라지고 속은 포슬포슬, 소금만 찍어도 달아요."],
          ["흙만 털고 바로 선별", "세척 없이 흙째 보내야 오래갑니다. 마지막은 사람 손으로 하나씩 검수."],
        ],
        ["보관: 신문지에 싸서 서늘하고 어두운 곳에. 냉장 보관은 피해 주세요.", "옵션: 2kg · 3kg · 5kg · 10kg", "파손 시 100% 재발송"]
      ),
    },
    images: ["감자", "감자1", "감자2", "감자3", "감자4", "감자5", "감자6"].map((f) => P("감자", f)),
    options: [opt("d-p2", "중량", "2kg", 12900), opt("d-p3", "중량", "3kg", 17900), opt("d-p5", "중량", "5kg", 26900), opt("d-p10", "중량", "10kg", 46900)],
    sold: 1284,
    created_at: at(1),
  },
  {
    product: {
      ...base,
      id: "demo-2",
      name: "말랑이 황도 대향금 꿀 고당도 복숭아",
      brand: "클래식 농원 · 괴산",
      origin: "국산 (충청북도 괴산군)",
      price: 29900,
      original_price: 41000,
      stock: 84,
      main_image: P("복숭아", "복숭아"),
      trust: { rating: 4.58, count: 176, source: "스마트스토어" },
      description: desc(
        "한 입에 꿀, 대향금 복숭아",
        "나무에서 끝까지 익힌 황도예요. 향이 진하고 과즙이 많아 한 입 베어 물면 꿀처럼 흘러요. 수확한 당일 산지에서 바로 보냅니다.",
        [
          ["고당도 황도 대향금", "노란 속살에 붉은 물이 든 완숙 황도, 말랑하고 달아요."],
          ["나무에서 완숙", "덜 익은 채 따서 후숙시키지 않아요. 딸 때가 가장 맛있을 때."],
          ["수확 당일 산지 직송", "아침에 따서 저녁에 포장, 에어캡 개별 포장으로 보내요."],
        ],
        ["보관: 받자마자 냉장, 드시기 30분 전 실온에 두면 향이 살아나요.", "말랑한 과일이라 눌린 자국은 자연스러운 현상입니다.", "파손 시 100% 재발송"]
      ),
    },
    images: ["복숭아", "복숭아1", "복숭아2", "복숭아3", "복숭아4", "복숭아5", "복숭아6"].map((f) => P("복숭아", f)),
    options: [opt("d-c2", "중량", "2kg (7~9과)", 29900), opt("d-c4", "중량", "4kg (14~18과)", 54900)],
    sold: 412,
    created_at: at(2),
  },
  {
    product: {
      ...base,
      id: "demo-3",
      name: "달콤 숙성 미니 밤 단호박 보우짱",
      brand: "클래식 농원 · 괴산",
      origin: "국산 (충청북도 괴산군)",
      price: 14900,
      original_price: 21000,
      stock: 52,
      main_image: P("단호박", "단호박1"),
      trust: { rating: 4.62, count: 955, source: "스마트스토어" },
      description: desc(
        "달콤 숙성 미니 밤 단호박",
        "수확 후 큐어링(숙성)으로 당도를 끌어올린 미니 단호박 보우짱이에요. 밤처럼 포근하고 달아서 쪄서 그대로 드셔도 간식이 됩니다.",
        [
          ["큐어링으로 끌어올린 당도", "따자마자 보내지 않고 숙성해서 단맛이 꽉 찼을 때 보내요."],
          ["밤처럼 포근한 식감", "수분이 적고 포슬포슬해서 전자레인지 7분이면 완성."],
          ["한 손 크기 미니", "한 개가 1인분, 자르기 쉽고 남기지 않아요."],
        ],
        ["보관: 통째로는 서늘한 실온 2~3주, 자른 뒤엔 랩 씌워 냉장.", "옵션: 3kg (6~9개) · 5kg (10~15개)", "파손 시 100% 재발송"]
      ),
    },
    images: ["단호박1", "단호박2", "단호박3", "단호박4", "단호박5"].map((f) => P("단호박", f)),
    options: [opt("d-h3", "중량", "3kg (6~9개)", 14900), opt("d-h5", "중량", "5kg (10~15개)", 22900)],
    sold: 233,
    created_at: at(3),
  },
  {
    product: {
      ...base,
      id: "demo-4",
      name: "환절기 무첨가 어린이 배도라지즙 100ml 20개",
      brand: "클래식 농원",
      origin: "국산 (경기도 이천시)",
      price: 24900,
      original_price: 67800,
      stock: 60,
      main_image: P("배도라지", "배도라지1"),
      trust: { rating: 4.87, count: 53, source: "스마트스토어" },
      description: desc(
        "목이 편한 클래식 배도라지즙",
        "국산 배 95%에 국산 도라지 5%, 물도 설탕도 넣지 않고 그대로 짰어요. 환절기 아침에 아이 손에 한 팩 쥐여 주세요.",
        [
          ["첨가물 없이 100% 착즙", "물·설탕·향료 없이 배와 도라지만. 성분표가 두 줄이에요."],
          ["어린이도 편하게", "도라지 쓴맛은 배가 잡아줘서 아이들도 잘 마셔요."],
          ["100ml × 20팩", "한 번에 딱 한 팩, 가방에 넣어 다니기 좋은 파우치."],
        ],
        ["보관: 직사광선을 피해 서늘한 곳에, 개봉 후엔 바로 드세요.", "차갑게 드시면 더 상큼해요.", "파손 시 100% 재발송"]
      ),
    },
    images: ["배도라지1", "배도라지2", "배도라지3"].map((f) => P("배도라지", f)),
    options: [],
    sold: 96,
    created_at: at(4),
  },
  {
    product: {
      ...base,
      id: "demo-5",
      name: "부사 사과 특대과 선물세트 3kg 5kg",
      brand: "클래식 농원 · 괴산 6대째 청년농부",
      origin: "국산 (충청북도 괴산군)",
      price: 49900,
      original_price: 160000,
      stock: 40,
      main_image: P("사과", "사과1"),
      trust: { rating: 4.56, count: 156, source: "스마트스토어" },
      description: desc(
        "아삭 달콤 부사 사과 특대과",
        "괴산에서 6대째 사과를 키우는 청년농부의 부사예요. 특대과만 골라 12과 프리미엄 박스에 담아 선물용으로 보내드립니다.",
        [
          ["특대과만 선별", "한 손에 꽉 차는 크기, 색 고르고 흠 없는 것만."],
          ["아삭하고 달아요", "나무에서 충분히 익혀 당도 높고 과즙이 많아요."],
          ["선물용 프리미엄 박스", "사과 일러스트 박스에 개별 완충 포장, 그대로 선물하세요."],
        ],
        ["보관: 냉장 보관하면 한 달 이상 아삭함이 유지돼요.", "옵션: 3kg (12과) · 5kg (18~20과)", "파손 시 100% 재발송"]
      ),
    },
    images: ["사과1", "사과2", "사과3", "사과4", "사과5", "사과6", "사과7"].map((f) => P("사과", f)),
    options: [opt("d-a3", "중량", "3kg 선물세트 (12과)", 49900), opt("d-a5", "중량", "5kg 선물세트 (18~20과)", 74900)],
    sold: 310,
    created_at: at(0),
  },
  {
    product: {
      ...base,
      id: "demo-6",
      name: "쫀득하고 구수한 국내산 진공 옥수수 150g",
      brand: "클래식 농원 · 괴산",
      origin: "국산 (충청북도 괴산군)",
      price: 11900,
      original_price: 20000,
      stock: 120,
      main_image: P("옥수수", "옥수수"),
      trust: { rating: 4.64, count: 119, source: "스마트스토어" },
      description: desc(
        "쫀득하고 구수한 진공 옥수수",
        "괴산에서 딴 찰옥수수를 삶아서 한 개씩 진공 포장했어요. 뜯어서 전자레인지에 2~3분이면 갓 삶은 옥수수 그대로, 냉동실에 두고 생각날 때마다 꺼내 드세요.",
        [
          ["국내산 찰옥수수", "괴산 밭에서 수확한 찰옥수수만, 수입산 섞지 않아요."],
          ["쫀득하고 구수한 식감", "알이 꽉 차고 쫀득해서 식어도 맛있어요."],
          ["1개씩 진공 포장 150g", "간식·아침 대용으로 한 개씩 꺼내 데우기만 하면 끝."],
        ],
        ["보관: 냉동 보관, 냉동 상태로 전자레인지 2~3분 또는 끓는 물 5분.", "100g당 1,587원", "파손 시 100% 재발송"]
      ),
    },
    images: ["옥수수", "옥수수1", "옥수수2", "옥수수3", "옥수수4"].map((f) => P("옥수수", f)),
    options: [],
    sold: 188,
    created_at: at(5),
  },
];

export function demoById(id: string): SanjiDemoProduct {
  return SANJI_DEMO_PRODUCTS.find((d) => d.product.id === id) ?? SANJI_DEMO_PRODUCTS[0];
}

export const SANJI_DEMO_CARDS: SanjiCard[] = SANJI_DEMO_PRODUCTS.map((d) => ({
  id: d.product.id,
  name: d.product.name,
  brand: d.product.brand,
  category: "산지픽 농산물",
  price: d.product.price,
  original_price: d.product.original_price,
  main_image: d.product.main_image,
  stock: d.product.stock,
  status: d.product.status,
  sale_start_at: d.product.sale_start_at,
  sale_end_at: d.product.sale_end_at,
  created_at: d.created_at,
  sold: d.sold,
}));

export const SANJI_DEMO_REVIEWS: SanjiHomeReview[] = [
  { id: "r1", buyer_name: "아링", rating: 5, content: "감자가 진짜 포슬포슬해요. 소금만 찍어 먹어도 달달", image: P("감자", "감자6"), created_at: at(0.05), product_id: "demo", product_name: "햇 감자 카스테라 홍감자" },
  { id: "r2", buyer_name: "잔망알찬", rating: 5, content: "복숭아 향이 박스 열자마자 확 올라와요. 한 입에 꿀이 맞네요", image: P("복숭아", "복숭아4"), created_at: at(0.7), product_id: "demo-2", product_name: "말랑이 황도 대향금 복숭아" },
  { id: "r3", buyer_name: "2422WQrJ", rating: 5, content: "단호박 쪄서 먹으니 밤 맛이에요. 아이들이 더 잘 먹어요", image: P("단호박", "단호박1"), created_at: at(1.2), product_id: "demo-3", product_name: "달콤 숙성 미니 밤 단호박" },
];
