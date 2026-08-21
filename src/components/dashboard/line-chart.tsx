type LineChartProps = {
  data: { label: string; value: number }[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  formatValue?: (value: number) => string;
  formatTooltip?: (value: number) => string;
};

export function LineChart({
  data,
  height = 280,
  lineColor = "stroke-blue-600",
  fillColor = "fill-blue-500/10",
  formatValue,
  formatTooltip
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const max = Math.max(1, ...data.map((item) => item.value));
  const padLeft = 52;
  const padRight = 28;
  const padTop = 36;
  const padBottom = 40;
  const innerHeight = height - padTop - padBottom;
  const totalWidth = 720;
  const innerWidth = totalWidth - padLeft - padRight;
  const labelInterval = data.length > 18 ? 4 : data.length > 12 ? 3 : data.length > 8 ? 2 : 1;
  const lastIndex = data.length - 1;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? padLeft + innerWidth / 2
        : padLeft + (index / (data.length - 1)) * innerWidth;
    const y = padTop + innerHeight - (item.value / max) * innerHeight;
    return { ...item, x, y, index };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = [
    `M ${points[0].x} ${padTop + innerHeight}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1].x} ${padTop + innerHeight}`,
    "Z"
  ].join(" ");

  return (
    <div className="flex h-full w-full flex-1 flex-col justify-center">
      <svg
        className="h-full min-h-[18rem] w-full"
        viewBox={`0 0 ${totalWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="파트너 누적 증가 추이"
      >
        <line
          x1={padLeft}
          x2={totalWidth - padRight}
          y1={padTop + innerHeight}
          y2={padTop + innerHeight}
          className="stroke-slate-200"
          strokeWidth={1}
        />
        <path d={areaPath} className={fillColor} />
        <path
          d={linePath}
          fill="none"
          className={lineColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => {
          const isLast = point.index === lastIndex;
          const showXLabel =
            point.index % labelInterval === 0 || point.index === lastIndex;
          const showValue = isLast || point.index % labelInterval === 0;

          return (
            <g key={point.index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 5.5 : 4}
                className={
                  isLast
                    ? "fill-blue-600 stroke-white"
                    : "fill-white stroke-blue-600"
                }
                strokeWidth={isLast ? 2.5 : 2}
              >
                <title>{formatTooltip?.(point.value) ?? formatValue?.(point.value) ?? String(point.value)}</title>
              </circle>
              {showValue ? (
                <text
                  x={point.x}
                  y={point.y - (isLast ? 16 : 12)}
                  textAnchor="middle"
                  className={
                    isLast
                      ? "fill-blue-800 text-[11px] font-semibold"
                      : "fill-slate-700 text-[10px] font-semibold"
                  }
                >
                  {formatValue ? formatValue(point.value) : point.value}
                </text>
              ) : null}
              {showXLabel ? (
                <text
                  x={point.x}
                  y={height - 12}
                  textAnchor="middle"
                  className={
                    isLast
                      ? "fill-blue-700 text-[10px] font-semibold"
                      : "fill-slate-500 text-[9px]"
                  }
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
