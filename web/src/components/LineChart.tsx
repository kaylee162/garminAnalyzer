import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ChartSeries = {
  label: string;
  // A CSS color, e.g. "var(--color-metric-pace)".
  color: string;
  // One value per entry in `dates`; null where the run didn't record it.
  values: (number | null)[];
};

type LineChartProps = {
  // Read out by screen readers in place of the picture.
  label: string;
  dates: Date[];
  // The x axis always spans the whole picked range, so gaps between runs show up as gaps.
  start: Date;
  end: Date;
  series: ChartSeries[];
  formatValue: (value: number) => string;
  // Candidate gaps between y ticks, smallest first; the first one giving five or fewer ticks wins.
  tickSteps: number[];
  // Put low values at the top, e.g. pace, where a smaller number is faster.
  invert?: boolean;
  // The tooltip's heading for one point.
  describePoint: (index: number) => string;
};

const HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 60 };
const X_TICK_COUNT = 5;
const DAY_MS = 86_400_000;

export function LineChart({
  label,
  dates,
  start,
  end,
  series,
  formatValue,
  tickSteps,
  invert = false,
  describePoint,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useWidth(containerRef);
  const [active, setActive] = useState<number | null>(null);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const startMs = start.getTime();
  const spanMs = Math.max(end.getTime() - startMs, 1);
  const x = (date: Date) => MARGIN.left + ((date.getTime() - startMs) / spanMs) * plotWidth;

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const yTicks = niceTicks(Math.min(...allValues), Math.max(...allValues), tickSteps);
  const yLow = yTicks[0] ?? 0;
  const yHigh = yTicks.at(-1) ?? yLow + 1;
  const y = (value: number) => {
    const share = (value - yLow) / (yHigh - yLow);
    return MARGIN.top + (invert ? share : 1 - share) * plotHeight;
  };

  const xTicks = Array.from(
    { length: X_TICK_COUNT },
    (_, i) => new Date(startMs + (spanMs * i) / (X_TICK_COUNT - 1)),
  );
  const monthsOnly = spanMs > 120 * DAY_MS;

  const pointXs = dates.map(x);
  const nearestIndex = (px: number) =>
    pointXs.reduce(
      (best, cx, i) => (Math.abs(cx - px) < Math.abs((pointXs[best] ?? Infinity) - px) ? i : best),
      0,
    );

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(event.clientX - rect.left));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setActive((i) => Math.min(Math.max((i ?? dates.length - 1) + step, 0), dates.length - 1));
  };

  const activeX = active === null ? undefined : pointXs[active];

  return (
    <div ref={containerRef} className="relative min-w-0">
      {/* Width comes from the container, never the other way round, so the chart can shrink. */}
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="block w-full touch-pan-y rounded-lg tabular-nums"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(dates.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px]">
              {formatValue(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick, i) => (
          <text
            key={tick.getTime()}
            x={x(tick)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === X_TICK_COUNT - 1 ? "end" : "middle"}
            className="fill-ink-faint text-[11px]"
          >
            {tick.toLocaleDateString(undefined, monthsOnly ? { month: "short" } : { month: "short", day: "numeric" })}
          </text>
        ))}

        {activeX !== undefined && (
          <line
            x1={activeX}
            x2={activeX}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke="var(--color-line-strong)"
            strokeWidth={1}
          />
        )}

        {series.map((s) => {
          const points = pointXs.flatMap((cx, i) => {
            const value = s.values[i];
            return value == null ? [] : [{ i, cx, cy: y(value) }];
          });
          return (
            <g key={s.label}>
              <path
                d={points.map((p, n) => `${n === 0 ? "M" : "L"}${p.cx},${p.cy}`).join("")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p) => (
                <circle
                  key={p.i}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.i === active ? 6 : 4}
                  fill={s.color}
                  stroke="var(--color-canvas)"
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {active !== null && activeX !== undefined && (
        <ChartTooltip x={activeX} width={width}>
          <p className="text-xs text-ink-muted">{describePoint(active)}</p>
          {series.map((s) => {
            const value = s.values[active];
            return (
              <p key={s.label} className="mt-1 flex items-center gap-2 text-xs">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-semibold text-ink tabular-nums">
                  {value == null ? "–" : formatValue(value)}
                </span>
                <span className="text-ink-faint">{s.label}</span>
              </p>
            );
          })}
        </ChartTooltip>
      )}
    </div>
  );
}

function ChartTooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  // Pin the tooltip to the chart's edge instead of letting it hang off the side.
  const edge = 90;
  const placement =
    x < edge ? { left: 0 } : x > width - edge ? { right: 0 } : { left: x, transform: "translateX(-50%)" };
  return (
    <div
      className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-line-strong bg-[#0f1729] px-3 py-2 whitespace-nowrap shadow-lg"
      style={placement}
    >
      {children}
    </div>
  );
}

/** Evenly spaced round ticks covering [min, max], using the smallest step that needs five or fewer. */
function niceTicks(min: number, max: number, steps: number[]): number[] {
  for (const step of steps) {
    const low = Math.floor(min / step) * step;
    const high = Math.max(Math.ceil(max / step) * step, low + step);
    const count = Math.round((high - low) / step);
    if (count <= 4 || step === steps[steps.length - 1]) {
      return Array.from({ length: count + 1 }, (_, i) => low + i * step);
    }
  }
  return [min, max];
}

/** The element's current width, kept up to date as the window resizes. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
