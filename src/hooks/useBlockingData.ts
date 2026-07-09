"use client";

import { useQuery } from "@tanstack/react-query";
import type { BlockingSnapshot } from "@/lib/types/blocking";

async function fetchBlockingSnapshot(): Promise<BlockingSnapshot> {
  const response = await fetch("/api/blocking", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Error al obtener bloqueos");
  }
  return response.json() as Promise<BlockingSnapshot>;
}

export function useBlockingData(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["blocking"],
    queryFn: fetchBlockingSnapshot,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, intervalMs - 1000),
  });
}
