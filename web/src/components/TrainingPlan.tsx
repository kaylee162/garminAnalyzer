import { useState, type FormEvent } from "react";
import type { PaceZone, PlanWeek, Race, TrainingPlan as Plan, Workout } from "@garmin-analyzer/api-client";
import { useTrainingPlan, type PlanRequest } from "../api/plan";
import { formatDuration, formatNumber, formatPace } from "../format";

const RACES: { value: Race; label: string }[] = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "20k", label: "20K" },
  { value: "half_marathon", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
];

const PHASE_COLORS: Record<PlanWeek["phase"], string> = {
  base: "bg-sky-100 text-sky-800",
  build: "bg-amber-100 text-amber-800",
  peak: "bg-rose-100 text-rose-800",
  taper: "bg-emerald-100 text-emerald-800",
};

// Workouts that aren't easy running get a colored marker so the week's key sessions stand out.
const KIND_COLORS: Record<Workout["kind"], string> = {
  easy: "bg-slate-300",
  strides: "bg-sky-400",
  long: "bg-indigo-500",
  threshold: "bg-amber-500",
  intervals: "bg-rose-500",
  race_pace: "bg-fuchsia-500",
  race: "bg-emerald-600",
};

// Weeks shown open when a plan first loads; the rest are collapsed.
const OPEN_WEEKS = 2;

export function TrainingPlan() {
  const [race, setRace] = useState<Race>("half_marathon");
  const [raceDate, setRaceDate] = useState(() => toIsoDate(addDays(new Date(), 12 * 7)));
  const [request, setRequest] = useState<PlanRequest | null>(null);
  const { data, isFetching, isError, error } = useTrainingPlan(request);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setRequest({ race, raceDate });
  };

  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">Training plan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Estimates your race time from your recent runs and lays out the weeks until race day.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Training for</span>
          <select
            value={race}
            onChange={(e) => setRace(e.target.value as Race)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {RACES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Race date</span>
          <input
            type="date"
            required
            value={raceDate}
            min={toIsoDate(addDays(new Date(), 1))}
            onChange={(e) => setRaceDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isFetching}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {isFetching ? "Building…" : "Build plan"}
        </button>
      </form>

      {isError && <p className="mt-4 text-sm text-red-600">{error.message}</p>}
      {data && <PlanView plan={data} />}
    </section>
  );
}

function PlanView({ plan }: { plan: Plan }) {
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
        <Prediction plan={plan} />
        <RecentStats plan={plan} />
      </div>
      {plan.notes.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {plan.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <Paces paces={plan.paces} />
      <Weeks weeks={plan.weeks} />
    </div>
  );
}

function Prediction({ plan }: { plan: Plan }) {
  const saved = plan.predicted_time_s - plan.projected_time_s;
  return (
    <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">If you raced today</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatDuration(plan.predicted_time_s)}</p>
          <p className="mt-0.5 text-sm tabular-nums text-slate-600">{formatPace(plan.predicted_pace_s_per_mi)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">After the plan</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-emerald-700">
            {formatDuration(plan.projected_time_s)}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-slate-600">{formatPace(plan.projected_pace_s_per_mi)}</p>
        </div>
      </div>
      {saved >= 1 && (
        <p className="mt-2 text-sm tabular-nums text-emerald-700">
          About {formatDuration(saved)} faster on race day
        </p>
      )}
    </div>
  );
}

function RecentStats({ plan }: { plan: Plan }) {
  const r = plan.recent;
  const stats: [string, string][] = [
    ["Weekly distance", formatNumber(r.weekly_mi, 1, " mi")],
    ["Runs per week", formatNumber(r.runs_per_week, 1)],
    ["Longest run", formatNumber(r.longest_run_mi, 1, " mi")],
    ["Avg pace", formatPace(r.avg_pace_s_per_mi)],
    ["Avg heart rate", formatNumber(r.avg_hr, 0, " bpm")],
    ["Avg cadence", formatNumber(r.avg_cadence, 0, " spm")],
    ["Avg stride", formatNumber(r.avg_stride_m, 2, " m")],
    ["Runs analyzed", String(r.run_count)],
  ];
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Your last {r.days_covered} days{r.stale ? " (older runs)" : ""}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm tabular-nums sm:grid-cols-4">
        {stats.map(([name, value]) => (
          <div key={name}>
            <dt className="text-xs text-slate-500">{name}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Paces({ paces }: { paces: PaceZone[] }) {
  return (
    <div>
      <h3 className="font-semibold">Training paces</h3>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {paces.map((zone) => (
              <tr key={zone.key} className="border-t border-slate-100 first:border-t-0">
                <td className="px-3 py-2 font-medium">{zone.label}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatPaceRange(zone.fast_s_per_mi, zone.slow_s_per_mi)}</td>
                <td className="px-3 py-2 text-slate-500">{zone.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Weeks({ weeks }: { weeks: PlanWeek[] }) {
  return (
    <div>
      <h3 className="font-semibold">Week by week</h3>
      <div className="mt-3 space-y-2">
        {weeks.map((week, i) => (
          <WeekCard key={week.number} week={week} defaultOpen={i < OPEN_WEEKS} />
        ))}
      </div>
    </div>
  );
}

function WeekCard({ week, defaultOpen }: { week: PlanWeek; defaultOpen: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
        <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        <span className="font-medium">Week {week.number}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PHASE_COLORS[week.phase]}`}>
          {week.phase}
        </span>
        <span className="ml-auto tabular-nums text-slate-600">{week.total_mi.toFixed(1)} mi</span>
      </summary>
      {week.workouts.length === 0 ? (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">This week is already over.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {week.workouts.map((w) => (
            <WorkoutRow key={w.date} workout={w} />
          ))}
        </ul>
      )}
    </details>
  );
}

function WorkoutRow({ workout }: { workout: Workout }) {
  return (
    <li className="grid grid-cols-[6rem_1fr_auto] gap-x-3 px-4 py-2.5 text-sm">
      <span className="text-slate-500">{formatPlanDate(workout.date)}</span>
      <div>
        <p className="flex items-center gap-2 font-medium">
          <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_COLORS[workout.kind]}`} />
          {workout.title}
        </p>
        <p className="mt-0.5 text-slate-500">{workout.description}</p>
      </div>
      <div className="text-right tabular-nums">
        <p className="font-medium">{workout.distance_mi.toFixed(1)} mi</p>
        <p className="text-xs text-slate-500">{formatPaceRange(workout.fast_s_per_mi, workout.slow_s_per_mi)}</p>
      </div>
    </li>
  );
}

function formatPaceRange(fast: number, slow: number): string {
  return `${formatDuration(fast)}–${formatPace(slow)}`;
}

/** Plan dates are calendar days ("2026-10-07"). Parse them as local dates so they don't shift a day. */
function formatPlanDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
