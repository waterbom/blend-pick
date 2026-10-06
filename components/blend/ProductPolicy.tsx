import { REFUND_POLICY_SECTIONS } from "@/components/RefundPolicy";
import styles from "./ProductPolicy.module.css";

function PolicyIcon({ type }: { type: "return" | "delivery" | "exchange" }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === "delivery" ? <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8M4 17a2 2 0 1 0 4 0m8 0a2 2 0 1 0 4 0" /><path d="M18 9v4h4" /></>
      : type === "return" ? <><path d="M3 5v5h5M3 10a9 9 0 1 1 0 5" /><path d="M12 7v5l3 2" /></>
        : <><path d="M4 8h15l-4-4M20 16H5l4 4" /><path d="M20 8v3M4 16v-3" /></>}
  </svg>;
}

export default function ProductPolicy({ shipping, schedule }: { shipping?: string; schedule?: string }) {
  const [delivery, exchange, exclusions, refund] = REFUND_POLICY_SECTIONS;
  const deliveryItems = [
    shipping ? `배송 방법: 택배 · 배송 지역: 전국 · ${shipping}` : delivery.items[0],
    schedule || delivery.items[1],
    ...delivery.items.slice(2),
  ];

  return <section className={styles.policy} aria-labelledby="product-policy-title">
    <header className={styles.header}>
      <h2 id="product-policy-title">배송 · 교환 · 환불 안내</h2>
      <p>구매 전, 상품의 배송 일정과 교환·환불 기준을 확인해 주세요.</p>
    </header>

    <div className={styles.notice}>
      <div className={styles.noticeTitle}><PolicyIcon type="return" /><h3>청약철회 가능 · 수령 후 7일</h3></div>
      <p>{exchange.items[1]}. {exchange.items[3]}입니다.</p>
    </div>

    <div className={styles.disclosures}>
      <details className={styles.disclosure} open>
        <summary><PolicyIcon type="delivery" /><span>배송 안내 및 일정</span><span className={styles.chevron} aria-hidden="true" /></summary>
        <div className={styles.disclosureBody}>
          {deliveryItems.map((item, index) => <p key={item}><strong>{["배송 방법", "출고 일정", "추가 배송비"][index]}</strong><span aria-hidden="true"> — </span>{item.replace(/^배송 방법: |^배송 기간: /, "")}</p>)}
        </div>
      </details>
      <details className={styles.disclosure}>
        <summary><PolicyIcon type="exchange" /><span>교환·반품 기준</span><span className={styles.chevron} aria-hidden="true" /></summary>
        <div className={styles.disclosureBody}>
          <ul>{exchange.items.map(item => <li key={item}>{item}</li>)}</ul>
          <h3>{exclusions.title}</h3>
          <ul>{exclusions.items.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      </details>
    </div>

    <div className={styles.cards}>
      <article><h3>배송</h3><ul><li><strong>{schedule || delivery.items[1]}</strong></li><li>{shipping || "배송비: 주문서에서 확인"}</li><li>{delivery.items[2]}</li></ul></article>
      <article><h3>교환·반품</h3><ul><li><strong>{exchange.items[1]}</strong></li><li>{exchange.items[2]}</li><li>{exchange.items[3]}</li></ul></article>
      <article><h3>환불</h3><ul><li><strong>{refund.items[0]}</strong></li><li>{refund.items[1]}</li></ul></article>
    </div>
    <p className={styles.note}>※ 상품 훼손·사용 등으로 교환·반품이 제한될 수 있습니다. 위의 교환·반품 기준을 확인해 주세요.</p>
  </section>;
}
