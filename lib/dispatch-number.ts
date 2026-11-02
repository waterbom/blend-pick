// Assign before supplier/date sorting. Item IDs keep re-downloads and input reordering stable.
export function dispatchLineNumbers(orderNumber: string, items: { id?: string }[]): string[] {
  const ordered = items.map((item, index) => ({ id: item.id, index })).sort((a, b) =>
    a.id && b.id ? a.id.localeCompare(b.id) : a.id ? -1 : b.id ? 1 : a.index - b.index);
  const numbers: string[] = [];
  ordered.forEach((item, index) => { numbers[item.index] = `${orderNumber}-L${String(index + 1).padStart(3, '0')}`; });
  return numbers;
}

// The explicit L marker separates our line numbers from legacy supplier-added numeric suffixes.
export const dispatchOrderBase = (number: string): string => number.replace(/-L(?!0+$)\d{3,}$/, '');
