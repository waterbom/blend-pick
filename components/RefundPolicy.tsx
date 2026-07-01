const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "배송",
    items: [
      "배송 방법: 택배 · 배송 지역: 전국 · 배송비: 무료",
      "배송 기간: 결제 확인 후 3~7일 이내 출고",
      "산간·도서 지방은 추가 배송비가 발생할 수 있습니다.",
    ],
  },
  {
    title: "교환·반품",
    items: [
      "반품 주소: 경기도 안양시 만안구 병목안로 15",
      "재화 수령일부터 7일 이내 청약철회 가능",
      "표시·광고와 다른 경우: 수령일부터 3개월 또는 사실을 안 날부터 30일 이내",
      "고객 변심에 의한 반품 시 반송 비용은 고객 부담",
    ],
  },
  {
    title: "교환·반품 불가 사유",
    items: [
      "고객 귀책으로 재화가 훼손·멸실된 경우",
      "사용·소비로 재화의 가치가 현저히 감소한 경우",
      "시간 경과로 재판매가 곤란한 경우",
      "복제 가능한 재화의 포장을 훼손한 경우",
    ],
  },
  {
    title: "환불",
    items: [
      "반품 확인 후 3영업일 이내 환불 처리",
      "신용카드 결제는 카드 승인 취소로 처리 (일부 익월 정산될 수 있음)",
    ],
  },
];

export default function RefundPolicy() {
  return (
    <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
      <h2 className="text-base font-bold mb-5" style={{ color: "var(--text-primary)" }}>
        배송 · 교환 · 환불 안내
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        {SECTIONS.map((sec) => (
          <div key={sec.title}>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              {sec.title}
            </p>
            <ul className="space-y-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {sec.items.map((item, i) => (
                <li key={i} className="flex gap-1.5">
                  <span style={{ color: "var(--accent-light)" }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
