import { useState } from "react";
import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { useActivityDetails, useAllRuns } from "../api/activities";
import { formatDate, formatDuration, formatNumber } from "../format";

type RecentRunsProps = {
  selectedIds: number[];
  onToggle: (id: number) => void;
};

const COLUMN_COUNT = 6;
const COLLAPSED_COUNT = 3;

export function RecentRuns({ selectedIds, onToggle }: RecentRunsProps) {
  const { data, isPending, isError } = useAllRuns();
  const [showAll, setShowAll] = useState(false);
  const runs = data ?? [];
  const visibleRuns = showAll ? runs : runs.slice(0, COLLAPSED_COUNT);

  return (
    <section id="runs" className="mt-10 scroll-mt-20 sm:mt-14">
      <h2 className="text-xl font-bold tracking-tight">Recent runs</h2>
      <p className="mt-1 text-sm text-ink-muted">Tick two runs to compare them.</p>
      {isPending && <p className="mt-4 text-sm text-ink-faint">Loading…</p>}
      {isError && <p className="mt-4 text-sm text-bad">Could not load runs.</p>}
      {data && data.length === 0 && (
        <p className="card mt-4 px-5 py-8 text-center text-sm text-ink-muted">
          No runs yet. Sync with Garmin to pull them in.
        </p>
      )}
      {runs.length > 0 && (
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-sm tabular-nums">
            <thead className="border-b border-line text-left whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="w-10 py-3 pr-1 pl-4">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="hidden px-3 py-3 font-semibold sm:table-cell">Date</th>
                <th className="px-3 py-3 font-semibold">Run</th>
                <th className="px-3 py-3 text-right font-semibold">
                  <MetricDot className="bg-metric-distance" />
                  Distance
                </th>
                <th className="py-3 pr-1 pl-3 text-right font-semibold sm:px-3">
                  <MetricDot className="bg-metric-time" />
                  Time
                </th>
                <th className="w-12 py-3 pr-3 pl-1">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={selectedIds.includes(run.id)}
                  onToggle={() => onToggle(run.id)}
                />
              ))}
            </tbody>
          </table>
          {runs.length > COLLAPSED_COUNT && (
            <div className="border-t border-line p-2 text-center">
              <button
                type="button"
                onClick={() => setShowAll((all) => !all)}
                aria-expanded={showAll}
                className="btn btn-ghost w-full"
              >
                {showAll ? "Show fewer" : `Show all ${runs.length} runs`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type RunRowProps = {
  run: ActivitySummary;
  selected: boolean;
  onToggle: () => void;
};

function RunRow({ run, selected, onToggle }: RunRowProps) {
  const [expanded, setExpanded] = useState(false);
  const name = run.name ?? "Run";
  const date = formatDate(run.start_time_local);

  return (
    <>
      <tr
        className={`border-t border-line transition-colors first:border-t-0 ${selected ? "bg-accent/10" : "hover:bg-surface"}`}
      >
        <td className={`py-3 pr-1 pl-4 ${selected ? "shadow-[inset_3px_0_0_var(--color-accent)]" : ""}`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Compare ${name} on ${date}`}
            className="h-4 w-4 cursor-pointer"
          />
        </td>
        <td className="hidden whitespace-nowrap px-3 py-3 text-ink-muted sm:table-cell">{date}</td>
        <td className="px-3 py-3">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-ink-faint sm:hidden">{date}</p>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{formatNumber(run.distance_mi, 2, " mi")}</td>
        <td className="whitespace-nowrap py-3 pr-1 pl-3 text-right text-ink-muted sm:px-3">
          {formatDuration(run.moving_time_s ?? run.duration_s)}
        </td>
        <td className="py-2 pr-3 pl-1 text-right">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${name} on ${date}`}
            className="rounded-full p-2 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-line bg-black/20">
          <td colSpan={COLUMN_COUNT} className="px-4 py-5 sm:px-6">
            <RunDetails id={run.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function RunDetails({ id }: { id: number }) {
  const { data, isPending, isError } = useActivityDetails(id, true);

  if (isPending) return <p className="text-ink-faint">Loading details…</p>;
  if (isError) return <p className="text-bad">Could not load details for this run.</p>;

  return (
    <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.sections.map((section) => (
        <div key={section.title}>
          <h3 className="eyebrow">{section.title}</h3>
          <dl className="mt-2 space-y-1">
            {section.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{item.label}</dt>
                <dd className="text-right font-medium">{item.display}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function MetricDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${className}`} />;
}
