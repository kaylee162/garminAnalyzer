import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error || !data) throw new Error("API did not respond");
      return data;
    },
    refetchInterval: 30_000,
  });
}
