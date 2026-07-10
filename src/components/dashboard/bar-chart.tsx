type HorizontalBarChartItem = {
  label: string;
  value: number;
  color?: string;
  muted?: boolean;
};

export function HorizontalBarChart({ data }: { data: HorizontalBarChartItem[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="tabular-nums text-slate-500">{item.value}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                style={{ width: `${pct}%` }}
                className={["h-full rounded-full", item.color ?? "bg-blue-500"].join(" ")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 임원 대시보드 TOP N — 억 단위 금액, 말줄임 파트너명 */
export function ExecutiveRankBarChart({
  data,
  formatValue
}: {
  data: HorizontalBarChartItem[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-slate-800">
                {formatValue(item.value)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                style={{ width: `${pct}%` }}
                className={["h-full rounded-full", item.color ?? "bg-blue-500"].join(" ")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const GRADE_FILL: Record<string, string> = {
  "bg-violet-500": "#8b5cf6",
  "bg-teal-500": "#14b8a6",
  "bg-amber-500": "#f59e0b",
  "bg-slate-400": "#94a3b8",
  "bg-blue-500": "#3b82f6",
  "bg-slate-300": "#cbd5e1"
};

export function GradeDistributionChart({ data }: { data: HorizontalBarChartItem[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 58;
  const strokeWidth = 22;

  let cumulative = -Math.PI / 2;
  const segments = data.map((item) => {
    const fraction = item.value / total;
    const startAngle = cumulative;
    const endAngle = cumulative + fraction * Math.PI * 2;
    cumulative = endAngle;
    const colorClass = item.color ?? "bg-blue-500";
    return {
      item,
      startAngle,
      endAngle,
      stroke: GRADE_FILL[colorClass] ?? "#3b82f6",
      fraction
    };
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-1 lg:flex-row lg:items-center lg:gap-6">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="등급별 파트너 분포">
          {segments.map((segment) =>
            segment.item.value > 0 ? (
              <path
                key={segment.item.label}
                d={describeArc(cx, cy, radius, segment.startAngle, segment.endAngle)}
                fill="none"
                stroke={segment.stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            ) : null
          )}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="fill-slate-950 text-2xl font-bold"
          >
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500 text-[11px]">
            전체 파트너
          </text>
        </svg>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-3">
        {data.map((item) => {
          const pct = ((item.value / total) * 100).toFixed(1);
          const isMuted = item.muted === true;
          return (
            <div
              key={item.label}
              className={[
                "rounded-xl px-3 py-2.5",
                isMuted ? "bg-slate-50/80" : "bg-slate-50"
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "h-3 w-3 shrink-0 rounded-full",
                      item.color ?? "bg-blue-500",
                      isMuted ? "opacity-50" : ""
                    ].join(" ")}
                  />
                  <span
                    className={[
                      "text-sm font-semibold",
                      isMuted ? "text-slate-500" : "text-slate-800"
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span
                    className={[
                      "text-sm font-bold",
                      isMuted ? "text-slate-500" : "text-slate-950"
                    ].join(" ")}
                  >
                    {item.value}개
                  </span>
                  <span
                    className={[
                      "ml-2 text-xs font-medium",
                      isMuted ? "text-slate-400" : "text-slate-500"
                    ].join(" ")}
                  >
                    / {pct}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                <div
                  style={{ width: `${pct}%` }}
                  className={[
                    "h-full rounded-full",
                    item.color ?? "bg-blue-500",
                    isMuted ? "opacity-40" : ""
                  ].join(" ")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type VerticalBarChartProps = {
  data: { label: string; value: number }[];
  height?: number;
  barColor?: string;
};

export function VerticalBarChart({
  data,
  height = 280,
  barColor = "fill-blue-500"
}: VerticalBarChartProps) {
  const maxData = Math.max(0, ...data.map((d) => d.value));
  const max = maxData === 0 ? 1 : Math.ceil(maxData * 1.12);
  const barWidth = 22;
  const gap = 10;
  const padLeft = 32;
  const padRight = 16;
  const padTop = 28;
  const padBottom = 36;
  const innerHeight = height - padTop - padBottom;
  const totalWidth = padLeft + padRight + data.length * (barWidth + gap);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        데이터 없음
      </div>
    );
  }

  const labelInterval = data.length > 18 ? 4 : data.length > 12 ? 3 : data.length > 8 ? 2 : 1;

  return (
    <div className="flex h-full w-full flex-1 flex-col justify-end">
      <svg
        className="w-full"
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="월별 신규 파트너 계약"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padTop + innerHeight - tick * innerHeight;
          const tickValue = Math.round(max * tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={totalWidth - padRight}
                y1={y}
                y2={y}
                className="stroke-slate-100"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "4 4"}
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[9px] tabular-nums"
              >
                {tickValue}
              </text>
            </g>
          );
        })}
        <line
          x1={padLeft}
          x2={totalWidth - padRight}
          y1={height - padBottom}
          y2={height - padBottom}
          className="stroke-slate-200"
          strokeWidth={1}
        />
        {data.map((item, idx) => {
          const x = padLeft + idx * (barWidth + gap);
          const isZero = item.value === 0;
          const h = isZero ? 3 : Math.max(4, (item.value / max) * innerHeight);
          const y = height - padBottom - h;
          const showLabel = idx % labelInterval === 0 || idx === data.length - 1;
          const showValue = item.value > 0;

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={3}
                className={isZero ? "fill-slate-200/80" : barColor}
              />
              {showValue ? (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-slate-800 text-[10px] font-bold"
                >
                  {item.value}
                </text>
              ) : null}
              {showLabel ? (
                <text
                  x={x + barWidth / 2}
                  y={height - padBottom + 16}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px]"
                >
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
