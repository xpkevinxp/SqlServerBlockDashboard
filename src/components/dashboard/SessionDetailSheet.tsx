"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSessionDetail } from "@/hooks/useSessionDetail";
import { formatDuration } from "@/lib/utils";

interface SessionDetailSheetProps {
  sessionId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionDetailSheet({
  sessionId,
  open,
  onOpenChange,
}: SessionDetailSheetProps) {
  const { data, isLoading, error } = useSessionDetail(sessionId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {sessionId ? `Detalle SPID ${sessionId}` : "Detalle de sesion"}
          </SheetTitle>
          <SheetDescription>
            Query, locks y contexto del cliente
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <p className="text-sm text-zinc-400">Cargando detalle...</p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400">{error.message}</p>
        ) : null}

        {data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{data.status}</Badge>
              {data.blockingSessionId ? (
                <Badge variant="danger">Bloqueado por {data.blockingSessionId}</Badge>
              ) : null}
              {data.openTransactionCount > 0 ? (
                <Badge variant="warning">
                  {data.openTransactionCount} transacciones abiertas
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm text-zinc-300">
              <p>
                <span className="text-zinc-500">Login:</span> {data.loginName}
              </p>
              <p>
                <span className="text-zinc-500">Host:</span> {data.hostName ?? "-"}
              </p>
              <p>
                <span className="text-zinc-500">Programa:</span>{" "}
                {data.programName ?? "-"}
              </p>
              <p>
                <span className="text-zinc-500">IP cliente:</span>{" "}
                {data.clientNetAddress ?? "-"}
              </p>
              <p>
                <span className="text-zinc-500">Wait:</span>{" "}
                {data.waitType ?? "-"} ({formatDuration(data.waitTimeMs)})
              </p>
              <p>
                <span className="text-zinc-500">Recurso:</span>{" "}
                {data.waitResource ?? "-"}
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-200">Query</h4>
              <ScrollArea className="h-48 rounded-md border border-zinc-800 bg-zinc-900 p-3">
                <pre className="whitespace-pre-wrap break-words text-xs text-zinc-300">
                  {data.queryText ?? "Sin texto de query disponible"}
                </pre>
              </ScrollArea>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-200">Locks</h4>
              {data.locks.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin locks visibles</p>
              ) : (
                <div className="space-y-2">
                  {data.locks.map((lock, index) => (
                    <div
                      key={`${lock.resourceType}-${lock.requestMode}-${index}`}
                      className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300"
                    >
                      <p>
                        {lock.resourceType ?? "?"} / {lock.requestMode ?? "?"} /{" "}
                        {lock.requestStatus ?? "?"}
                      </p>
                      <p className="text-zinc-500">
                        {lock.databaseName ?? "DB desconocida"}
                      </p>
                      {lock.resourceDescription ? (
                        <p className="text-zinc-500">{lock.resourceDescription}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
