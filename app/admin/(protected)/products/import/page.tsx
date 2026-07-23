"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALL_FIELDS = [
  { value: "__skip__", label: "— 가져오지 않음 —" },
  { value: "name",          label: "상품명" },
  { value: "brand",         label: "브랜드" },
  { value: "description",   label: "제품설명" },
  { value: "price",         label: "판매가" },
  { value: "original_price",label: "정가" },
  { value: "stock",         label: "재고" },
  { value: "category",      label: "카테고리" },
  { value: "status",        label: "상태" },
  { value: "shipping_type", label: "배송유형" },
  { value: "shipping_cost", label: "배송비" },
  { value: "main_image",    label: "이미지URL" },
];

interface PreviewData {
  headers: string[];
  rows: string[][];
  mapping: Record<string, string>;
  totalRows: number;
  previewRows: string[][];
}

export default function ProductImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setPreview(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/products/import", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "파싱 실패");
    } else {
      setPreview(data);
      setMapping(Object.fromEntries(Object.entries(data.mapping).map(([k, v]) => [k, String(v)])));
    }
    setUploading(false);
  }

  async function handleConfirm() {
    if (!preview) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/products/import", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headers: preview.headers, rows: preview.rows, mapping }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "저장 실패");
    } else {
      setResult(data);
      setPreview(null);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">엑셀 일괄 업로드</h1>
          <p className="text-sm text-gray-400 mt-0.5">xlsx / csv 파일로 상품을 한 번에 등록해요</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/products/import/template"
            className="text-xs font-bold text-blue-500 border border-blue-200 px-3 py-2 rounded-none hover:bg-blue-50 transition-colors">
            템플릿 다운로드
          </a>
          <Link href="/admin/products"
            className="text-xs font-bold text-gray-500 border border-gray-200 px-3 py-2 rounded-none hover:bg-gray-50 transition-colors">
            목록으로
          </Link>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-none p-5 mb-6">
          <p className="text-sm font-bold text-green-700 mb-1">업로드 완료</p>
          <p className="text-sm text-green-600">
            {result.saved}개 등록 완료
            {result.skipped > 0 && ` · ${result.skipped}개 건너뜀`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-500 space-y-0.5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button onClick={() => router.push("/admin/products")}
            className="mt-3 text-xs font-bold text-white bg-green-600 px-4 py-2 rounded-none hover:bg-green-700 transition-colors">
            상품 목록 보기
          </button>
        </div>
      )}

      {/* 파일 업로드 */}
      {!preview && !result && (
        <div className="bg-white rounded-none border border-gray-100 p-8">
          <div
            className="border-2 border-dashed border-gray-200 rounded-none p-12 text-center cursor-pointer hover:border-[#2D5A27] hover:bg-[#EAF0E6] transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-bold text-gray-700">클릭하여 파일 선택</p>
            <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv 파일 지원</p>
            {uploading && <p className="text-xs text-[#2D5A27] mt-3 animate-pulse">파일 분석 중...</p>}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            className="hidden" onChange={handleFileChange} />

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

          <div className="mt-6 p-4 bg-gray-50 rounded-none">
            <p className="text-xs font-bold text-gray-500 mb-2">사용 방법</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>위 템플릿 다운로드 버튼으로 양식 다운로드</li>
              <li>양식에 맞게 상품 정보 입력</li>
              <li>파일 업로드 후 컬럼 매핑 확인</li>
              <li>미리보기 확인 후 등록 확정</li>
            </ol>
          </div>
        </div>
      )}

      {/* 미리보기 + 컬럼 매핑 */}
      {preview && (
        <div className="space-y-4">
          {/* 컬럼 매핑 */}
          <div className="bg-white rounded-none border border-gray-100 p-6">
            <p className="text-sm font-bold text-gray-700 mb-1">컬럼 매핑 확인</p>
            <p className="text-xs text-gray-400 mb-4">각 엑셀 컬럼을 어떤 항목으로 가져올지 확인·조정해요</p>
            <div className="grid grid-cols-2 gap-3">
              {preview.headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-28 truncate shrink-0 bg-gray-50 px-2 py-1.5 rounded">
                    {header}
                  </span>
                  <span className="text-gray-300 text-xs">→</span>
                  <select
                    value={mapping[String(i)] ?? "__skip__"}
                    onChange={(e) => setMapping((m) => ({ ...m, [String(i)]: e.target.value }))}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#C7D6C0]"
                  >
                    {ALL_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 미리보기 테이블 */}
          <div className="bg-white rounded-none border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-700">
                ��리보기
                <span className="text-xs font-normal text-gray-400 ml-2">
                  상위 10행 / 전체 {preview.totalRows}행
                </span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-gray-400 font-bold whitespace-nowrap">
                        {h}
                        {mapping[String(i)] && mapping[String(i)] !== "__skip__" && (
                          <span className="ml-1 text-[#7A8B6F]">({mapping[String(i)]})</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.previewRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-xs truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => { setPreview(null); setResult(null); }}
              className="flex-1 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-none text-sm hover:bg-gray-50 transition-colors">
              다시 선택
            </button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex-1 bg-[#2D5A27] hover:bg-[#244B1F] text-white font-bold py-2.5 rounded-none text-sm transition-colors disabled:opacity-50">
              {saving ? `등록 중...` : `${preview.totalRows}개 상품 등록 확정`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
