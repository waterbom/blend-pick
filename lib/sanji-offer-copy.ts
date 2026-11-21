import { optionText } from "@/lib/buyer-flow";

// Storefront-only corrections for the two legacy catalog titles. A later title
// edited in the catalog takes precedence; never overwrite master product data.
const TITLES: Record<string, { previous: string; display: string }> = {
  "df50ccc0-25d9-4d9b-89a0-cf722f7f4db3": {
    previous: "정품연지홍게 프리미엄급 다리수율 80%이상 포항 구룡포 대게",
    display: "연지홍게",
  },
  "606c73b5-9251-4956-b1ce-a01e3eeab90c": {
    previous: "국내산 無첨가물 진공 초당 옥수수 & 초당 옥수수",
    display: "진공 초당·찰옥수수",
  },
};

export const SANJI_SCOPED_OFFER_IDS = Object.keys(TITLES);
export const sanjiScopedOffer = (id: string) => Object.hasOwn(TITLES, id);

export function sanjiOfferName(id: string | undefined, name: string): string {
  const title = id && sanjiScopedOffer(id) ? TITLES[id] : undefined;
  return title?.previous === name ? title.display : name;
}

export function sanjiPriceBasis(price: number, options: {
  name?: string | null; value?: string | null; extra_price?: number | null;
  stock: number; is_active: boolean;
}[]): string | null {
  const matches = options.filter(o => o.is_active && Number.isInteger(o.stock) && o.stock !== 0 && (o.extra_price ?? price) === price);
  if (matches.length !== 1) return null;
  return optionText(matches[0].name, matches[0].value) || null;
}
