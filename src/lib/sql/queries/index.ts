import { getBlockedSessions } from "./blocking-snapshot";
import { getBlockingChains } from "./blocking-chain";
import type {
  BlockingKpis,
  BlockingSnapshot,
  ProgramAggregate,
  WaitTypeAggregate,
} from "@/lib/types/blocking";

function buildKpis(
  blockedCount: number,
  chains: Awaited<ReturnType<typeof getBlockingChains>>,
): BlockingKpis {
  const headBlockers = new Set(chains.map((node) => node.headBlocker));
  const maxWaitTimeMs = chains.reduce(
    (max, node) => Math.max(max, node.waitTimeMs),
    0,
  );

  return {
    blockedSessions: blockedCount,
    activeChains: headBlockers.size,
    maxWaitTimeMs,
    headBlockers: headBlockers.size,
  };
}

function buildWaitTypeAggregates(
  blockedSessions: Awaited<ReturnType<typeof getBlockedSessions>>,
): WaitTypeAggregate[] {
  const map = new Map<string, WaitTypeAggregate>();

  for (const session of blockedSessions) {
    const waitType = session.waitType ?? "UNKNOWN";
    const current = map.get(waitType) ?? {
      waitType,
      count: 0,
      totalWaitMs: 0,
    };
    current.count += 1;
    current.totalWaitMs += session.waitTimeMs;
    map.set(waitType, current);
  }

  return Array.from(map.values()).sort((a, b) => b.totalWaitMs - a.totalWaitMs);
}

function buildProgramAggregates(
  blockedSessions: Awaited<ReturnType<typeof getBlockedSessions>>,
  chains: Awaited<ReturnType<typeof getBlockingChains>>,
): ProgramAggregate[] {
  const map = new Map<string, ProgramAggregate>();

  for (const session of blockedSessions) {
    const key = `${session.programName ?? "unknown"}|${session.loginName}`;
    const current = map.get(key) ?? {
      programName: session.programName ?? "Desconocido",
      loginName: session.loginName,
      blockedCount: 0,
      blockingCount: 0,
    };
    current.blockedCount += 1;
    map.set(key, current);
  }

  for (const node of chains.filter((item) => item.level === 0)) {
    const key = `${node.programName ?? "unknown"}|${node.loginName}`;
    const current = map.get(key) ?? {
      programName: node.programName ?? "Desconocido",
      loginName: node.loginName,
      blockedCount: 0,
      blockingCount: 0,
    };
    current.blockingCount += 1;
    map.set(key, current);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.blockedCount + b.blockingCount - (a.blockedCount + a.blockingCount),
  );
}

export async function getBlockingSnapshot(): Promise<BlockingSnapshot> {
  const [blockedSessions, chains] = await Promise.all([
    getBlockedSessions(),
    getBlockingChains(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    kpis: buildKpis(blockedSessions.length, chains),
    blockedSessions,
    chains,
    waitTypeAggregates: buildWaitTypeAggregates(blockedSessions),
    programAggregates: buildProgramAggregates(blockedSessions, chains),
  };
}
