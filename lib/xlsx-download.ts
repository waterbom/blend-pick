"use client";

// 관리자 화면 공통 — 표 데이터를 .xlsx 파일로 다운로드
// CSV 대신 엑셀 파일을 직접 만들어 맥/윈도우 어디서 열어도 한글이 깨지지 않고,
// 숫자 셀은 숫자 그대로 들어가 바로 SUM 등 수식 계산이 가능하다.
// xlsx 라이브러리는 버튼을 눌렀을 때만 로드(dynamic import)해 페이지 용량에 영향 없음.

// 셀 표시 폭 추정 — 한글 등 전각 문자는 2칸으로 계산
function displayWidth(v: unknown): number {
  const s = String(v ?? "");
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return w;
}

export async function downloadXlsx(
  filename: string,
  header: string[],
  rows: (string | number)[][],
  sheetName = "명단"
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h, i) => {
    const maxW = Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i])));
    return { wch: Math.min(Math.max(maxW + 2, 8), 44) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // XLSX.writeFile 대신 직접 Blob으로 내려 파일명이 항상 지정한 이름으로 저장되게 한다
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
