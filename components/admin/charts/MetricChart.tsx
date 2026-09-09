'use client';
import { useId, useState } from 'react';
export type ChartPoint = { label: string; values: (number | null)[] };
export type ChartSeries = { label: string; color: string };
export type ChartUnit = 'count' | 'won' | 'bytes' | 'ms' | 'percent';
export function formatMetric(value: number, unit: ChartUnit, compact = false): string {
  if (unit === 'bytes') {
    const size = Math.abs(value);
    const [factor, suffix] = size >= 1073741824 ? [1073741824, 'GiB'] : size >= 1048576 ? [1048576, 'MiB'] : size >= 1024 ? [1024, 'KiB'] : [1, 'B'];
    return (value / Number(factor)).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + ' ' + suffix;
  }
  const n = value.toLocaleString('ko-KR', compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 2 });
  return n + ({ count: '건', won: '원', ms: 'ms', percent: '%', bytes: '' }[unit]);
}
export default function MetricChart({ title, description, points, series, unit = 'count', kind = 'line' }: {
  title: string; description?: string; points: ChartPoint[]; series: ChartSeries[]; unit?: ChartUnit; kind?: 'line' | 'bar';
}) {
  const id = useId();
  const [hidden, setHidden] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const shown = series.map((s, i) => ({ ...s, i })).filter(s => !hidden.includes(s.i));
  const values = points.flatMap(p => shown.map(s => p.values[s.i])).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const min = Math.min(0, ...values), rawMax = Math.max(0, ...values), span = rawMax - min || 1;
  const low = min < 0 ? min - span * .08 : 0, high = rawMax + span * .1;
  const W = 720, H = 280, left = 75, right = 20, top = 18, bottom = 42, width = W - left - right, height = H - top - bottom;
  const y = (v: number) => top + (high - v) / (high - low) * height;
  const step = width / Math.max(points.length, 1), x = (i: number) => left + step * (i + .5);
  const focused = selected === null ? null : points[selected];
  const toggle = (i: number) => setHidden(h => h.includes(i) ? h.filter(n => n !== i) : [...h, i]);
  const pathFor = (index: number) => {
    let active = false;
    return points.map((p, i) => {
      const value = p.values[index];
      if (value === null || value === undefined || !Number.isFinite(value)) { active = false; return ''; }
      const command = active ? 'L' : 'M'; active = true;
      return `${command}${x(i)},${y(value)}`;
    }).join(' ');
  };
  return <section aria-labelledby={id} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
    <h3 id={id} className="text-sm font-semibold text-stone-800">{title}</h3>
    {description && <p className="mt-1 text-xs leading-5 text-stone-500">{description}</p>}
    <div className="mt-4 flex flex-wrap gap-2" aria-label={`${title} 표시 항목`}>
      {series.map((s, i) => <button key={s.label} type="button" aria-pressed={!hidden.includes(i)} onClick={() => toggle(i)} className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-xs" style={{ opacity: hidden.includes(i) ? .45 : 1 }}><span style={{ background: s.color, width: 8, height: 8, borderRadius: '50%' }}/>{s.label}</button>)}
    </div>
    {!values.length ? <p role="status" className="grid min-h-52 place-items-center text-sm text-stone-500">{shown.length ? '표시할 확정 데이터가 없습니다.' : '표시할 항목을 선택해주세요.'}</p> : <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="group" aria-label={`${title} 그래프. 지점을 선택하거나 아래 원본 수치를 확인하세요.`}>
        {[0, 1, 2, 3, 4].map(i => { const v = low + (high - low) * i / 4; return <g key={i}><line x1={left} x2={W - right} y1={y(v)} y2={y(v)} stroke="#e7e5e4" strokeDasharray="3 5"/><text x={left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#78716c">{formatMetric(v, unit, true)}</text></g>; })}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="#a8a29e"/>
        {shown.map((s, j) => <g key={s.i}>
          {kind === 'line' && <path d={pathFor(s.i)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/>}
          {points.map((p, i) => { const v = p.values[s.i]; if (v == null || !Number.isFinite(v)) return null;
            return kind === 'line' ? <circle key={i} cx={x(i)} cy={y(v)} r={points.length > 40 ? 1.5 : 3} fill={s.color}/> : <rect key={i} x={x(i) - step * .35 + j * step * .7 / shown.length} y={Math.min(y(0), y(v))} width={Math.max(.4, step * .7 / shown.length - 1)} height={Math.abs(y(v) - y(0))} fill={s.color} rx="1"/>;
          })}
        </g>)}
        {points.map((p, i) => <g key={i}>
          {(i % Math.max(1, Math.ceil(points.length / 6)) === 0 || i === points.length - 1) && <text x={x(i)} y={H - 17} fontSize="10" textAnchor="middle" fill="#78716c">{p.label.length > 15 ? p.label.slice(-14) : p.label}</text>}
          <rect x={x(i) - step / 2} y={top} width={step} height={height} fill={selected === i ? '#244b1f' : 'transparent'} fillOpacity=".06" tabIndex={0} role="button" aria-label={`${p.label}: ${shown.map(s => `${s.label} ${p.values[s.i] == null ? '미확정·기록 없음' : formatMetric(p.values[s.i]!, unit)}`).join(', ')}`} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} onClick={() => setSelected(i)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = e.key === 'ArrowRight' ? e.currentTarget.parentElement?.nextElementSibling : e.currentTarget.parentElement?.previousElementSibling; (next?.querySelector('[tabindex]') as SVGElement | null)?.focus(); } }}/>
        </g>)}
      </svg>
    </div>}
    <div aria-live="polite" className="mt-1 min-h-12 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-6 text-stone-600">{focused ? <><b>{focused.label}</b>{shown.map(s => <span key={s.i} className="ml-3 inline-block">{s.label} <strong style={{ color: s.color }}>{focused.values[s.i] == null ? '미확정·기록 없음' : formatMetric(focused.values[s.i]!, unit)}</strong></span>)}</> : '그래프에 마우스를 올리거나 지점을 누르면 정확한 수치를 볼 수 있습니다.'}</div>
    <details className="mt-3 text-xs text-stone-500"><summary className="cursor-pointer">원본 수치 보기</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-right whitespace-nowrap"><caption className="sr-only">{title} 원본 수치</caption><thead><tr><th className="p-2 text-left">구분</th>{series.map(s => <th className="p-2" key={s.label}>{s.label}</th>)}</tr></thead><tbody>{points.map((p, i) => <tr key={i} className="border-t border-stone-100"><th className="p-2 text-left font-normal">{p.label}</th>{series.map((s, n) => <td className="p-2" key={s.label}>{p.values[n] == null ? '—' : formatMetric(p.values[n]!, unit)}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}
