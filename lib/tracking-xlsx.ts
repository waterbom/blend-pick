import { trackingRows } from '@/lib/shipping-flow';

export async function parseTrackingXlsx(buf: ArrayBuffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array', cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw Error('엑셀 시트가 없습니다.');
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', range: 0 });
  return trackingRows(grid.map((row, r) => row.map((value, c) => {
    if (typeof value !== 'number') return String(value ?? '').trim();
    // Excel stores at most 15 significant decimal digits. Already rounded IDs cannot be restored.
    if (!Number.isSafeInteger(value) || value < 0 || String(value).length > 15) {
      throw Error(`${r + 1}행: 숫자 셀의 정밀도를 보장할 수 없습니다. 원본 번호를 텍스트 형식으로 입력해주세요.`);
    }
    const format = ws[XLSX.utils.encode_cell({ r, c })]?.z;
    return typeof format === 'string' && /^0+$/.test(format)
      ? String(value).padStart(format.length, '0') : String(value);
  })));
}
