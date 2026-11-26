export const DIRECT_DELIVERY_REASONS = {
  handed_over: "직접 전달 · 수령 확인",
  picked_up: "방문 수령 확인",
} as const;

export type DirectDeliveryReason = keyof typeof DIRECT_DELIVERY_REASONS;
export type DeliveryMode = "shipped" | "direct";
export type DeliveryResult = {
  id: string;
  orderNumber: string;
  result: "completed" | "skipped" | "failed";
  reason?: string;
};

export function isDirectDeliveryReason(value: unknown): value is DirectDeliveryReason {
  return typeof value === "string" && Object.hasOwn(DIRECT_DELIVERY_REASONS, value);
}
