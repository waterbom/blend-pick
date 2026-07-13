"use client";

import { useEffect, useState } from "react";
import CopyLinkButton from "@/components/CopyLinkButton";
import { COST_CATEGORY_LABEL } from "@/lib/settlement";

interface Row {
  id: string;
  product_name: string;
  influencer_name: string;
  start_date: string;
  end_date: string;
  commission_rate: number | null;
  supply_price: number | null;
  is_archived: boolean;
  costs_total: number;
}

interface Cost {
  id: string;
  category: string;
  amount: number;
  memo: string | null;
}

const d = (s: string) => String(s).slice(0, 10);

export default function CampaignsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  // 편집 상태
  const [rate, setRate] = useState("");
  const [supply, setSupply] = useState("");
  const [costs, setCosts] = useState<Cost[]>([]);
  const [newCost, setNewCost] = useState({ category: "ad", amount: "", memo: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openDetail(id: string) {
    if (openId === id) { setOpenId(null); return; }
    const res = await fetch(`/api/admin/campaigns/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setRate(data.commission_rate != null ? String(Number(data.commission_rate)) : "");
    setSupply(data.supply_price != null ? String(data.supply_price) : "");
    setCosts(data.costs ?? []);
    setOpenId(id);
  }

  async function saveSettings(id: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commission_rate: rate === "" ? null : Number(rate),
        supply_price: supply === "" ? null : Number(supply),
      }),
    });
    setSaving(false);
    if (res.ok) { await load(); alert("저장되었습니다. (이후 결제되는 주문부터 적용)"); }
    else alert("저장 실패");
  }

  async function addCost(id: string) {
    if (!newCost.amount) { alert("금액을 입력해주세요."); return; }
    const res = await fetch(`/api/admin/campaigns/${id}/costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCost.category, amount: Number(newCost.amount), memo: newCost.memo }),
    });
    if (res.ok) {
      const { id: costId } = await res.json();
      setCosts((c) => [...c, { id: costId, category: newCost.category, amount: Math.round(Number(newCost.amount)), memo: newCost.memo || null }]);
      setNewCost({ category: "ad", amount: "", memo: "" });
      load();
    } else alert("추가 실패");
  }

  async function removeCost(id: string, costId: string) {
    const res = await fetch(`/api/admin/campaigns/${id}/costs/${costId}`, { method: "DELETE" });
    if (res.ok) { setCosts((c) => c.filter((x) => x.id !== costId)); load(); }
  }

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">공구 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          공구별 수수료율·공급가·기타비용 설정 및 인플루언서 전용 링크
        </p>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 text-center py-16 text-gray-400 text-sm">공구가 없어요</div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div
                onClick={() => openDetail(c.id)}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {c.product_name}
                    {c.is_archived && <span className="ml-2 text-xs font-medium text-gray-400">종료</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {c.influencer_name} · {d(c.start_date)} ~ {d(c.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className={c.commission_rate != null ? "font-bold text-orange-600" : "text-gray-300"}>
                    {c.commission_rate != null ? `수수료 ${Number(c.commission_rate)}%` : "요율 미설정"}
                  </span>
                  <span className={c.supply_price != null ? "text-gray-600" : "text-gray-300"}>
                    {c.supply_price != null ? `공급가 ${Number(c.supply_price).toLocaleString()}원` : "공급가 미설정"}
                  </span>
                  {c.costs_total > 0 && <span className="text-gray-600">비용 {c.costs_total.toLocaleString()}원</span>}
                  <CopyLinkButton campaignId={c.id} />
                </div>
              </div>

              {openId === c.id && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">수수료율 (%)</label>
                      <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min="0" max="100" step="0.01" className={`${inp} w-28`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">공급가 (개당, 원)</label>
                      <input value={supply} onChange={(e) => setSupply(e.target.value)} type="number" min="0" className={`${inp} w-36`} />
                    </div>
                    <button onClick={() => saveSettings(c.id)} disabled={saving}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-40">
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2">기타비용</p>
                    {costs.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {costs.map((cost) => (
                          <div key={cost.id} className="flex items-center justify-between text-sm bg-white border border-gray-100 rounded-lg px-3 py-2">
                            <span className="text-gray-700">
                              <b className="text-xs text-gray-500 mr-2">{COST_CATEGORY_LABEL[cost.category] ?? cost.category}</b>
                              {Number(cost.amount).toLocaleString()}원
                              {cost.memo && <span className="text-xs text-gray-400 ml-2">{cost.memo}</span>}
                            </span>
                            <button onClick={() => removeCost(c.id, cost.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <select value={newCost.category} onChange={(e) => setNewCost((n) => ({ ...n, category: e.target.value }))} className={inp}>
                        {Object.entries(COST_CATEGORY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input value={newCost.amount} onChange={(e) => setNewCost((n) => ({ ...n, amount: e.target.value }))}
                        type="number" min="0" placeholder="금액" className={`${inp} w-32`} />
                      <input value={newCost.memo} onChange={(e) => setNewCost((n) => ({ ...n, memo: e.target.value }))}
                        placeholder="메모 (선택)" className={`${inp} flex-1 min-w-[120px]`} />
                      <button onClick={() => addCost(c.id)}
                        className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700">
                        추가
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
