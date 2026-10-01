import { ReactNode, useState } from "react";

// Charts draw server-computed VND series (decision 2026-10-01, visual finance report). Amounts arrive as
// BigInt strings; numbers are only used to size marks, every label shows the server value.
const vnd = (value: bigint) => new Intl.NumberFormat("vi-VN").format(value);
const short = (value: bigint) => {
  const abs = value < 0n ? -value : value;
  if (abs >= 1_000_000n) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Number(value) / 1_000_000)} tr`;
  return vnd(value);
};
// Clean axis maximum: 1, 2, 2.5 or 5 times a power of ten.
const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= value) ?? 10) * power;
};
const axisLabel = (value: number, max: number) => max >= 1_000_000 ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000) : new Intl.NumberFormat("vi-VN").format(value);
const columnPath = (x: number, y: number, w: number, h: number) => { const r = Math.min(4, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
const barPath = (x: number, y: number, w: number, h: number, round: boolean) => { if (!round || w <= 0) return `M${x},${y}H${x + Math.max(w, 0)}V${y + h}H${x}Z`; const r = Math.min(4, w, h / 2); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
export const seriesColors = ["#2a78d6", "#eb6834"];

type Tip = { x: number; y: number; title: string; value: string };
function useTip() {
  const [tip, setTip] = useState<Tip>();
  const bind = (title: string, value: string) => ({
    tabIndex: 0, role: "img", "aria-label": `${title}: ${value}`, className: "finance-chart-mark",
    onPointerMove: (event: { clientX: number; clientY: number }) => setTip({ x: event.clientX, y: event.clientY, title, value }),
    onPointerLeave: () => setTip(undefined),
    onFocus: (event: { currentTarget: Element }) => { const box = event.currentTarget.getBoundingClientRect(); setTip({ x: box.left + box.width / 2, y: box.top, title, value }); },
    onBlur: () => setTip(undefined),
  });
  const view = tip ? <div className="finance-chart-tip" role="status" style={{ left: tip.x + 14, top: tip.y + 14 }}><b>{tip.value}</b><span>{tip.title}</span></div> : null;
  return { bind, view };
}

export function ChartCard({ title, description, wide, children }: { title: string; description: string; wide?: boolean; children: ReactNode }) {
  return <section className={`finance-chart-card${wide ? " finance-chart-wide" : ""}`} aria-label={title}><h3>{title}</h3><p>{description}</p>{children}</section>;
}

function Legend({ items }: { items: Array<[string, string]> }) {
  return <ul className="finance-chart-legend">{items.map(([label, color]) => <li key={label}><i style={{ background: color }} />{label}</li>)}</ul>;
}

function TableView({ head, rows }: { head: string[]; rows: string[][] }) {
  return <details className="finance-chart-table"><summary>Xem dạng bảng</summary><table><thead><tr>{head.map((item, index) => <th key={index}>{item}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></details>;
}

// A chart's viewBox follows its card width so text keeps the same size in a half and a full-width card.
export function ColumnChart({ series, rows, labelLast = true, wide = false }: { series: string[]; rows: Array<{ label: string; values: bigint[] }>; labelLast?: boolean; wide?: boolean }) {
  const { bind, view } = useTip();
  const W = wide ? 1160 : 560, H = 250, left = 52, right = 12, top = 26, bottom = 30, plotH = H - top - bottom;
  const max = niceMax(Math.max(0, ...rows.flatMap((row) => row.values.map(Number))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * max);
  const band = (W - left - right) / Math.max(rows.length, 1), bar = 22, gap = 2;
  return <>
    {series.length > 1 && <Legend items={series.map((item, index) => [item, seriesColors[index]!])} />}
    <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="group">
      <text x={0} y={12}>{max >= 1_000_000 ? "triệu đ" : "đ"}</text>
      {ticks.map((tick) => { const y = top + plotH - (tick / max) * plotH; return <g key={tick}><line x1={left} x2={W - right} y1={y} y2={y} className={tick === 0 ? "finance-chart-axis" : "finance-chart-grid"} /><text x={left - 8} y={y + 4} textAnchor="end">{axisLabel(tick, max)}</text></g>; })}
      {rows.map((row, index) => {
        const width = series.length * bar + (series.length - 1) * gap, x0 = left + band * index + (band - width) / 2;
        return <g key={row.label}>{row.values.map((value, seriesIndex) => { const h = (Math.max(Number(value), 0) / max) * plotH, x = x0 + seriesIndex * (bar + gap), y = top + plotH - h; return <g key={seriesIndex}><path d={columnPath(x, y, bar, h)} fill={seriesColors[seriesIndex]} {...bind(`${series[seriesIndex]} · ${row.label}`, `${vnd(value)} đ`)} />{labelLast && index === rows.length - 1 && <text className="finance-chart-value" x={x + bar / 2} y={y - 6} textAnchor="middle">{short(value)}</text>}</g>; })}<text className="finance-chart-category" x={left + band * index + band / 2} y={H - 8} textAnchor="middle">{row.label}</text></g>;
      })}
    </svg>
    {view}
    <TableView head={["", ...series]} rows={rows.map((row) => [row.label, ...row.values.map((value) => `${vnd(value)} đ`)])} />
  </>;
}

export function StackedBars({ series, rows, wide = true }: { series: [string, string]; rows: Array<{ label: string; values: [bigint, bigint]; end: string }>; wide?: boolean }) {
  const { bind, view } = useTip();
  const W = wide ? 1160 : 560, rowH = 34, bar = 22, left = 120, right = 70, H = rows.length * rowH + 28, plotW = W - left - right;
  const max = niceMax(Math.max(0, ...rows.map((row) => Number(row.values[0]) + Number(row.values[1]))));
  return <>
    <Legend items={series.map((item, index) => [item, seriesColors[index]!])} />
    <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="group">
      {[0, 0.25, 0.5, 0.75, 1].map((step) => { const x = left + step * plotW; return <g key={step}><line x1={x} x2={x} y1={0} y2={H - 22} className={step === 0 ? "finance-chart-axis" : "finance-chart-grid"} /><text x={x} y={H - 6} textAnchor={step === 1 ? "end" : "middle"}>{axisLabel(step * max, max)}{step === 1 ? (max >= 1_000_000 ? " triệu đ" : " đ") : ""}</text></g>; })}
      {rows.map((row, index) => {
        const y = index * rowH + (rowH - bar) / 2; let x = left;
        return <g key={row.label}><text className="finance-chart-category" x={left - 10} y={y + 15} textAnchor="end">{row.label}</text>{row.values.map((value, seriesIndex) => { const w = Math.max((Number(value) / max) * plotW - (seriesIndex === 0 && row.values[1] > 0n ? 2 : 0), 0); const mark = <path key={seriesIndex} d={barPath(x, y, w, bar, seriesIndex === 1 || row.values[1] === 0n)} fill={seriesColors[seriesIndex]} {...bind(`${series[seriesIndex]} · ${row.label}`, `${vnd(value)} đ`)} />; x += w + 2; return mark; })}<text className="finance-chart-value" x={x + 6} y={y + 15}>{row.end}</text></g>;
      })}
    </svg>
    {view}
    <TableView head={["", ...series, ""]} rows={rows.map((row) => [row.label, `${vnd(row.values[0])} đ`, `${vnd(row.values[1])} đ`, row.end])} />
  </>;
}

// From one total to another through signed adjustments, drawn around a zero line.
export function Bridge({ start, end, rows }: { start: [string, bigint]; end: [string, bigint]; rows: Array<{ label: string; amount: bigint; note?: string }> }) {
  const { bind, view } = useTip();
  const visible = rows.filter((row) => row.amount !== 0n);
  const W = 560, rowH = 40, bar = 20, mid = 290, half = 150, H = visible.length * rowH + 8;
  const max = Math.max(1, ...visible.map((row) => Math.abs(Number(row.amount))));
  const kinds: Array<[string, string]> = [...(visible.some((row) => row.amount < 0n) ? [["Làm giảm", "#e34948"] as [string, string]] : []), ...(visible.some((row) => row.amount > 0n) ? [["Làm tăng", seriesColors[0]!] as [string, string]] : [])];
  return <>
    {kinds.length > 0 && <Legend items={kinds} />}
    <p className="finance-bridge-end"><span>{start[0]}</span><span>{vnd(start[1])} đ</span></p>
    {visible.length > 0 && <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="group"><line x1={mid} x2={mid} y1={0} y2={H} className="finance-chart-axis" />{visible.map((row, index) => {
      const y = 8 + index * rowH, w = (Math.abs(Number(row.amount)) / max) * half, negative = row.amount < 0n, x = negative ? mid - w : mid;
      return <g key={row.label}><text className="finance-chart-category" x={0} y={y + 14}>{row.label}</text>{row.note && <text x={0} y={y + 29}>{row.note}</text>}<path d={negative ? `M${x + w},${y}H${x + Math.min(4, w)}Q${x},${y} ${x},${y + 4}V${y + bar - 4}Q${x},${y + bar} ${x + Math.min(4, w)},${y + bar}H${x + w}Z` : barPath(x, y, w, bar, true)} fill={negative ? "#e34948" : seriesColors[0]} {...bind(row.label, `${row.amount > 0n ? "+" : ""}${vnd(row.amount)} đ`)} /><text className="finance-chart-value" x={W} y={y + 15} textAnchor="end">{row.amount > 0n ? "+" : ""}{vnd(row.amount)} đ</text></g>;
    })}</svg>}
    {view}
    <p className="finance-bridge-end finance-bridge-total"><span>{end[0]}</span><span>{vnd(end[1])} đ</span></p>
  </>;
}

// Status is never color alone: every segment has an icon and a labelled count in the legend.
export function StatusBar({ rows }: { rows: Array<{ label: string; count: number; color: string; icon: string }> }) {
  const { bind, view } = useTip();
  const visible = rows.filter((row) => row.count > 0), total = visible.reduce((sum, row) => sum + row.count, 0);
  const W = 560, H = 36; let x = 0;
  return <>
    {total > 0 && <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="group">{visible.map((row, index) => { const w = (row.count / total) * W - (index < visible.length - 1 ? 2 : 0); const mark = <path key={row.label} d={barPath(x, 0, Math.max(w, 1), H, index === visible.length - 1)} fill={row.color} {...bind(row.label, `${row.count} hóa đơn`)} />; x += w + 2; return mark; })}</svg>}
    {view}
    <ul className="finance-chart-legend">{rows.map((row) => <li key={row.label}><i style={{ background: row.color }} /><span aria-hidden="true">{row.icon}</span> {row.label} <b>{row.count}</b></li>)}</ul>
  </>;
}

// One series on an ordinal ramp: darker is older debt.
export function AgingBars({ rows }: { rows: Array<{ label: string; amount: bigint; color: string }> }) {
  const { bind, view } = useTip();
  const W = 1160, rowH = 36, bar = 22, left = 170, right = 150, H = rows.length * rowH + 28, plotW = W - left - right;
  const max = niceMax(Math.max(0, ...rows.map((row) => Number(row.amount))));
  return <>
    <svg className="finance-chart" viewBox={`0 0 ${W} ${H}`} role="group">
      {[0, 0.5, 1].map((step) => { const x = left + step * plotW; return <g key={step}><line x1={x} x2={x} y1={0} y2={H - 22} className={step === 0 ? "finance-chart-axis" : "finance-chart-grid"} /><text x={x} y={H - 6} textAnchor={step === 1 ? "end" : "middle"}>{axisLabel(step * max, max)}{step === 1 ? (max >= 1_000_000 ? " triệu đ" : " đ") : ""}</text></g>; })}
      {rows.map((row, index) => { const y = index * rowH + (rowH - bar) / 2, w = (Number(row.amount) / max) * plotW; return <g key={row.label}><text className="finance-chart-category" x={left - 10} y={y + 15} textAnchor="end">{row.label}</text><path d={barPath(left, y, w, bar, true)} fill={row.color} {...bind(row.label, `${vnd(row.amount)} đ`)} /><text className="finance-chart-value" x={left + w + 8} y={y + 15}>{vnd(row.amount)} đ</text></g>; })}
    </svg>
    {view}
  </>;
}
