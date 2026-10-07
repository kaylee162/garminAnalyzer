import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export function useRecentRuns(limit = 30) {
  return useQuery({
    queryKey: ["activities", "run", limit],
    queryFn: async () => {
      const { data, error } = await api.GET("/activities", {
        params: { query: { sport: "run", limit } },
      });
      if (error || !data) throw new Error("Could not load activities");
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
