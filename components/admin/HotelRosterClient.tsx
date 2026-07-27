"use client";

import { useState } from "react";
import type { Worksheet, Cell } from "exceljs";

/**
 * 호텔 명단 업데이트 — 엑셀을 업로드하면 예약번호별로 DB 현재 상태를 대조해 갱신본을 만든다.
 * 원본 파일을 그대로 열어 "바뀐 칸만" 수정하는 방식이라, 업로드한 파일의 서식
 * (직접 칠한 색·열 너비·시트명·추가 컬럼)이 전부 유지된다. 갱신된 행에만 노란색을 덧칠한다.
 *  · 연락처는 010… 형태 텍스트로 복원
 *  · 취소건: 상태 "취소" + 비고에 "취소 (M/D HH:MM)" — 파일에서 이미 취소였던 행은 색 없음
 *  · 변경건: 상태 "예약확정/변경요청" + 투숙일 갱신 + 비고 "변경: 이전→현재"
 *  · 비고의 기존 메모는 덮어쓰지 않고 뒤에 덧붙임 (중복 방지)
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

  // 셀 값을 문자열로 (날짜 셀은 YYYY-MM-DD, 리치텍스트·수식도 표시 텍스트 기준)
  const cellText = (cell: Cell): string => {
    const v = cell.value;
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(cell.text ?? v).trim();
  };

  async function handleFile(file: File) {
    setBusy(true); setError(""); setResult(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws: Worksheet = wb.worksheets[0];

      // 헤더 행 찾기 (예약번호·연락처가 같은 행에 있는 곳) — 어느 열에서 시작하든 무관
      let headerRow = 0;
      const colOf: Record<string, number> = {};
      for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
        const row = ws.getRow(r);
        const found: Record<string, number> = {};
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const t = cellText(cell).replace(/\s/g, "");
          for (const name of ["예약번호", "연락처", "체크인", "체크아웃", "박수", "상태", "호텔예약번호", "비고"]) {
            // "호텔예약번호"가 "예약번호"보다 먼저 매칭되게 정확도 순 검사
            if (name === "예약번호" && t.includes("호텔예약번호")) continue;
            if (t.includes(name) && found[name] == null) found[name] = colNumber;
          }
        });
        if (found["예약번호"] != null && found["연락처"] != null) {
          headerRow = r;
          Object.assign(colOf, found);
          break;
        }
      }
      if (!headerRow) { setError("헤더(예약번호·연락처)를 찾지 못했어요. 호텔 명단 파일이 맞는지 확인해주세요."); return; }

      const cNo = colOf["예약번호"], cPhone = colOf["연락처"], cIn = colOf["체크인"], cOut = colOf["체크아웃"],
        cNights = colOf["박수"], cStatus = colOf["상태"], cHotelNo = colOf["호텔예약번호"];
      let cNote = colOf["비고"];
      // 비고 열이 없으면 헤더의 마지막 사용 열 다음에 추가
      if (!cNote) {
        let last = cNo;
        ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (cellText(cell)) last = Math.max(last, colNumber);
        });
        cNote = last + 1;
        ws.getRow(headerRow).getCell(cNote).value = "비고";
      }
      // 노란색을 칠할 행 범위(헤더에서 값이 있는 열들)
      const usedCols: number[] = [];
      ws.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (cellText(cell)) usedCols.push(colNumber);
      });

      // 데이터 행 수집
      const dataRowNums: number[] = [];
      const nums: string[] = [];
      for (let r = headerRow + 1; r <= ws.rowCount; r++) {
        const no = cellText(ws.getRow(r).getCell(cNo));
        if (no.startsWith("BP-")) { dataRowNums.push(r); nums.push(no); }
      }
      if (nums.length === 0) { setError("예약번호(BP-…) 행을 찾지 못했어요."); return; }

      const res = await fetch("/api/hotel-roster", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_numbers: nums }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { setError(d.error || "조회에 실패했어요."); return; }

      let cancelled = 0, changed = 0;
      for (const r of dataRowNums) {
        const row = ws.getRow(r);
        const no = cellText(row.getCell(cNo));
        const info = d.map[no];
        const noteCell = row.getCell(cNote);
        if (!info) {
          if (!cellText(noteCell)) noteCell.value = "조회 안 됨";
          continue;
        }

        // 연락처 010 복원 (텍스트 서식) — 스타일은 복제 후 변경 (엑셀은 여러 셀이 서식을 공유해서
        // 그냥 바꾸면 같은 서식을 쓰는 다른 셀까지 같이 바뀐다)
        const phone = fixPhone(info.buyer_phone || cellText(row.getCell(cPhone)));
        if (phone) {
          const pc = row.getCell(cPhone);
          pc.value = phone;
          pc.style = { ...pc.style, numFmt: "@" };
        }

        const notes: string[] = [];
        let colored = false;
        const fileStatus = cellText(row.getCell(cStatus));

        if (info.status === "cancelled") {
          row.getCell(cStatus).value = "취소";
          notes.push(`취소${info.cancelled_at_kst ? ` (${info.cancelled_at_kst})` : ""}`);
          if (fileStatus !== "취소") { colored = true; cancelled++; } // 이번에 취소로 바뀐 행만 색표기
        } else {
          if (fileStatus !== "예약확정/변경요청") row.getCell(cStatus).value = "예약확정";
          // 변경건 — 파일의 체크인과 DB 투숙일이 다르면 날짜 갱신
          const fileIn = cIn ? cellText(row.getCell(cIn)).slice(0, 10) : "";
          const hasHotelNo = cHotelNo ? cellText(row.getCell(cHotelNo)) !== "" : false;
          if (cIn && info.check_in && fileIn && fileIn !== info.check_in) {
            row.getCell(cIn).value = info.check_in;
            if (cOut && info.check_out) row.getCell(cOut).value = info.check_out;
            if (cNights && info.check_in && info.check_out) {
              row.getCell(cNights).value = Math.round((Date.parse(info.check_out) - Date.parse(info.check_in)) / 86400000);
            }
            if (hasHotelNo || info.stay_changed) {
              row.getCell(cStatus).value = "예약확정/변경요청"; // 상태 칸만 봐도 변경건임을 알 수 있게
              notes.push(`변경: ${md(fileIn)}→${md(info.check_in)} 입실`);
              colored = true; changed++;
            }
          }
        }

        if (notes.length) {
          // 기존 비고 메모는 유지하고 뒤에 덧붙임 (같은 내용이면 중복 방지)
          const prev = cellText(noteCell);
          const add = notes.filter((n) => !prev.includes(n));
          if (add.length) noteCell.value = [prev, ...add].filter(Boolean).join(" · ");
        }
        if (colored) {
          for (const ci of usedCols) {
            const cell = row.getCell(ci);
            // 공유 서식 오염 방지 — 스타일 객체를 새로 만들어 이 셀에만 노란색 적용
            cell.style = { ...cell.style, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF200" } } };
          }
        }
      }

      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = `호텔예약명단_업데이트_${today}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setResult({ total: nums.length, cancelled, changed });
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
          <input type="file" accept=".xlsx" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>
        {error && <p className="text-xs mt-3" style={{ color: "#A6412F" }}>{error}</p>}
        {result && (
          <p className="text-xs mt-3 font-semibold" style={{ color: "#2D5A27" }}>
            ✓ 갱신본 다운로드 완료 — 총 {result.total}건 / 취소 {result.cancelled}건 / 변경 {result.changed}건 표시
            (원본 서식 유지)
          </p>
        )}
      </div>
    </div>
  );
}
