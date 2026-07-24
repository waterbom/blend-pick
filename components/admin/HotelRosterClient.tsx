"use client";

import { useState } from "react";

/**
 * 호텔 명단 업데이트 — 호텔이 최종 전달한 엑셀(호텔 예약번호 포함)을 업로드하면
 * 예약번호별로 DB 현재 상태를 대조해 갱신본을 만든다. (호텔 담당자 요구 반영)
 *  · 연락처는 010… 형태 텍스트로 (숫자 셀이라 앞 0이 사라지던 문제)
 *  · 취소건: 상태 "취소" + 비고에 "취소 (M/D HH:MM)"
 *  · 변경건: 호텔 예약번호가 이미 발급된 행의 투숙일이 바뀐 경우만 비고에 "변경: 이전→현재"
 *  · 호텔 예약번호·요청사항 등 호텔 측 기입값은 그대로 유지
 */
export default function HotelRosterClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ total: number; cancelled: number; changed: number } | null>(null);
  const [error, setError] = useState("");

  const fixPhone = (v: string) => {
    const d = String(v || "").replace(/[^0-9]/g, "");
    return d && !d.startsWith("0") ? `0${d}` : d;
  };
  const md = (iso: string | null) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : "");

  async function handleFile(file: File) {
    setBusy(true); setError(""); setResult(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid: string[][] = (XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][])
        .map((r) => r.map((c) => String(c ?? "").trim()));

      // 헤더 행 찾기 (예약번호 컬럼 위치 기준)
      const headerIdx = grid.findIndex((r) => r.some((c) => c.includes("예약번호")) && r.some((c) => c.includes("연락처")));
      if (headerIdx < 0) { setError("헤더(예약번호·연락처)를 찾지 못했어요. 호텔 명단 파일이 맞는지 확인해주세요."); return; }
      const header = grid[headerIdx];
      const col = (name: string) => header.findIndex((c) => c.replace(/\s/g, "").includes(name));
      const cNo = col("예약번호"), cPhone = col("연락처"), cIn = col("체크인"), cOut = col("체크아웃"),
        cNights = col("박수"), cStatus = col("상태"), cHotelNo = col("호텔예약번호");
      let cNote = col("비고");

      const dataRows = grid.slice(headerIdx + 1).filter((r) => (r[cNo] || "").startsWith("BP-"));
      const nums = dataRows.map((r) => r[cNo]);

      const res = await fetch("/api/hotel-roster", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_numbers: nums }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { setError(d.error || "조회에 실패했어요."); return; }

      // 새 그리드 구성 — 헤더 위 안내문/제목 행은 원본 그대로 유지
      const outHeader = [...header];
      if (cNote < 0) { outHeader.push("비고"); cNote = outHeader.length - 1; }
      let cancelled = 0, changed = 0;
      // colored: 이번 갱신으로 내용이 바뀐 행 — 호텔 요청대로 노란색 표기
      const outRows: { row: string[]; colored: boolean }[] = dataRows.map((r) => {
        const row = [...r];
        while (row.length < outHeader.length) row.push("");
        const info = d.map[r[cNo]];
        if (!info) { row[cNote] = row[cNote] || "조회 안 됨"; return { row, colored: false }; }

        row[cPhone] = fixPhone(info.buyer_phone || r[cPhone]);
        const notes: string[] = [];
        let colored = false;
        const fileStatus = (r[cStatus] || "").trim();

        if (info.status === "cancelled") {
          row[cStatus] = "취소";
          notes.push(`취소${info.cancelled_at_kst ? ` (${info.cancelled_at_kst})` : ""}`);
          if (fileStatus !== "취소") { colored = true; cancelled++; } // 이번에 취소로 바뀐 행만 색표기
        } else {
          row[cStatus] = "예약확정";
          // 변경건 — 호텔 예약번호가 이미 발급된 행의 투숙일이 파일과 달라진 경우만 비고 기재
          const fileIn = (r[cIn] || "").slice(0, 10);
          const hasHotelNo = cHotelNo >= 0 && (r[cHotelNo] || "").trim() !== "";
          if (info.check_in && fileIn && fileIn !== info.check_in) {
            row[cIn] = info.check_in;
            row[cOut] = info.check_out || row[cOut];
            if (cNights >= 0 && info.check_in && info.check_out) {
              row[cNights] = String(Math.round((Date.parse(info.check_out) - Date.parse(info.check_in)) / 86400000));
            }
            if (hasHotelNo || info.stay_changed) {
              notes.push(`변경: ${md(fileIn)}→${md(info.check_in)} 입실`);
              colored = true; changed++;
            }
          }
        }
        if (notes.length) row[cNote] = notes.join(" · ");
        return { row, colored };
      });

      // ExcelJS로 생성 — 바뀐 행은 노란색 채움 (호텔이 쓰는 표기 방식 그대로)
      const ExcelJS = (await import("exceljs")).default;
      const owb = new ExcelJS.Workbook();
      const ows = owb.addWorksheet("예약명단");
      grid.slice(0, headerIdx).forEach((r) => ows.addRow(r));
      const hr = ows.addRow(outHeader);
      hr.font = { bold: true };
      hr.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDE8" } }; });
      outRows.forEach(({ row, colored }) => {
        const rr = ows.addRow(row);
        rr.getCell(cPhone + 1).numFmt = "@";
        if (colored) {
          for (let ci = 1; ci <= outHeader.length; ci++) {
            rr.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF200" } };
          }
        }
      });
      outHeader.forEach((h, i) => { ows.getColumn(i + 1).width = Math.max(10, Math.min(34, String(h).length * 2 + 8)); });

      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
      const buf = await owb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = `호텔예약명단_업데이트_${today}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setResult({ total: dataRows.length, cancelled, changed });
    } catch (e) {
      console.error(e);
      setError("파일 처리 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#1A1D18" }}>호텔 명단 업데이트</h1>
      </div>

      <div className="bg-white p-6" style={{ border: "1px solid #E2E2DC" }}>
        <label className="block border-2 border-dashed p-10 text-center text-sm cursor-pointer"
          style={{ borderColor: "#D6D6CF", color: busy ? "#8F948A" : "#5C6156" }}>
          {busy ? "대조 중…" : "호텔 명단 엑셀 선택 또는 클릭"}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>
        {error && <p className="text-xs mt-3" style={{ color: "#A6412F" }}>{error}</p>}
        {result && (
          <p className="text-xs mt-3 font-semibold" style={{ color: "#2D5A27" }}>
            ✓ 갱신본 다운로드 완료 — 총 {result.total}건 / 취소 {result.cancelled}건 / 변경 {result.changed}건 표시
          </p>
        )}
      </div>
    </div>
  );
}
