import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivitySummary } from "@garmin-analyzer/api-client";
import { api } from "./client";

// The most the API returns in one request.
const PAGE_SIZE = 200;

/** Every run, newest first, fetched a page at a time. */
export function useAllRuns() {
  return useQuery({
    queryKey: ["activities", "run", "all"],
    queryFn: async () => {
      const runs: ActivitySummary[] = [];
      let total = Infinity;
      while (runs.length < total) {
        const { data, error } = await api.GET("/activities", {
          params: { query: { sport: "run", limit: PAGE_SIZE, offset: runs.length } },
        });
        if (error || !data) throw new Error("Could not load activities");
        runs.push(...data.items);
        total = data.total;
        if (data.items.length === 0) break;
      }
      return runs;
    },
  });
}

/** Averages over every synced run. Lives under ["activities"], so a sync refreshes it. */
export function useRunStats() {
  return useQuery({
    queryKey: ["activities", "stats", "run"],
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/stats", {
        params: { query: { sport: "run" } },
      });
      if (error || !data) throw new Error("Could not load run stats");
      return data;
    },
  });
}

/** Every run from `since` (a local YYYY-MM-DD date) to now, oldest first. Keeps the last range on screen while a new one loads. */
export function useRunTrend(since: string) {
  return useQuery({
    queryKey: ["activities", "trend", "run", since],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/trend", {
        params: { query: { since, sport: "run" } },
      });
      if (error || !data) throw new Error("Could not load run trend");
      return data;
    },
  });
}

/** Every detail Garmin recorded for one run. Only fetched once the row is expanded. */
export function useActivityDetails(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["activities", "details", id],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/{activity_id}/details", {
        params: { path: { activity_id: id } },
      });
      if (error || !data) throw new Error("Could not load run details");
      return data;
    },
  });
}

/** Compares two runs once both are picked. The API orders them by date, so `ids` can be in any order. */
export function useCompareRuns(ids: [number, number] | null) {
  return useQuery({
    queryKey: ["activities", "compare", ids],
    enabled: ids !== null,
    queryFn: async () => {
      const [a, b] = ids!;
      const { data, error } = await api.GET("/activities/compare", {
        params: { query: { a, b } },
      });
      if (error || !data) throw new Error("Could not compare runs");
      return data;
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const { data, error } = await api.GET("/sync/status");
      if (error || !data) throw new Error("Could not load sync status");
      return data;
    },
  });
}

export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/sync");
      if (error || !data) {
        const detail = error && "detail" in error ? error.detail : undefined;
        throw new Error(typeof detail === "string" ? detail : "Sync failed. Is the API running?");
      }
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
  });
}
