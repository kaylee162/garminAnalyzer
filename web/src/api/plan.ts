import type { Race, SavedPlan, TrainingPlan } from "@garmin-analyzer/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type PlanRequest = { race: Race; raceDate: string };
export type SaveRequest = { id: number | null; name: string; plan: TrainingPlan };

const SAVED_PLANS_KEY = ["saved-plans"];

/**
 * Builds a fresh plan from the latest runs. A mutation rather than a query so a sync
 * doesn't silently rebuild (and throw away edits to) the plan on screen.
 */
export function useBuildPlan() {
  return useMutation({
    mutationFn: async ({ race, raceDate }: PlanRequest) => {
      const { data, error } = await api.GET("/plan", {
        params: { query: { race, race_date: raceDate } },
      });
      if (error || !data) throw new Error(errorDetail(error) ?? "Could not build a plan");
      return data;
    },
  });
}

export function useSavedPlans() {
  return useQuery({
    queryKey: SAVED_PLANS_KEY,
    queryFn: async () => {
      const { data, error } = await api.GET("/plans");
      if (error || !data) throw new Error("Could not load saved plans");
      return data;
    },
  });
}

export async function fetchSavedPlan(id: number): Promise<SavedPlan> {
  const { data, error } = await api.GET("/plans/{plan_id}", {
    params: { path: { plan_id: id } },
  });
  if (error || !data) throw new Error(errorDetail(error) ?? "Could not open that plan");
  return data;
}

/** Saves a new plan (id null) or overwrites an existing one. */
export function useSavePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, plan }: SaveRequest) => {
      const body = { name, plan };
      const { data, error } =
        id === null
          ? await api.POST("/plans", { body })
          : await api.PUT("/plans/{plan_id}", { params: { path: { plan_id: id } }, body });
      if (error || !data) throw new Error(errorDetail(error) ?? "Could not save the plan");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SAVED_PLANS_KEY }),
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await api.DELETE("/plans/{plan_id}", { params: { path: { plan_id: id } } });
      if (error) throw new Error("Could not delete the plan");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SAVED_PLANS_KEY }),
  });
}

function errorDetail(error: unknown): string | undefined {
  if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") {
    return error.detail;
  }
  return undefined;
}
