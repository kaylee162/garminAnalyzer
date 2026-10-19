import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivitySummary } from "@garmin-analyzer/api-client";
import type { Sport } from "../sports";
import { api } from "./client";

// The most the API returns in one request.
const PAGE_SIZE = 200;

/** Every activity of one sport, newest first, fetched a page at a time. */
export function useAllActivities(sport: Sport) {
  return useQuery({
    queryKey: ["activities", sport, "all"],
    queryFn: async () => {
      const activities: ActivitySummary[] = [];
      let total = Infinity;
      while (activities.length < total) {
        const { data, error } = await api.GET("/activities", {
          params: { query: { sport, limit: PAGE_SIZE, offset: activities.length } },
        });
        if (error || !data) throw new Error("Could not load activities");
        activities.push(...data.items);
        total = data.total;
        if (data.items.length === 0) break;
      }
      return activities;
    },
  });
}

/** Averages over every synced activity of one sport. Lives under ["activities"], so a sync refreshes it. */
export function useActivityStats(sport: Sport) {
  return useQuery({
    queryKey: ["activities", "stats", sport],
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/stats", {
        params: { query: { sport } },
      });
      if (error || !data) throw new Error("Could not load stats");
      return data;
    },
  });
}

/** Every activity of one sport from `since` (a local YYYY-MM-DD date) to now, oldest first. Keeps the last range on screen while a new one loads. */
export function useActivityTrend(sport: Sport, since: string) {
  return useQuery({
    queryKey: ["activities", "trend", sport, since],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/trend", {
        params: { query: { since, sport } },
      });
      if (error || !data) throw new Error("Could not load trend");
      return data;
    },
  });
}

/** Every detail Garmin recorded for one activity. Only fetched once the row is expanded. */
export function useActivityDetails(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["activities", "details", id],
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/activities/{activity_id}/details", {
        params: { path: { activity_id: id } },
      });
      if (error || !data) throw new Error("Could not load details");
      return data;
    },
  });
}

/** Compares two activities once both are picked. The API orders them by date, so `ids` can be in any order. */
export function useCompareActivities(ids: [number, number] | null) {
  return useQuery({
    queryKey: ["activities", "compare", ids],
    enabled: ids !== null,
    queryFn: async () => {
      const [a, b] = ids!;
      const { data, error } = await api.GET("/activities/compare", {
        params: { query: { a, b } },
      });
      if (error || !data) throw new Error("Could not compare activities");
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
