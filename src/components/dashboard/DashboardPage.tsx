"use client";

import { useCallback, useMemo, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { BlockingChainGraph } from "@/components/dashboard/BlockingChainGraph";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { SessionDetailSheet } from "@/components/dashboard/SessionDetailSheet";
import { SessionsTable } from "@/components/dashboard/SessionsTable";
import { WaitTypesChart } from "@/components/dashboard/WaitTypesChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBlockingData } from "@/hooks/useBlockingData";
import { useHealthStatus } from "@/hooks/useHealthStatus";
import { useSessionsData } from "@/hooks/useSessionsData";

const POLL_OPTIONS = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
] as const;

const EMPTY_KPIS = {
  blockedSessions: 0,
  activeChains: 0,
  maxWaitTimeMs: 0,
  headBlockers: 0,
};

export function DashboardPage() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pollInterval, setPollInterval] = useState(5000);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const healthPollInterval = Math.max(pollInterval, 30000);
  const healthQuery = useHealthStatus(autoRefresh, healthPollInterval);
  const blockingQuery = useBlockingData(autoRefresh, pollInterval);
  const sessionsQuery = useSessionsData(autoRefresh, pollInterval);
  const { refetch: refetchHealth } = healthQuery;
  const { refetch: refetchBlocking } = blockingQuery;
  const { refetch: refetchSessions } = sessionsQuery;

  const snapshot = blockingQuery.data;
  const sessions = sessionsQuery.data?.sessions ?? [];

  const lastUpdated = useMemo(() => {
    const timestamps = [
      snapshot?.timestamp,
      sessionsQuery.data?.timestamp,
      healthQuery.data?.serverTime,
    ].filter(Boolean) as string[];

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(
      timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
    ).toLocaleString("es-PE");
  }, [healthQuery.data?.serverTime, sessionsQuery.data?.timestamp, snapshot?.timestamp]);

  const handleSelectSession = useCallback((sessionId: number) => {
    setSelectedSessionId(sessionId);
    setDetailOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchHealth();
    void refetchBlocking();
    void refetchSessions();
  }, [refetchBlocking, refetchHealth, refetchSessions]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const errorMessage =
    blockingQuery.error?.message ??
    sessionsQuery.error?.message ??
    healthQuery.data?.error;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              SQL Server Block Monitor
            </h1>
            <p className="text-sm text-zinc-400">
              Vista en tiempo real de bloqueos, cadenas y sesiones activas
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ConnectionStatus
              health={healthQuery.data}
              isLoading={healthQuery.isLoading}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Auto-refresh</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="flex items-center gap-2">
              {POLL_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={pollInterval === option.value ? "default" : "outline"}
                  onClick={() => setPollInterval(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        {healthQuery.data?.connected && !healthQuery.data.hasViewServerState ? (
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            El usuario SQL no tiene <strong>VIEW SERVER STATE</strong>. Pide al DBA que ejecute:
            <code className="mt-2 block rounded bg-zinc-900 px-2 py-1 text-xs">
              GRANT VIEW SERVER STATE TO [kipuprod];
            </code>
            Script disponible en <code>scripts/grant-monitor-permissions.sql</code>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Badge variant="info">
            {lastUpdated ? `Ultima actualizacion: ${lastUpdated}` : "Sin datos"}
          </Badge>
          {blockingQuery.isFetching || sessionsQuery.isFetching ? (
            <Badge variant="warning">Actualizando...</Badge>
          ) : null}
        </div>

        <KpiCards
          kpis={snapshot?.kpis ?? EMPTY_KPIS}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <BlockingChainGraph
              chains={snapshot?.chains ?? []}
              selectedSessionId={selectedSessionId}
              onSelectSession={handleSelectSession}
            />
          </div>
          <WaitTypesChart data={snapshot?.waitTypeAggregates ?? []} />
        </div>

        <SessionsTable sessions={sessions} onSelectSession={handleSelectSession} />
      </main>

      <SessionDetailSheet
        sessionId={selectedSessionId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
