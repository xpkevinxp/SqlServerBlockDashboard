"use client";

import { useQuery } from "@tanstack/react-query";
import type { HealthStatus } from "@/lib/types/blocking";

async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health", { cache: "no-store" });
  const data = (await response.json()) as HealthStatus;
  return data;
}

export function useHealthStatus(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, intervalMs - 1000),
  });
}
