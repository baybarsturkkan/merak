import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface Column {
  label: string;
  value: number;
  tooltip: string;
  /** Üstüne değer yazılsın mı (seçici etiketleme) */
  showValue?: boolean;
  dim?: boolean;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Barın uç kısmı 4px yuvarlak, taban düz */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Tek serili sütun grafiği: üzerine gelince ipucu, istenirse tablo görünümü */
export function ColumnChart({
  data,
  height = 150,
  max,
  format = (v) => String(v),
  label,
  tableHead = ['', 'Değer'],
}: {
  data: Column[];
  height?: number;
  max?: number;
  format?: (v: number) => string;
  label: string;
  tableHead?: [string, string];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const top = max ?? niceMax(Math.max(...data.map((d) => d.value), 0));
  const padL = 30;
  const padB = 22;
  const padT = 16;
  const plotW = Math.max(0, width - padL);
  const plotH = height - padB - padT;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, Math.max(4, band * 0.62));
  // Etiketler çakışmasın: en uzun etiketin yaklaşık genişliğine göre her k'ıncıyı yaz
  const labelW = Math.max(...data.map((d) => d.label.length), 1) * 6.2 + 8;
  const every = Math.max(1, Math.ceil(labelW / Math.max(band, 1)));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];

  return (
    <div className="chart" ref={ref}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <span className="sr-only">{label}</span>
        <span />
        <button type="button" className="link-btn small" onClick={() => setTable((t) => !t)}>
          {table ? 'Grafik' : 'Tablo'}
        </button>
      </div>
      {table ? (
        <table className="chart-table">
          <thead>
            <tr>
              <th>{tableHead[0]}</th>
              <th className="num">{tableHead[1]}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.label}</td>
                <td className="num">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth={1} />
                <text className="tick" x={padL - 6} y={y(t) + 4} textAnchor="end">
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + band * i + band / 2;
              const h = (Math.min(d.value, top) / top) * plotH;
              return (
                <g key={i}>
                  <rect
                    className="hit"
                    x={padL + band * i}
                    y={padT}
                    width={band}
                    height={plotH + padB}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover((h) => (h === i ? null : i))}
                  />
                  <path
                    className={`bar${d.dim ? ' dim' : ''}${hover === i ? ' active' : ''}`}
                    d={barPath(cx - barW / 2, y(0) - h, barW, h)}
                    pointerEvents="none"
                  />
                  {d.showValue && d.value > 0 && (
                    <text className="val" x={cx} y={y(0) - h - 5} textAnchor="middle" pointerEvents="none">
                      {format(d.value)}
                    </text>
                  )}
                  {(data.length - 1 - i) % every === 0 && (
                    <text className="tick" x={cx} y={height - 6} textAnchor="middle" pointerEvents="none">
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )
      )}
      {!table && hover !== null && data[hover] && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(padL + band * hover + band / 2, 70), width - 70),
            top: y(Math.min(data[hover].value, top)),
          }}
        >
          {data[hover].tooltip}
        </div>
      )}
    </div>
  );
}

export interface HBarRow {
  key: string;
  label: ReactNode;
  /** 0–1 arası; null = veri yok */
  value: number | null;
  valueText: string;
  title?: string;
}

/** Yatay çubuklar; isteğe bağlı hedef çizgisi (ör. %90) */
export function HBars({
  rows,
  target,
  emptyText = 'veri yok',
  tone,
}: {
  rows: HBarRow[];
  target?: number;
  emptyText?: string;
  /** spark: merak verisi kehribar renkte */
  tone?: 'spark';
}) {
  return (
    <div className={`hbars${tone ? ` hbars-${tone}` : ''}`}>
      {rows.map((r) => (
        <div className="hbar" key={r.key} title={r.title}>
          <span>{r.label}</span>
          <div className="track">
            <span className="base" />
            {r.value !== null ? (
              <span className="fill" style={{ width: `${Math.max(1, r.value * 100)}%` }} />
            ) : (
              <span className="none">{emptyText}</span>
            )}
            {target !== undefined && <span className="target" style={{ left: `${target * 100}%` }} />}
          </div>
          <span className="num">{r.valueText}</span>
        </div>
      ))}
    </div>
  );
}
