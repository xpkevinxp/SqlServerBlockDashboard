"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BlockingChainNode } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface BlockingChainGraphProps {
  chains: BlockingChainNode[];
  onSelectSession: (sessionId: number) => void;
  selectedSessionId: number | null;
}

type SessionNodeData = {
  node: BlockingChainNode;
  isHead: boolean;
  isSelected: boolean;
  onSelect: (sessionId: number) => void;
};

function SessionNode({ data }: NodeProps<Node<SessionNodeData>>) {
  const { node, isHead, isSelected, onSelect } = data;

  return (
    <button
      type="button"
      onClick={() => onSelect(node.sessionId)}
      className={`min-w-[220px] rounded-lg border px-3 py-2 text-left shadow-lg transition ${
        isSelected
          ? "border-sky-500 bg-sky-950/60"
          : isHead
            ? "border-red-800 bg-red-950/50"
            : "border-zinc-700 bg-zinc-900"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">SPID {node.sessionId}</span>
        {isHead ? <Badge variant="danger">Head</Badge> : <Badge>{`Nivel ${node.level}`}</Badge>}
      </div>
      <div className="space-y-1 text-xs text-zinc-400">
        <p>{node.loginName}</p>
        <p>{node.programName ?? "Programa desconocido"}</p>
        <p>{node.waitType ?? "Sin wait"}</p>
        <p>{formatDuration(node.waitTimeMs)}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </button>
  );
}

const nodeTypes = {
  sessionNode: SessionNode,
};

function buildGraph(
  chains: BlockingChainNode[],
  selectedSessionId: number | null,
  onSelectSession: (sessionId: number) => void,
) {
  const nodes: Node<SessionNodeData>[] = [];
  const edges: Edge[] = [];
  const chainsByHead = new Map<number, BlockingChainNode[]>();

  for (const chain of chains) {
    const list = chainsByHead.get(chain.headBlocker) ?? [];
    list.push(chain);
    chainsByHead.set(chain.headBlocker, list);
  }

  let column = 0;
  for (const [headBlocker, chainNodes] of chainsByHead) {
    const sorted = [...chainNodes].sort((a, b) => a.level - b.level);
    const levelOffsets = new Map<number, number>();

    for (const node of sorted) {
      const row = levelOffsets.get(node.level) ?? 0;
      levelOffsets.set(node.level, row + 1);

      nodes.push({
        id: `${headBlocker}-${node.sessionId}`,
        type: "sessionNode",
        position: {
          x: column * 320 + node.level * 280,
          y: row * 150,
        },
        data: {
          node,
          isHead: node.level === 0,
          isSelected: selectedSessionId === node.sessionId,
          onSelect: onSelectSession,
        },
      });

      if (node.blockingSessionId && node.blockingSessionId !== 0) {
        edges.push({
          id: `${node.blockingSessionId}-${node.sessionId}`,
          source: `${headBlocker}-${node.blockingSessionId}`,
          target: `${headBlocker}-${node.sessionId}`,
          animated: true,
          style: { stroke: "#ef4444" },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#ef4444",
          },
        });
      }
    }

    column += 1;
  }

  return { nodes, edges };
}

export function BlockingChainGraph({
  chains,
  onSelectSession,
  selectedSessionId,
}: BlockingChainGraphProps) {
  const graph = useMemo(
    () => buildGraph(chains, selectedSessionId, onSelectSession),
    [chains, onSelectSession, selectedSessionId],
  );

  return (
    <Card className="h-full min-h-[420px]">
      <CardHeader>
        <CardTitle>Cadenas de bloqueo</CardTitle>
      </CardHeader>
      <CardContent className="h-[360px]">
        {chains.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No hay cadenas de bloqueo activas
          </div>
        ) : (
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.4}
            maxZoom={1.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#27272a" gap={16} />
            <Controls />
          </ReactFlow>
        )}
      </CardContent>
    </Card>
  );
}
