import { SITES, type SiteKey } from "@/lib/sites";
export const money = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 2147483647;
export function missingSupply(value: unknown, options: unknown): string | null {
    const active = (Array.isArray(options) ? options : []).filter(o => o?.name && o.active !== false);
    if (value != null && value !== '' && !money(value))
        return '공급가는 0 이상의 정수로 입력해주세요.';
    if (active.some(o => o.supply_price != null && o.supply_price !== '' && !money(o.supply_price)))
        return '옵션 공급가를 확인해주세요.';
    return money(value) || (active.length > 0 && active.every(o => money(o.supply_price))) ? null : '상품 공급가 또는 판매중 옵션별 공급가를 입력해주세요.';
}
export function productInputError(b: Record<string, unknown>, site: SiteKey): string | null {
    if (typeof b.name !== 'string' || !b.name.trim() || !money(b.price))
        return '상품명과 0 이상의 정수 판매가가 필요합니다.';
    if (typeof b.category !== 'string' || !b.category.trim() || (SITES.sanjipick.categories.includes(b.category) !== (site === 'sanjipick')))
        return '현재 사이트의 카테고리를 선택해주세요.';
    const supply = missingSupply(b.supply_price, b.options);
    if (supply)
        return supply;
    for (const field of ['stock', 'shipping_cost', 'per_unit_shipping_cost', 'island_shipping_cost', 'installation_cost']) {
        const v = b[field];
        if (v != null && v !== '' && !(field === 'stock' && Number(v) === -1) && !money(v))
            return `${field}: 0 이상의 정수로 입력해주세요.`;
    }
    if (b.influencer_rate != null && b.influencer_rate !== '' && (!(typeof b.influencer_rate === 'number' || typeof b.influencer_rate === 'string') || !Number.isFinite(Number(b.influencer_rate)) || Number(b.influencer_rate) < 0 || Number(b.influencer_rate) > 100))
        return '수수료율은 0~100 사이 숫자입니다.';
    if (b.tax_type != null && !['taxable', 'exempt'].includes(String(b.tax_type)))
        return '과세 구분을 확인해주세요.';
    if (b.status != null && !['active', 'draft', 'soldout', 'inactive', 'ended'].includes(String(b.status)))
        return '판매 상태를 확인해주세요.';
    for (const key of ['options', 'addons']) {
        if (b[key] != null && !Array.isArray(b[key]))
            return '옵션 목록을 확인해주세요.';
        const rows = (Array.isArray(b[key]) ? b[key] : []) as Record<string, unknown>[];
        const names = new Set();
        for (const o of rows) {
            if (!o?.name)
                continue;
            if (typeof o.name !== 'string' || names.has(o.name.trim()))
                return '옵션 이름은 중복 없이 입력해주세요.';
            names.add(o.name.trim());
            if (!money(o.price ?? 0) || key === 'options' && Number(o.stock) !== -1 && !money(o.stock ?? 0))
                return '옵션 가격·재고를 확인해주세요.';
            if (key === 'addons' && o.active !== false && !money(o.supply_price))
                return '판매중 추가상품의 공급가를 입력해주세요.';
        }
    }
    return null;
}
