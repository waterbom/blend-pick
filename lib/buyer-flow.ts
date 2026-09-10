export function optionText(name?: string | null, value?: string | null): string {
  const n = name?.trim() || "", v = value?.trim() || "";
  return n && v && n !== v ? `${n}: ${v}` : v || n;
}

export function internalReturnPath(path: string | null): string {
  return path && path.startsWith("/") && !path.startsWith("//") && !/[\\\r\n]/.test(path) ? path : "/";
}

export type CartPayload = { product_id: string; option_id: string | null; quantity: number };
// Stop on the first failed item. Never automatically retry an uncertain write.
export async function submitCartItems(items: CartPayload[], send: (item: CartPayload) => Promise<Response>) {
  let completed = 0;
  for (const item of items) {
    try {
      const response = await send(item);
      if (response.status === 401) return { completed, unauthorized: true, error: "로그인이 필요합니다." };
      if (!response.ok) return { completed, unauthorized: false, error: "장바구니 저장에 실패했습니다. 장바구니에서 담긴 상품을 확인한 뒤 다시 시도해주세요." };
      completed++;
    } catch {
      return { completed, unauthorized: false, error: "저장 결과를 확인하지 못했습니다. 중복으로 담기지 않도록 장바구니를 먼저 확인해주세요." };
    }
  }
  return { completed, unauthorized: false, error: "" };
}
