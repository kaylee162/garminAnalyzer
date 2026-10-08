import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type Health = Schemas["Health"];
export type ActivitySummary = Schemas["ActivitySummary"];
export type ActivityPage = Schemas["ActivityPage"];
export type ActivityDetails = Schemas["ActivityDetails"];
export type DetailSection = Schemas["DetailSection"];
export type ActivityComparison = Schemas["ActivityComparison"];
export type MetricComparison = Schemas["MetricComparison"];
export type SyncStatus = Schemas["SyncStatus"];
export type SyncResult = Schemas["SyncResultOut"];
export type TrainingPlan = Schemas["TrainingPlan"];
export type PlanWeek = Schemas["PlanWeek"];
export type Workout = Schemas["Workout"];
export type PaceZone = Schemas["PaceZone"];
export type RecentTraining = Schemas["RecentTraining"];
export type Race = TrainingPlan["race"];

/** Create a typed API client. Every path, parameter and response is checked against the backend's OpenAPI spec. */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
