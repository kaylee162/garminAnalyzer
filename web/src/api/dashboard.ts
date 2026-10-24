import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/** The dashboard synopsis. Lives under ["activities"], so a sync refreshes it. */
export function useDashboard() {
  return useQuery({
    queryKey: ["activities", "dashboard"],
    queryFn: async () => {
      const { data, error } = await api.GET("/dashboard");
      if (error || !data) throw new Error("Could not load the dashboard");
      return data;
    },
  });
}
