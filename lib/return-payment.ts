import { RefundError } from "@/lib/refund-operation";

export async function returnPaymentBalance(paymentKey: string, total: number) {
  const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payment = await response.json().catch(() => null);
  if (!response.ok || payment?.paymentKey !== paymentKey || payment.totalAmount !== total ||
      !Number.isSafeInteger(payment.balanceAmount) || payment.balanceAmount < 0 || payment.balanceAmount > total)
    throw new RefundError("토스 결제 정보와 주문 금액을 대조할 수 없습니다.", 502);

  const cancels = (Array.isArray(payment.cancels) ? payment.cancels : []).map(
    (c: { cancelAmount: number; cancelReason?: string; canceledAt?: string }) => ({
      amount: Number(c.cancelAmount) || 0, reason: c.cancelReason || "", at: c.canceledAt || null,
    })
  );
  return { balance: payment.balanceAmount as number, canceled: total - payment.balanceAmount, cancels };
}
