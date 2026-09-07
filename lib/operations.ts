import shopPool from "@/lib/db-shop";
import { SITES, type SiteKey } from "@/lib/sites";

export type WorkItem = {
  id: string; label: string; detail: string; href: string;
  elapsed: string; priority: "first" | "today"; nextAction: string; actionLabel: string;
};
export type WorkGroup = {
  key: string; title: string; explanation: string; total: number; items: WorkItem[];
  steps: string[]; resolvedWhen: string; sortLabel: string;
};
type Row = {
  id: string; label: string; detail: string; total: string | number;
  age_hours: string | number | null; event_at: string | null;
  status?: string; stock?: number; kind?: string;
};

// DB 시각으로 계산한 경과 시간. 날짜가 없으면 다른 시각으로 추정하지 않는다.
export function workElapsed(hours: Row["age_hours"], origin: string): string {
  if (hours === null || !Number.isFinite(Number(hours))) return `${origin} 시각 미기록`;
  const elapsed = Math.floor(Number(hours));
  if (elapsed < 0) return `${origin} 시각 확인 필요`;
  if (elapsed < 1) return `${origin} 후 1시간 미만`;
  return `${origin} 후 ${elapsed >= 24 ? `${Math.floor(elapsed / 24)}일 ${elapsed % 24}시간` : `${elapsed}시간`} 경과`;
}

// 조회 전용. 우선순위와 72시간 기준은 확인 순서이며 배송 약속 위반 판정이 아니다.
export async function getTodayWork(site: SiteKey): Promise<WorkGroup[]> {
  const specs = [
    { key: "unshipped", title: "결제 후 3일 이상 미출고", explanation: "결제 완료·주문 확인·배송 준비 상태 중 결제 후 72시간 이상 지난 주문입니다. 예약 출고일을 먼저 확인하세요.",
      steps: ["주문 상품과 약속된 출고일 확인", "공급사에 발주 접수·출고 가능일 확인", "실제 발송 후 택배사·운송장 등록"],
      resolvedWhen: "실제 발송 후 배송중으로 반영되거나 주문이 취소되면 다음 조회에서 제외됩니다. 주문 확인·배송 준비로만 바꾸면 계속 표시됩니다.",
      sortLabel: "결제가 오래된 순", origin: "결제",
      sql: `SELECT id, order_number AS label, status,
          CASE status WHEN 'paid' THEN '결제 완료 · 발주 확인 필요' WHEN 'confirmed' THEN '주문 확인 · 출고 일정 확인 필요' ELSE '배송 준비 · 발송 여부 확인 필요' END AS detail,
          EXTRACT(EPOCH FROM (NOW() - paid_at))/3600 AS age_hours,
          to_char(paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY/MM/DD HH24:MI') AS event_at, COUNT(*) OVER() AS total
        FROM orders WHERE site = $1 AND status IN ('paid', 'confirmed', 'preparing') AND order_type IN ('shop', 'campaign') AND paid_at <= NOW() - INTERVAL '72 hours'
        ORDER BY paid_at ASC, id ASC LIMIT 30`, params: [site],
      item: (row: Row) => ({ href: `/admin/orders/${row.id}`, priority: "today" as const, actionLabel: "주문·출고 확인", nextAction: row.status === 'paid' ? "공급사 발주 접수 여부와 예약 출고일을 확인하세요." : row.status === 'confirmed' ? "공급사의 출고 가능일을 확인하고, 약속된 출고일과 비교하세요." : "실제 발송 여부를 확인하고 발송됐다면 운송장을 등록하세요." }) },
    { key: "tracking", title: "배송 중 · 송장 정보 누락", explanation: "배송중인데 택배사 또는 운송장번호가 없어 배송 조회가 어려운 주문입니다. 먼저 확인하세요.",
      steps: ["누락된 항목 확인", "공급사 발송 내역과 송장 대조", "주문 상세에서 누락 송장 정보 저장"],
      resolvedWhen: "택배사와 운송장번호가 모두 저장되면 다음 조회에서 제외됩니다.", sortLabel: "출고 시각 미기록 우선, 출고가 오래된 순", origin: "출고",
      sql: `SELECT id, order_number AS label,
          CASE WHEN NULLIF(TRIM(tracking_number), '') IS NULL AND NULLIF(TRIM(tracking_company), '') IS NULL THEN '택배사·운송장번호 모두 누락'
            WHEN NULLIF(TRIM(tracking_number), '') IS NULL THEN '운송장번호 누락' ELSE '택배사 누락' END AS detail,
          EXTRACT(EPOCH FROM (NOW() - shipped_at))/3600 AS age_hours,
          to_char(shipped_at AT TIME ZONE 'Asia/Seoul', 'YYYY/MM/DD HH24:MI') AS event_at, COUNT(*) OVER() AS total
        FROM orders WHERE site = $1 AND status = 'shipped' AND (NULLIF(TRIM(tracking_number), '') IS NULL OR NULLIF(TRIM(tracking_company), '') IS NULL)
        ORDER BY shipped_at ASC NULLS FIRST, id ASC LIMIT 30`, params: [site],
      item: (row: Row) => ({ href: `/admin/orders/${row.id}#tracking`, priority: "first" as const, actionLabel: "누락 송장 입력", nextAction: "공급사에서 택배사·운송장번호를 받아 주문 상세의 배송 처리에 저장하세요." }) },
    { key: "stock", title: "잔여 재고 5개 이하", explanation: "판매 기간 중인 상품의 본품 재고 기준입니다. 품절을 먼저 확인하고, 옵션 재고와 실제 가용 재고를 대조하세요.",
      steps: ["본품·옵션 재고와 공급사 가용 수량 대조", "추가 공급 가능 여부 확인", "확인된 재고 또는 판매 상태 반영"],
      resolvedWhen: "본품 재고가 5개를 초과하거나 판매가 중단·종료되면 다음 조회에서 제외됩니다. 확인만으로는 제외되지 않습니다.", sortLabel: "품절 우선, 재고가 적은 순", origin: "",
      sql: `SELECT id, name AS label, stock, CASE WHEN stock = 0 THEN '품절 · 본품 재고 0개' ELSE '본품 잔여 ' || stock || '개' END AS detail,
          NULL AS age_hours, NULL AS event_at, COUNT(*) OVER() AS total
        FROM products_shop WHERE status = 'active' AND stock BETWEEN 0 AND 5
        AND (sale_start_at IS NULL OR sale_start_at <= NOW()) AND (sale_end_at IS NULL OR sale_end_at > NOW())
        AND CASE WHEN $1 = 'sanjipick' THEN category = ANY($2::text[]) ELSE NOT COALESCE(category = ANY($2::text[]), false) END
        ORDER BY stock ASC, created_at ASC, id ASC LIMIT 30`, params: [site, SITES.sanjipick.categories],
      item: (row: Row) => ({ href: `/admin/products/${row.id}`, priority: row.stock === 0 ? "first" as const : "today" as const, actionLabel: "재고·판매 상태 확인", nextAction: row.stock === 0 ? "재입고 가능일을 확인하고, 판매를 계속할지 중단할지 결정하세요." : "공급사 가용 수량과 옵션별 재고를 대조한 뒤 확인된 수량을 반영하세요." }) },
    { key: "returns", title: "새 교환·반품 신청", explanation: "아직 접수 상태인 신청입니다. 신청 사유와 사진을 확인해 수거·처리 여부를 판단하세요.",
      steps: ["신청 상품·사유·사진 확인", "수거지와 비용 부담 확인", "접수 검토 후 수거·처리 중으로 반영하거나 사유를 남겨 거절"],
      resolvedWhen: "수거·처리 중으로 전환하거나 완료·거절하면 새 신청 목록에서 제외됩니다. 수거 중인 건은 배송관리에서 계속 처리하세요.", sortLabel: "신청이 오래된 순", origin: "신청",
      sql: `SELECT r.id, o.order_number AS label, r.kind,
          (CASE WHEN r.kind = 'exchange' THEN '교환 접수' ELSE '반품 접수' END) || ' · ' || COALESCE(NULLIF(TRIM(r.reason), ''), '사유 미기록') AS detail,
          EXTRACT(EPOCH FROM (NOW() - r.created_at))/3600 AS age_hours,
          to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY/MM/DD HH24:MI') AS event_at, COUNT(*) OVER() AS total
        FROM order_returns r JOIN orders o ON o.id = r.order_id WHERE o.site = $1 AND r.status = 'requested'
        ORDER BY r.created_at ASC, r.id ASC LIMIT 30`, params: [site],
      item: (row: Row) => ({ href: `/admin/shipments?tab=${row.kind === 'exchange' ? 'exchange_requested' : 'return_requested'}&requestId=${encodeURIComponent(row.id)}`, priority: "today" as const, actionLabel: row.kind === 'exchange' ? "교환 신청 검토" : "반품 신청 검토", nextAction: "신청 상세에서 사유·사진·수거지를 확인하고 수거 진행 여부를 판단하세요." }) },
  ];
  return Promise.all(specs.map(async spec => {
    const { rows } = await shopPool.query<Row>(spec.sql, spec.params);
    return { key: spec.key, title: spec.title, explanation: spec.explanation, steps: spec.steps, resolvedWhen: spec.resolvedWhen, sortLabel: spec.sortLabel,
      total: Number(rows[0]?.total ?? 0), items: rows.map(row => ({ id: row.id, label: row.label,
        detail: row.detail, elapsed: spec.origin ? `${workElapsed(row.age_hours, spec.origin)}${row.event_at ? ` · ${row.event_at} KST` : ''}` : '현재 재고 기준 · 소진 시점 미기록', ...spec.item(row) })) };
  }));
}
