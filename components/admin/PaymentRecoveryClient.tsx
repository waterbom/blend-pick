"use client";
import { useEffect, useState } from "react";
type Row = {
    provider_order_id: string;
    amount: number;
    status: string;
    last_error: string | null;
    created_at: string;
};
export default function PaymentRecoveryClient() {
    const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    async function load() { try {
        const r = await fetch('/api/admin/payment-recovery');
        if (!r.ok)
            throw Error('조회 실패');
        setRows(await r.json());
    }
    catch {
        setError('결제 확인 목록을 불러오지 못했습니다.');
    } }
    useEffect(() => { void load(); }, []);
    async function recover(id: string) { setBusy(true); setError(''); try {
        const r = await fetch('/api/admin/payment-recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: id }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error);
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '확인 실패');
    }
    finally {
        setBusy(false);
    } }
    return <section><h1 className="text-xl font-bold mb-2">결제 확인·복구</h1><p className="text-sm text-gray-600 mb-5">승인·주문 저장 결과를 확인할 결제입니다. 결제사 조회로 승인 완료를 확인하면 주문을 복구하고, 실패·취소가 확정되면 예약 재고를 돌려놓습니다. 새로운 결제를 승인하는 버튼이 아닙니다.</p>
 {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
 <button onClick={load} disabled={busy} className="border px-3 py-2 mb-4">새로고침</button>
 <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>결제 요청번호</th><th>금액</th><th>접수 시각</th><th>확인 사유</th><th>처리</th></tr></thead><tbody>{rows.map(r => <tr key={r.provider_order_id} className="border-t"><td className="py-4">{r.provider_order_id}</td><td>{Number(r.amount).toLocaleString()}원</td><td>{new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td><td>{r.last_error || '승인·저장 결과 확인 중'}</td><td><button disabled={busy} onClick={() => recover(r.provider_order_id)} className="border px-3 py-2">결제사 확인·복구</button></td></tr>)}</tbody></table></div>{!rows.length && <p className="py-6 text-gray-500">확인이 필요한 결제가 없습니다.</p>}</section>;
}
