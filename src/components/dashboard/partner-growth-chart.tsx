"use client";

import { useMemo, useState } from "react";
import type { CumulativePartnerPoint } from "@/lib/data/dashboard";

type QuarterFilter = "all" | 1 | 2 | 3 | 4;

type PartnerGrowthChartProps = {
  data: CumulativePartnerPoint[];
  height?: number;
};

export function PartnerGrowthChart({ data, height = 280 }: PartnerGrowthChartProps) {
  const [quarter, setQuarter] = useState<QuarterFilter>("all");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (quarter === "all") return data;
    return data.filter((point) => point.quarter === quarter);
  }, [data, quarter]);

  if (filtered.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  const max = Math.max(1, ...filtered.map((item) => item.cumulative));
  const pointGap = 44;
  const padLeft = 40;
  const padRight = 28;
  const padTop = 32;
  const padBottom = 40;
  const innerHeight = height - padTop - padBottom;
  const totalWidth = padLeft + padRight + Math.max(1, filtered.length - 1) * pointGap;

  const points = filtered.map((item, index) => {
    const x = padLeft + index * pointGap;
    const y = padTop + innerHeight - (item.cumulative / max) * innerHeight;
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

  const activePoint = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            [1, "1분기"],
            [2, "2분기"],
            [3, "3분기"],
            [4, "4분기"]
          ] as const
        ).map(([key, label]) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setQuarter(key)}
            className={
              quarter === key
                ? "rounded-lg bg-okestro-600 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center">
        {activePoint ? (
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs shadow-md">
            <p className="font-semibold text-slate-900">{activePoint.fullLabel}</p>
            <p className="mt-0.5 text-slate-600">
              누적 <span className="font-semibold tabular-nums">{activePoint.cumulative}</span>개
            </p>
            <p className="text-slate-600">
              신규 <span className="font-semibold tabular-nums">{activePoint.monthlyNew}</span>개
            </p>
          </div>
        ) : null}

        <svg
          className="w-full"
          height={height}
          viewBox={`0 0 ${totalWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="파트너 누적 증가 추이"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <line
            x1={padLeft}
            x2={totalWidth - padRight}
            y1={padTop + innerHeight}
            y2={padTop + innerHeight}
            className="stroke-slate-200"
            strokeWidth={1}
          />
          <path d={areaPath} className="fill-blue-500/10" />
          <path
            d={linePath}
            fill="none"
            className="stroke-blue-600"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point) => {
            const isActive = hoverIndex === point.index;
            const isQuarterStart = point.month % 3 === 1;
            const showXLabel = quarter !== "all" || isQuarterStart || point.index === points.length - 1;

            return (
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={14}
                  className="fill-transparent"
                  onMouseEnter={() => setHoverIndex(point.index)}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 6 : 3.5}
                  className={
                    isActive ? "fill-blue-600 stroke-white" : "fill-white stroke-blue-600"
                  }
                  strokeWidth={isActive ? 2.5 : 2}
                  pointerEvents="none"
                />
                {showXLabel ? (
                  <text
                    x={point.x}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-slate-500 text-[9px]"
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
