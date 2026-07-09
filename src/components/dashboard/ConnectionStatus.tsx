"use client";

import { Badge } from "@/components/ui/badge";
import type { HealthStatus } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface ConnectionStatusProps {
  health?: HealthStatus;
  isLoading?: boolean;
}

export function ConnectionStatus({ health, isLoading }: ConnectionStatusProps) {
  if (isLoading) {
    return <Badge variant="warning">Verificando conexion...</Badge>;
  }

  if (!health?.connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="danger">Desconectado</Badge>
        {health?.error ? (
          <span className="text-xs text-zinc-500">{health.error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">Conectado</Badge>
      <Badge variant="info">{formatDuration(health.latencyMs)}</Badge>
      {health.hasViewServerState ? (
        <Badge variant="success">VIEW SERVER STATE</Badge>
      ) : (
        <Badge variant="warning">Sin VIEW SERVER STATE</Badge>
      )}
    </div>
  );
}
