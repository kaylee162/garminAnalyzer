import { useDashboard } from "../../api/dashboard";
import { AllTimeStats } from "../../components/AllTimeStats";
import { PeriodSummary } from "../../components/PeriodSummary";
import { RecentActivities } from "../../components/RecentActivities";
import { SportBreakdown } from "../../components/SportBreakdown";
import { SyncPanel } from "../../components/SyncPanel";
import { WeeklyVolume } from "../../components/WeeklyVolume";

/** The home page: a synopsis of every sport, linking through to each sport's page. */
export function DashboardPage() {
  const { data, isError } = useDashboard();

  return (
    <>
      <div className="flex flex-col gap-6 sm:gap-8">
        <SyncPanel canSync />
        {isError ? (
          <p className="text-sm text-bad">Could not load your dashboard.</p>
        ) : (
          <AllTimeStats dashboard={data} />
        )}
      </div>
      {data && data.totals.count === 0 && (
        <p className="card px-5 py-10 text-center text-sm text-ink-muted">
          No activities yet. Sync with Garmin to pull them in.
        </p>
      )}
      {data && data.totals.count > 0 && (
        <>
          <PeriodSummary dashboard={data} />
          <SportBreakdown dashboard={data} />
          <WeeklyVolume weeks={data.weekly} />
          <RecentActivities activities={data.recent} />
        </>
      )}
    </>
  );
}
