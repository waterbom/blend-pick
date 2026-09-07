import Link from "next/link";
import CancelOrderButton from "@/components/CancelOrderButton";
import { carrierName, trackingUrl } from "@/lib/carriers";
import { RETURN_KIND_LABEL } from "@/lib/returns";
import type { getOrders } from "@/lib/customer-orders";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid:               { label: "결제완료",   color: "text-blue-500" },
  confirmed:          { label: "주문확인",   color: "text-blue-600" },
  preparing:          { label: "배송준비",   color: "text-yellow-500" },
  shipped:            { label: "배송중",     color: "text-orange-500" },
  delivered:          { label: "배송완료",   color: "text-green-500" },
  cancelled:          { label: "취소됨",     color: "text-gray-400" },
  cancel_requested:   { label: "취소요청중", color: "text-red-400" },
  exchange_requested: { label: "교환신청",   color: "text-purple-500" },
  exchange_completed: { label: "교환완료",   color: "text-purple-400" },
  return_requested:   { label: "반품신청",   color: "text-orange-400" },
  return_completed:   { label: "반품완료",   color: "text-orange-300" },
};


export default function CustomerOrders({ orders, sanjiBase }: { orders: Awaited<ReturnType<typeof getOrders>>; sanjiBase?: string }) {
  return (
        <section id="orders" className="mb-10">
          <div className="ds-section-title mb-4"><span>주문 내역</span></div>
          {orders === null ? (
            <div role="alert" className="ds-card p-5 text-sm">주문 내역을 불러오지 못했습니다. 잠시 후 새로고침해주세요.</div>
          ) : orders.length === 0 ? (
            <div className="ds-card p-5 text-sm" style={{ color: "var(--text-muted)" }}>
              {sanjiBase !== undefined ? "아직 산지픽 주문 내역이 없습니다." : "구매 내역이 없습니다."}
              {sanjiBase !== undefined && <Link href={`${sanjiBase}/products`} className="block mt-4 font-semibold underline">제철 상품 둘러보기</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const statusInfo = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-gray-400" };
                const paidAt = order.paid_at
                  ? new Date(order.paid_at).toLocaleDateString("ko-KR")
                  : "";
                return (
                  <div key={order.id} className="ds-card">
                    {/* 주문 헤더 스트립 */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="ds-mono text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{paidAt}</span>
                        <span className="ds-mono text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{order.order_number}</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* 아이템 목록 */}
                    <div className="space-y-1.5 px-5 pt-4 mb-3">
                      {order.items.map((item: { product_id: string; product_name: string; option_label: string | null; unit_price: number; quantity: number }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <Link
                            href={item.product_id ? (sanjiBase !== undefined ? `${sanjiBase}/p/${item.product_id}` : `/products/${item.product_id}`) : "#orders"}
                            className="text-sm font-medium hover:underline truncate max-w-[220px]"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.product_name}
                            {item.option_label && (
                              <span className="font-normal" style={{ color: "var(--text-muted)" }}> / {item.option_label}</span>
                            )}
                          </Link>
                          <span className="text-xs shrink-0 ml-3" style={{ color: "var(--text-muted)" }}>
                            {Number(item.unit_price).toLocaleString("ko-KR")}원 × {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 배송지 */}
                    {order.addr_address && (
                      <p className="px-5 pb-2 m-0 text-xs" style={{ color: "var(--text-muted)" }}>
                        배송지 · {order.recipient_name ?? order.buyer_name} · {order.addr_address}{order.addr_detail ? ` ${order.addr_detail}` : ""}
                      </p>
                    )}

                    {/* 상태 타임라인 — 결제 완료 → 상품 준비 → 배송 중 → 배송 완료 (발송·완료일 병기) */}
                    {["paid", "confirmed", "preparing", "shipped", "delivered"].includes(order.status) && (
                      <div className="flex flex-wrap items-center gap-y-1 px-5 pb-3">
                        {(() => {
                          const stepIdx = order.status === "delivered" ? 3 : order.status === "shipped" ? 2 : order.status === "preparing" ? 1 : 0;
                          return ["결제 완료", "상품 준비", "배송 중", "배송 완료"].map((label, i) => (
                            <span key={label} className="flex items-center">
                              <span className="text-[10.5px] font-bold" style={{ color: i <= stepIdx ? "var(--accent)" : "#B4B0A2" }}>{label}</span>
                              {i < 3 && <span className="inline-block w-6 sm:w-8 h-px mx-1.5" style={{ background: i < stepIdx ? "var(--accent)" : "var(--line)" }} />}
                            </span>
                          ));
                        })()}
                        {(order.shipped_kst || order.delivered_kst) && (
                          <span className="ds-mono text-[10.5px] ml-3" style={{ color: "var(--text-muted)" }}>
                            {order.shipped_kst && `발송 ${order.shipped_kst}`}
                            {order.shipped_kst && order.delivered_kst && " · "}
                            {order.delivered_kst && `완료 ${order.delivered_kst}`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 교환·반품 진행 타임라인 — 신청 접수 → 수거·처리 중 → 완료 */}
                    {order.latest_return && order.latest_return.status !== "rejected" && (
                      <div className="flex flex-wrap items-center gap-y-1 px-5 pb-3">
                        {(() => {
                          const r = order.latest_return;
                          const kindLabel = RETURN_KIND_LABEL[r.kind] ?? r.kind;
                          const stepIdx = r.status === "done" ? 2 : r.status === "collecting" ? 1 : 0;
                          return (
                            <>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 mr-2 shrink-0"
                                style={{ color: "#6D28D9", background: "#F3EFFB" }}>{kindLabel}</span>
                              {["신청 접수", "수거·처리 중", `${kindLabel} 완료`].map((label, i) => (
                                <span key={label} className="flex items-center">
                                  <span className="text-[10.5px] font-bold" style={{ color: i <= stepIdx ? "#6D28D9" : "#B4B0A2" }}>{label}</span>
                                  {i < 2 && <span className="inline-block w-6 sm:w-8 h-px mx-1.5" style={{ background: i < stepIdx ? "#6D28D9" : "var(--line)" }} />}
                                </span>
                              ))}
                              <span className="ds-mono text-[10.5px] ml-3" style={{ color: "var(--text-muted)" }}>신청 {r.created_kst}</span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {order.latest_return?.status === "rejected" && (
                      <p className="px-5 pb-3 text-[11px] m-0" style={{ color: "#B08968" }}>
                        교환·반품 신청이 거절되었어요.
                        {order.return_reject_note ? ` 사유: ${order.return_reject_note}` : " 자세한 내용은 카카오 채널로 문의해주세요."}
                      </p>
                    )}

                    {/* 총액 + 버튼 */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <span className="ds-mono text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {Number(order.total_amount).toLocaleString()}원
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {(order.status === "shipped" || order.status === "delivered") &&
                          order.tracking_company && order.tracking_number && (
                          <a
                            href={trackingUrl(order.tracking_company, order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3.5 py-2 transition-colors"
                            style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
                          >
                            {carrierName(order.tracking_company)} 조회
                          </a>
                        )}
                        {["paid", "confirmed", "preparing", "shipped"].includes(order.status) && (
                          <CancelOrderButton orderId={order.id} status={order.status} />
                        )}
                        {["shipped", "delivered"].includes(order.status) &&
                          !(order.latest_return && ["requested", "collecting"].includes(order.latest_return.status)) && (
                          <Link
                            href={`${sanjiBase ?? ""}/mypage/returns/new?order=${order.id}`}
                            className="text-xs px-3.5 py-2 transition-colors"
                            style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
                          >
                            교환·반품
                          </Link>
                        )}
                        {order.status === "delivered" && order.items[0]?.product_id && (
                          order.items[0]?.reviewed ? (
                            <span className="text-xs font-semibold px-3.5 py-2" style={{ border: "1px solid var(--line)", color: "#8F948A" }}>
                              리뷰 작성완료 ✓
                            </span>
                          ) : (
                            <Link
                              href={sanjiBase !== undefined ? `${sanjiBase}/mypage/reviews/new?product=${order.items[0].product_id}` : `/products/${order.items[0].product_id}#review`}
                              className="text-xs font-semibold px-3.5 py-2"
                              style={{ border: "1px solid var(--accent-hover)", color: "var(--accent-hover)" }}
                            >
                              리뷰 쓰기
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

  );
}
