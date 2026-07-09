"use client";

import { useQuery } from "@tanstack/react-query";
import type { SessionDetail } from "@/lib/types/blocking";

async function fetchSessionDetail(spid: number): Promise<SessionDetail> {
  const response = await fetch(`/api/sessions/${spid}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Error al obtener detalle");
  }
  return response.json() as Promise<SessionDetail>;
}

export function useSessionDetail(spid: number | null) {
  return useQuery({
    queryKey: ["session-detail", spid],
    queryFn: () => fetchSessionDetail(spid!),
    enabled: spid !== null,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}
