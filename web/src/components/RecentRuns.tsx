import { useState } from "react";
import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { useActivityDetails, useRecentRuns } from "../api/activities";
import { formatDate, formatDuration, formatNumber } from "../format";

type RecentRunsProps = {
  selectedIds: number[];
  onToggle: (id: number) => void;
};

const COLUMN_COUNT = 6;

export function RecentRuns({ selectedIds, onToggle }: RecentRunsProps) {
  const { data, isPending, isError } = useRecentRuns();

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Recent runs</h2>
      <p className="mt-1 text-sm text-slate-500">Tick two runs to compare them.</p>
      {isPending && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {isError && <p className="mt-2 text-sm text-red-600">Could not load runs.</p>}
      {data && data.items.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">No runs yet. Sync with Garmin to pull them in.</p>
      )}
      {data && data.items.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="w-8 px-3 py-2">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Run</th>
                <th className="px-3 py-2 text-right font-medium">Distance</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="w-10 px-3 py-2">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={selectedIds.includes(run.id)}
                  onToggle={() => onToggle(run.id)}
                />
              ))}
            </tbody>
          </table>
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
      <tr className={`border-t border-slate-100 ${selected ? "bg-sky-50" : ""}`}>
        <td className="px-3 py-2">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Compare ${name} on ${date}`} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{date}</td>
        <td className="px-3 py-2">{name}</td>
        <td className="px-3 py-2 text-right">{formatNumber(run.distance_mi, 2, " mi")}</td>
        <td className="px-3 py-2 text-right">{formatDuration(run.moving_time_s ?? run.duration_s)}</td>
        <td className="px-3 py-1 text-right">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${name} on ${date}`}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
        <tr className="border-t border-slate-100 bg-slate-50/60">
          <td colSpan={COLUMN_COUNT} className="px-4 py-4">
            <RunDetails id={run.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function RunDetails({ id }: { id: number }) {
  const { data, isPending, isError } = useActivityDetails(id, true);

  if (isPending) return <p className="text-slate-500">Loading details…</p>;
  if (isError) return <p className="text-red-600">Could not load details for this run.</p>;

  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{section.title}</h3>
          <dl className="mt-1.5 space-y-0.5">
            {section.items.map((item) => (
              <div key={item.key} className="flex justify-between gap-4">
                <dt className="text-slate-600">{item.label}</dt>
                <dd className="text-right">{item.display}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
