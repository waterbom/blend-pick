"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * 호텔 작업지시서 발행 — 지난 발행 이후 변경분만 "지시문" 형태의 엑셀로 만든다.
 * · 명단 전체를 주고받지 않는다: 신규/대체/변경/취소 4개 섹션 + "그 외 변동 없음" 명시
 * · 대체(재결제)는 한 줄로 병합 — 호텔이 취소만 보고 방을 빼는 사고 방지
 * · 다운로드 시 발행 기록을 남겨 다음 회차의 기준 시각이 된다 (참고용 전체 현황 시트 포함)
 */

interface Row {
  order_number: string; buyer_name: string; buyer_phone: string;
  room: string; pkg: string; request: string;
  check_in: string | null; check_out: string | null; nights: number | null;
  cancelled_kst: string | null;
  influencer: string | null;
  change_label: string | null;
}
interface Data {
  baseline: string | null; lastIssuedAt: string | null; issueNo: number; now: string;
  added: Row[]; replaced: { old: Row; next: Row }[]; changed: Row[]; cancelled: Row[]; roster: Row[];
}

const COLORS = { added: "FFC6EFCE", replaced: "FFFFE699", changed: "FFFFF200", cancelled: "FFFFC7CE" };
const kst = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : "";
const md = (d: string | null) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
// datetime-local(KST 입력)을 ISO(+09:00)로
const localToIso = (v: string) => (v ? `${v}:00+09:00` : "");

export default function HotelWorksheetClient() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [sinceInput, setSinceInput] = useState("");
  const [infSel, setInfSel] = useState(""); // "" = 전체, 이름 = 해당 인플루언서 예약만
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<number | null>(null);
  const [stamped, setStamped] = useState(0);

  async function load(since?: string) {
    setBusy(true); setError(""); setIssued(null);
    try {
      const qs = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await fetch(`/api/admin/hotel-worksheet${qs}`);
      const d = await res.json();
      if (!res.ok || !d.ok) { setError(d.error || "계산에 실패했어요."); return; }
      setData(d);
      if (!since) setSinceInput(d.baseline ? kst(d.baseline).replace(" ", "T") : "");
    } catch {
      setError("계산에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, []);

  // 인플루언서 필터 — 지시서·전체현황 모두에 적용 (대체 쌍은 새 예약 기준)
  const view = useMemo(() => {
    if (!data) return null;
    const hit = (r: Row) => !infSel || r.influencer === infSel;
    return {
      ...data,
      added: data.added.filter(hit),
      replaced: data.replaced.filter((p) => hit(p.next)),
      changed: data.changed.filter(hit),
      cancelled: data.cancelled.filter(hit),
      roster: data.roster.filter(hit),
    };
  }, [data, infSel]);
  const influencerOptions = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    [...data.added, ...data.changed, ...data.cancelled, ...data.roster, ...data.replaced.map((p) => p.next)]
      .forEach((r) => { if (r.influencer) s.add(r.influencer); });
    return [...s].sort();
  }, [data]);
  const total = view ? view.added.length + view.replaced.length + view.changed.length + view.cancelled.length : 0;

  async function download() {
    if (!data || !view) return;
    const d = view;
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("작업지시서");
      const HEAD = ["액션", "예약번호", "예약자", "연락처", "객실", "패키지", "체크인", "체크아웃", "박수", "지시 내용"];

      const title = ws.addRow([`■ 여수 UTOP 마리나 — 블랜드픽 작업지시서 (제${data.issueNo}차)`]);
      title.font = { bold: true, size: 13 };
      ws.addRow([
        data.baseline
          ? `기준: ${kst(data.baseline)} ~ ${kst(data.now)} 사이 변경분만 포함`
          : `기준: 전체 (첫 발행) ~ ${kst(data.now)}`,
      ]);
      const warn = ws.addRow(["※ 아래 목록에 없는 예약은 변동 없음 — 수정하지 마세요. 문의: 블랜드픽"]);
      warn.font = { bold: true, color: { argb: "FF9C0006" } };
      ws.addRow([]);

      const header = ws.addRow(HEAD);
      header.font = { bold: true };
      header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDE8" } }; });

      const addRow = (vals: (string | number | null)[], color: string) => {
        const row = ws.addRow(vals);
        row.getCell(4).numFmt = "@";
        row.eachCell({ includeEmpty: false }, (c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        });
      };
      const base = (r: Row) => [r.order_number, r.buyer_name, r.buyer_phone, r.room, r.pkg, r.check_in, r.check_out, r.nights];

      for (const r of d.added)
        addRow(["신규 등록", ...base(r), `새로 등록해주세요${r.request ? ` · 요청: ${r.request}` : ""}`], COLORS.added);
      for (const { old, next } of d.replaced)
        addRow(
          ["대체(재예약)", ...base(next),
            `기존 ${old.order_number} (${md(old.check_in)}~${md(old.check_out)}) 취소하고 이 예약으로 대체 — 동일 투숙객, 취소로 처리하지 마세요`],
          COLORS.replaced
        );
      for (const r of d.changed)
        addRow(["날짜 변경", ...base(r),
          r.change_label
            ? `예약번호 유지 — 투숙일 변경: ${r.change_label}`
            : "예약번호 유지 — 투숙일을 왼쪽 날짜로 수정해주세요"], COLORS.changed);
      for (const r of d.cancelled)
        addRow(["취소", ...base(r), `객실 해제해주세요${r.cancelled_kst ? ` (취소 ${r.cancelled_kst})` : ""}`], COLORS.cancelled);

      ws.addRow([]);
      const sum = ws.addRow([
        `합계: 신규 ${d.added.length} · 대체 ${d.replaced.length} · 날짜변경 ${d.changed.length} · 취소 ${d.cancelled.length}`,
      ]);
      sum.font = { bold: true };
      [13, 24, 10, 14, 12, 18, 11, 11, 6, 56].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      // 참고용 전체 현황 — 호텔이 대조할 수 있게 (유효 예약만, 지시 대상 아님)
      const ws2 = wb.addWorksheet("전체 현황(참고용)");
      const h2 = ws2.addRow(["예약번호", "예약자", "연락처", "객실", "패키지", "체크인", "체크아웃", "박수"]);
      h2.font = { bold: true };
      for (const r of d.roster) {
        const row = ws2.addRow([r.order_number, r.buyer_name, r.buyer_phone, r.room, r.pkg, r.check_in, r.check_out, r.nights]);
        row.getCell(3).numFmt = "@";
      }
      [24, 10, 14, 12, 18, 11, 11, 6].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = `호텔작업지시서_제${data.issueNo}차_${today}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      // 발행 기록 — 다음 회차의 기준 시각이 됨
      const res = await fetch("/api/admin/hotel-worksheet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseline: data.baseline,
          new_count: d.added.length, replaced_count: d.replaced.length,
          changed_count: d.changed.length, cancelled_count: d.cancelled.length,
          // 지시서에 담긴 주문들 — 서버가 호텔 전달 도장(hotel_sent_at)을 찍는다
          order_numbers: [
            ...d.added.map((r) => r.order_number),
            ...d.changed.map((r) => r.order_number),
            ...d.cancelled.map((r) => r.order_number),
            ...d.replaced.flatMap((p) => [p.old.order_number, p.next.order_number]),
          ],
        }),
      });
      const resp = await res.json().catch(() => ({}));
      if (res.ok && resp.ok) { setIssued(resp.issueNo); setStamped(Number(resp.stamped) || 0); }
      if (!res.ok || !resp.ok) setError("엑셀은 받았지만 발행 기록에 실패했어요 — 다시 시도해주세요.");
    } catch {
      setError("지시서 생성 중 오류가 발생했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white p-6 mt-8" style={{ border: "1px solid #E2E2DC" }}>
      <h2 className="text-base font-bold mb-1" style={{ color: "#1A1D18" }}>호텔 작업지시서 발행</h2>
      <p className="text-xs mb-4" style={{ color: "#8F948A" }}>
        지난 발행 이후 달라진 예약만 신규 · 대체 · 날짜변경 · 취소로 나눠 지시문 엑셀을 만들어요.
        재결제 건은 취소로 보이지 않게 한 줄로 병합돼요.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs" style={{ color: "#5C6156" }}>
          기준 시각 (이 시각 이후 변경분)
          <input type="datetime-local" value={sinceInput}
            onChange={(e) => setSinceInput(e.target.value)}
            className="block mt-1 px-2 py-1.5 text-sm" style={{ border: "1px solid #D6D6CF" }} />
        </label>
        <label className="text-xs" style={{ color: "#5C6156" }}>
          인플루언서
          <select value={infSel} onChange={(e) => setInfSel(e.target.value)}
            className="block mt-1 px-2 py-1.5 text-sm" style={{ border: "1px solid #D6D6CF" }}>
            <option value="">전체</option>
            {influencerOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={() => load(localToIso(sinceInput))} disabled={busy}
          className="px-4 py-2 text-sm font-semibold"
          style={{ border: "1px solid #D6D6CF", color: "#3D4238", background: "#fff" }}>
          {busy ? "계산 중…" : "변경분 다시 계산"}
        </button>
      </div>

      {data && view && (
        <div className="text-sm mb-4 space-y-1" style={{ color: "#3D4238" }}>
          <p>
            제{data.issueNo}차 · 기준 {data.baseline ? kst(data.baseline) : "전체(첫 발행)"} →{" "}
            <b>신규 {view.added.length}</b> · <b style={{ color: "#B8860B" }}>대체 {view.replaced.length}</b> ·{" "}
            <b style={{ color: "#8B8000" }}>날짜변경 {view.changed.length}</b> ·{" "}
            <b style={{ color: "#A6412F" }}>취소 {view.cancelled.length}</b>
            {" "}(현재 유효 예약 {view.roster.length}건{infSel ? ` · ${infSel}만` : ""})
          </p>
          {total === 0 && <p style={{ color: "#8F948A" }}>변경분이 없어요 — 발행할 필요 없음.</p>}
        </div>
      )}

      <button onClick={download} disabled={busy || !data || total === 0}
        className="px-5 py-2.5 text-sm font-bold text-white"
        style={{ background: busy || !data || total === 0 ? "#B9BDB3" : "#244B1F" }}>
        {busy ? "생성 중…" : "지시서 엑셀 다운로드 (발행 기록)"}
      </button>
      {issued && (
        <p className="text-xs mt-3 font-semibold" style={{ color: "#2D5A27" }}>
          ✓ 제{issued}차 발행 완료 — 예약 {stamped}건에 호텔 전달 도장이 찍혔어요. 다음 발행은 이 시각 이후 변경분만 잡혀요.
        </p>
      )}
      {error && <p className="text-xs mt-3" style={{ color: "#A6412F" }}>{error}</p>}
    </div>
  );
}
