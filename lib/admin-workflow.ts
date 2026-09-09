export type ProductStage = 'ready' | 'selling' | 'closed';
export function productStage(p: {
    status: string;
    stock: number;
    sale_start_at?: string | null;
    sale_end_at?: string | null;
}, now = Date.now()): ProductStage {
    if (p.status === 'draft')
        return 'ready';
    if (p.status !== 'active' || Number(p.stock) === 0)
        return 'closed';
    if (p.sale_end_at && Date.parse(p.sale_end_at) <= now)
        return 'closed';
    if (p.sale_start_at && Date.parse(p.sale_start_at) > now)
        return 'ready';
    return 'selling';
}
export const STAGE_LABEL = { ready: '판매 준비', selling: '판매 중', closed: '판매 종료' };
export function linkStage(p: {
    link_code?: string | null;
    link_start_at?: string | null;
    link_end_at?: string | null;
}, now = Date.now()) {
    if (!p.link_code)
        return '없음';
    if (!p.link_start_at || !p.link_end_at || !Number.isFinite(Date.parse(p.link_end_at)) || Date.parse(p.link_end_at) <= now)
        return '만료';
    return p.link_start_at && Date.parse(p.link_start_at) > now ? '예약' : '사용 중';
}
export type DispatchOrder = {
    status: string;
    order_type?: string;
    paid_at?: unknown;
    payment_key?: string | null;
    payment_verified?: boolean;
    pending_refunds?: boolean;
    recipient_name?: string | null;
    buyer_name?: string | null;
    recipient_phone?: string | null;
    buyer_phone?: string | null;
    addr_zipcode?: string | null;
    addr_address?: string | null;
    items?: {
        product_name?: string;
        quantity: number;
        supplier_name?: string | null;
        expected_ship_date?: string | null;
    }[];
};
export function dispatchIssues(o: DispatchOrder): string[] {
    const issues: string[] = [];
    if (!['paid', 'confirmed'].includes(o.status))
        issues.push('신규·주문확인 상태가 아님');
    if (!o.paid_at || !(o.payment_verified === true || o.payment_key && !o.payment_key.startsWith('SIM_')))
        issues.push('실제 결제 확인 필요');
    if (o.pending_refunds)
        issues.push('환불 처리 중');
    if (!(o.recipient_name || o.buyer_name)?.trim())
        issues.push('수령인 누락');
    if (!(o.recipient_phone || o.buyer_phone)?.trim())
        issues.push('연락처 누락');
    if (!o.addr_zipcode?.trim() || !o.addr_address?.trim())
        issues.push('배송지 누락');
    if (!o.items?.length || o.items.some(i => !i.product_name || !Number.isInteger(Number(i.quantity)) || Number(i.quantity) <= 0))
        issues.push('상품·수량 확인 필요');
    return issues;
}
export function orderQueue(o: DispatchOrder) {
    if (o.order_type && !['shop', 'campaign'].includes(o.order_type))
        return 'history';
    if (['cancel_requested', 'exchange_requested', 'return_requested'].includes(o.status))
        return 'requests';
    if (['paid', 'confirmed'].includes(o.status))
        return dispatchIssues(o).length ? 'check' : 'ready';
    return 'history';
}
export function suggestCategories(name: string, categories: {
    name: string;
}[]): string[] {
    const text = name.toLowerCase();
    const sea = /(전복|새우|고등어|갈치|굴|꽃게|오징어|문어|낙지|해산물)/.test(text);
    const farm = /(사과|배추|고구마|감자|딸기|포도|한라봉|귤|토마토|복숭아|쌀|농산물)/.test(text);
    return categories.filter(c => text.includes(c.name.toLowerCase()) || c.name === '산지픽 해산물' && sea || c.name === '산지픽 농산물' && farm).map(c => c.name).slice(0, 3);
}
