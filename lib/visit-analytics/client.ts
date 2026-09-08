import { UUID, VISITOR_LIFETIME_MS } from '@/lib/visit-analytics/rules';
export function browserVisitor(storage: Pick<Storage, 'getItem' | 'setItem'>, now: number, uuid: () => string): string | null {
  try {
    const old = JSON.parse(storage.getItem('bp_visit_v1') || 'null');
    if (old && typeof old.id === 'string' && UUID.test(old.id) && typeof old.createdAt === 'number' && now >= old.createdAt && now - old.createdAt < VISITOR_LIFETIME_MS) return old.id;
    const id = uuid();
    storage.setItem('bp_visit_v1', JSON.stringify({ id, createdAt: now }));
    return id;
  } catch { return null; } // 저장이 막히면 임시 ID로 방문자 수를 부풀리지 않는다.
}
