"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActiveSession } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface SessionsTableProps {
  sessions: ActiveSession[];
  onSelectSession: (sessionId: number) => void;
}

export function SessionsTable({ sessions, onSelectSession }: SessionsTableProps) {
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("all");

  const uniqueSessions = useMemo(() => {
    const map = new Map<number, ActiveSession>();
    for (const session of sessions) {
      const existing = map.get(session.sessionId);
      if (
        !existing ||
        session.isBlocked ||
        session.waitTimeMs > existing.waitTimeMs
      ) {
        map.set(session.sessionId, session);
      }
    }
    return Array.from(map.values());
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();

    return uniqueSessions.filter((session) => {
      const matchesTab =
        tab === "all" ||
        (tab === "blocked" && session.isBlocked) ||
        (tab === "blockers" && session.isBlocker);

      if (!matchesTab) {
        return false;
      }

      if (!normalizedFilter) {
        return true;
      }

      return [
        session.sessionId.toString(),
        session.loginName,
        session.hostName,
        session.programName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedFilter));
    });
  }, [filter, tab, uniqueSessions]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Sesiones activas</CardTitle>
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar por SPID, login o host..."
            className="max-w-sm"
          />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="blocked">Bloqueadas</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
          </TabsList>
          <TabsContent value={tab}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">SPID</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Login</th>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Programa</th>
                    <th className="px-3 py-2">Blocker</th>
                    <th className="px-3 py-2">Wait</th>
                    <th className="px-3 py-2">Duracion</th>
                    <th className="px-3 py-2">Tx abiertas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => (
                    <tr
                      key={session.sessionId}
                      className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/60"
                      onClick={() => onSelectSession(session.sessionId)}
                    >
                      <td className="px-3 py-2 font-medium">{session.sessionId}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Badge>{session.status}</Badge>
                          {session.isBlocked ? <Badge variant="danger">Blocked</Badge> : null}
                          {session.isBlocker ? <Badge variant="warning">Blocker</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">{session.loginName}</td>
                      <td className="px-3 py-2">{session.hostName ?? "-"}</td>
                      <td className="px-3 py-2">{session.programName ?? "-"}</td>
                      <td className="px-3 py-2">
                        {session.blockingSessionId ?? "-"}
                      </td>
                      <td className="px-3 py-2">{session.waitType ?? "-"}</td>
                      <td className="px-3 py-2">
                        {session.waitTimeMs > 0
                          ? formatDuration(session.waitTimeMs)
                          : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {session.openTransactionCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSessions.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  No hay sesiones para el filtro actual
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </CardHeader>
      <CardContent className="text-xs text-zinc-500">
        {filteredSessions.length} sesiones visibles de {uniqueSessions.length}
      </CardContent>
    </Card>
  );
}
