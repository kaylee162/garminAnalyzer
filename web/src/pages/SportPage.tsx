import { useState, type ReactNode } from "react";
import { ActivityComparison } from "../components/ActivityComparison";
import { ActivityList } from "../components/ActivityList";
import { ActivityTrends } from "../components/ActivityTrends";
import { OverallStats } from "../components/OverallStats";
import { SyncPanel } from "../components/SyncPanel";
import type { SportConfig } from "../sports";

type SportPageProps = {
  config: SportConfig;
  // Extra sections shown after the comparison, e.g. the training plan on the running page.
  children?: ReactNode;
};

/** The layout every sport page shares: the sync panel, averages, progress charts, the activity list and a comparison. */
export function SportPage({ config, children }: SportPageProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Keep at most two activities picked: ticking a third replaces the one picked first.
  const toggleActivity = (id: number) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2),
    );

  return (
    <>
      <div className="flex flex-col gap-6 sm:gap-8">
        <SyncPanel />
        <OverallStats config={config} />
      </div>
      <ActivityTrends config={config} />
      <ActivityList config={config} selectedIds={selectedIds} onToggle={toggleActivity} />
      <ActivityComparison config={config} selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
      {children}
    </>
  );
}
