export function normalizePaymentMethod(value: unknown): "transfer" | "card";
export function estimatePaymentFee(amount: number, method: unknown): number;
