interface TrendPoint {
  date: string;
  total: number;
}

/** رسم بياني بسيط (أعمدة) لاتجاه المبيعات اليومي - بدون مكتبة خارجية */
export function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const width = 700;
  const height = 200;
  const barGap = 8;
  const barWidth = data.length ? (width - barGap * (data.length - 1)) / data.length : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height + 30}`} className="w-full h-56">
      {data.map((d, i) => {
        const barHeight = (d.total / max) * height;
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        const label = new Date(d.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill="#FF6A00" opacity={0.85} />
            <text x={x + barWidth / 2} y={height + 15} textAnchor="middle" fontSize="10" fill="#6B7280">
              {label}
            </text>
            {d.total > 0 && (
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#374151">
                {d.total.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
