"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/settlement";

interface Row {
  id: string;
  name: string;
  platform: string | null;
  profile_image: string | null;
  business_type: BusinessType | null;
  followers_count: number | null;
  category: string | null;
  account_email: string | null;
  campaign_count: number;
  order_count: number;
  gross_sales: number;
}

export default function InfluencersClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(query = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/influencers${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">인플루언서 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {rows.length}명</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            placeholder="이름 검색"
            className="border border-gray-200 rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[#C7D6C0]"
          />
          <Link
            href="/admin/influencers/new"
            className="bg-[#2D5A27] hover:bg-[#244B1F] text-white text-sm font-bold px-4 py-2 rounded-none transition-colors"
          >
            + 인플루언서 등록
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-none border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">등록된 인플루언서가 없어요</div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">이름</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">플랫폼</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">사업자유형</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-400">포털계정</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400">공구</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400">누적 판매</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-400">누적 매출</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {r.profile_image ? (
                        <img src={r.profile_image} alt={r.name} className="w-9 h-9 rounded-full object-cover bg-gray-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">🤝</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        {r.category && <p className="text-xs text-gray-400">{r.category}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.platform ?? "—"}
                    {r.followers_count != null && (
                      <span className="text-xs text-gray-400 ml-1.5">({Number(r.followers_count).toLocaleString()})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.business_type ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                        {BUSINESS_TYPE_LABEL[r.business_type] ?? r.business_type}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">미설정</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.account_email
                      ? <span className="text-green-600 font-medium">{r.account_email}</span>
                      : <span className="text-gray-300">미발급</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.campaign_count}건</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.order_count}건</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {r.gross_sales.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/influencers/${r.id}`} className="text-xs text-[#2D5A27] font-bold hover:text-[#244B1F]">
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
