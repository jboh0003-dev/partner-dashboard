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
  height = 320,
  lineColor = "stroke-blue-600",
  fillColor = "fill-blue-500/10",
  formatValue,
  formatTooltip
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const max = Math.max(1, ...data.map((item) => item.value));
  const padLeft = 44;
  const padRight = 12;
  const padTop = 22;
  const padBottom = 28;
  const innerHeight = height - padTop - padBottom;
  const totalWidth = 720;
  const innerWidth = totalWidth - padLeft - padRight;
  const labelInterval = data.length > 18 ? 4 : data.length > 12 ? 3 : data.length > 8 ? 2 : 1;
  const lastIndex = data.length - 1;
  const yTicks = [0, 0.5, 1];

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
    <div className="flex h-full w-full flex-1 flex-col">
      <svg
        className="h-full min-h-[22rem] w-full"
        viewBox={`0 0 ${totalWidth} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="파이프라인 추이"
      >
        {yTicks.map((ratio) => {
          const y = padTop + innerHeight * (1 - ratio);
          const tickValue = max * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                x2={totalWidth - padRight}
                y1={y}
                y2={y}
                className="stroke-slate-100"
                strokeWidth={1}
              />
              {ratio > 0 ? (
                <text
                  x={padLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-medium"
                >
                  {formatValue ? formatValue(tickValue) : tickValue}
                </text>
              ) : null}
            </g>
          );
        })}
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
          const showXLabel = point.index % labelInterval === 0 || point.index === lastIndex;
          const showValue = isLast || point.index % labelInterval === 0;

          return (
            <g key={point.index}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isLast ? 5 : 3.5}
                className={isLast ? "fill-blue-600 stroke-white" : "fill-white stroke-blue-600"}
                strokeWidth={isLast ? 2 : 1.5}
              >
                <title>
                  {formatTooltip?.(point.value) ?? formatValue?.(point.value) ?? String(point.value)}
                </title>
              </circle>
              {showValue ? (
                <text
                  x={point.x}
                  y={point.y - (isLast ? 12 : 10)}
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
                  y={height - 8}
                  textAnchor="middle"
                  className={
                    isLast ? "fill-blue-700 text-[10px] font-semibold" : "fill-slate-500 text-[9px]"
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
