"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActiveSession } from "@/lib/types/blocking";

interface SessionsResponse {
  timestamp: string;
  sessions: ActiveSession[];
}

async function fetchSessions(): Promise<SessionsResponse> {
  const response = await fetch("/api/sessions", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Error al obtener sesiones");
  }
  return response.json() as Promise<SessionsResponse>;
}

export function useSessionsData(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, intervalMs - 1000),
  });
}
