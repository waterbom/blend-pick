/** A unit's simple merchandise margin before taxes, payment fees, commissions, shipping and refunds.
 * Option "price" in this application is a complete unit selling price, NOT a surcharge. */
export type UnitMargin = {
  sellingPrice: number;
  supplyPrice: number;
  amount: number;
  /** Markup relative to supply (selling - supply) / supply, undefined when supply is zero. */
  supplyMarkupPercent: number | null;
  /** Margin relative to selling price, undefined when selling price is zero. */
  salesMarginPercent: number | null;
};
function money(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function calculateUnitMargin(
  price: number | string | null | undefined,
  supply: number | string | null | undefined,
): UnitMargin | null {
  const sellingPrice = money(price), supplyPrice = money(supply);
  if (sellingPrice === null || supplyPrice === null) return null;
  const amount = sellingPrice - supplyPrice;
  return {
    sellingPrice, supplyPrice, amount,
    supplyMarkupPercent: supplyPrice > 0 ? amount / supplyPrice * 100 : null,
    salesMarginPercent: sellingPrice > 0 ? amount / sellingPrice * 100 : null,
  };
}
export function unitMarginLabel(value: UnitMargin | null): string {
  if (!value) return '공급가·판매가 확인 필요';
  const won = Math.abs(value.amount).toLocaleString('ko-KR');
  const sign = value.amount < 0 ? '-' : value.amount > 0 ? '+' : '';
  const markup = value.supplyMarkupPercent === null
    ? '공급가 대비 비율 산정 불가'
    : '공급가 대비 '+(value.supplyMarkupPercent > 0 ? '+' : '')+value.supplyMarkupPercent.toFixed(1)+'%';
  return '개당 차익 '+sign+won+'원 · '+markup;
}
