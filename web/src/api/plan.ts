import type { Race } from "@garmin-analyzer/api-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export type PlanRequest = { race: Race; raceDate: string };

/** Builds a training plan once a race and date are submitted. Recomputed from the latest runs after a sync. */
export function useTrainingPlan(request: PlanRequest | null) {
  return useQuery({
    // Under "activities" so a sync (which invalidates that key) refreshes the plan too.
    queryKey: ["activities", "plan", request],
    enabled: request !== null,
    queryFn: async () => {
      const { race, raceDate } = request!;
      const { data, error } = await api.GET("/plan", {
        params: { query: { race, race_date: raceDate } },
      });
      if (error || !data) {
        const detail = error && "detail" in error ? error.detail : undefined;
        throw new Error(typeof detail === "string" ? detail : "Could not build a plan");
      }
      return data;
    },
  });
}
