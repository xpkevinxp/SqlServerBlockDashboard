"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WaitTypeAggregate } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface WaitTypesChartProps {
  data: WaitTypeAggregate[];
}

export function WaitTypesChart({ data }: WaitTypesChartProps) {
  const chartData = useMemo(
    () =>
      data.slice(0, 8).map((item) => ({
        name: item.waitType.replace("LCK_M_", ""),
        count: item.count,
        totalWaitMs: item.totalWaitMs,
      })),
    [data],
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top wait types (LCK)</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Sin bloqueos activos
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={70}
                stroke="#71717a"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  background: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(value, name) => {
                  if (name === "totalWaitMs") {
                    return [formatDuration(Number(value)), "Tiempo total"];
                  }
                  return [value, "Sesiones"];
                }}
              />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
