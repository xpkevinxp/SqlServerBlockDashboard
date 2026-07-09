"use client";

import { Activity, AlertTriangle, Clock3, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlockingKpis } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface KpiCardsProps {
  kpis: BlockingKpis;
}

const items = [
  {
    key: "blockedSessions",
    label: "Sesiones bloqueadas",
    icon: AlertTriangle,
    accent: "text-red-400",
  },
  {
    key: "activeChains",
    label: "Cadenas activas",
    icon: ShieldAlert,
    accent: "text-amber-400",
  },
  {
    key: "headBlockers",
    label: "Head blockers",
    icon: Activity,
    accent: "text-sky-400",
  },
  {
    key: "maxWaitTimeMs",
    label: "Wait time maximo",
    icon: Clock3,
    accent: "text-violet-400",
    format: (value: number) => formatDuration(value),
  },
] as const;

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const rawValue = kpis[item.key];
        const value =
          "format" in item && item.format
            ? item.format(rawValue)
            : rawValue.toString();

        return (
          <Card key={item.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-zinc-400">
                {item.label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${item.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
