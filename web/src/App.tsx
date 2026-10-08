import { useState } from "react";
import { useHealth } from "./api/health";
import { RecentRuns } from "./components/RecentRuns";
import { RunComparison } from "./components/RunComparison";
import { SyncPanel } from "./components/SyncPanel";
import { TrainingPlan } from "./components/TrainingPlan";

export function App() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Keep at most two runs picked: ticking a third replaces the one picked first.
  const toggleRun = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2),
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-900">
      <h1 className="text-2xl font-semibold">Garmin Analyzer</h1>
      <p className="mt-1 text-slate-600">Trends and training plans from your Garmin runs.</p>
      <ApiStatus />
      <SyncPanel />
      <RecentRuns selectedIds={selectedIds} onToggle={toggleRun} />
      <RunComparison selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
      <TrainingPlan />
    </main>
  );
}

function ApiStatus() {
  const { data, isPending, isError } = useHealth();

  let label = "Checking the API…";
  let dot = "bg-slate-400";
  if (isError) {
    label = "Can't reach the API. Is the backend running on port 8000?";
    dot = "bg-red-500";
  } else if (data) {
    label = `API ${data.status}, database ${data.database} (v${data.version})`;
    dot = data.database === "ok" ? "bg-green-500" : "bg-amber-500";
  }

  return (
    <div className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${isPending ? "animate-pulse " : ""}${dot}`} />
      <span>{label}</span>
    </div>
  );
}
