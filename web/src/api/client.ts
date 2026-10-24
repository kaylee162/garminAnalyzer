import { createApiClient } from "@garmin-analyzer/api-client";

// Same-origin /api by default: Vercel routes it to the backend, and in dev Vite proxies it.
export const api = createApiClient(import.meta.env.VITE_API_URL ?? "/api");
