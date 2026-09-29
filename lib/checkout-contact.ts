// Shared server validation, before reserving stock or contacting the payment provider.
const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.length <= max;
const phone = (value: unknown) => typeof value === 'string' && value.length <= 30 &&
    /^[\d\s()-]+$/.test(value) && /^0\d{8,11}$/.test(value.replace(/\D/g, ''));

export function buyerContactError(name: unknown, number: unknown): string | null {
    if (!text(name, 100)) return '주문자 이름을 입력해주세요.';
    if (!phone(number)) return '주문자 전화번호를 확인해주세요.';
    return null;
}

export function checkoutContactError(d: Record<string, unknown>): string | null {
    const buyer = buyerContactError(d.customerName, d.customerPhone);
    if (buyer) return buyer;
    if (!text(d.shippingName || d.customerName, 100)) return '수령인 이름을 입력해주세요.';
    if (!phone(d.shippingPhone || d.customerPhone)) return '수령인 전화번호를 확인해주세요.';
    if (typeof d.shippingZipcode !== 'string' || !/^\d{5}$/.test(d.shippingZipcode)) return '배송지 우편번호를 확인해주세요.';
    if (!text(d.shippingAddress, 300)) return '배송지 주소를 입력해주세요.';
    for (const [key, max] of [['shippingAddress2', 200], ['shippingMemo', 500], ['customerEmail', 254]] as const) {
        if (d[key] != null && (typeof d[key] !== 'string' || (d[key] as string).length > max)) return '주문자와 배송지 정보를 확인해주세요.';
    }
    return null;
}
