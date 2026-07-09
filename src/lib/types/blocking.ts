export interface HealthStatus {
  connected: boolean;
  serverVersion: string | null;
  serverTime: string | null;
  latencyMs: number;
  hasViewServerState: boolean;
  error?: string;
}

export interface BlockedSession {
  sessionId: number;
  blockingSessionId: number;
  waitType: string | null;
  waitTimeMs: number;
  waitResource: string | null;
  status: string;
  command: string | null;
  loginName: string;
  hostName: string | null;
  programName: string | null;
  queryText: string | null;
  startTime: string | null;
}

export interface BlockingChainNode {
  headBlocker: number;
  sessionId: number;
  blockingSessionId: number | null;
  level: number;
  waitType: string | null;
  waitTimeMs: number;
  waitResource: string | null;
  sessionStatus: string;
  loginName: string;
  hostName: string | null;
  programName: string | null;
  openTransactionCount: number;
  queryText: string | null;
}

export interface ActiveSession {
  sessionId: number;
  status: string;
  loginName: string;
  hostName: string | null;
  programName: string | null;
  clientInterfaceName: string | null;
  blockingSessionId: number | null;
  waitType: string | null;
  waitTimeMs: number;
  waitResource: string | null;
  openTransactionCount: number;
  cpuTimeMs: number;
  memoryUsagePages: number;
  lastRequestStartTime: string | null;
  command: string | null;
  queryText: string | null;
  isBlocked: boolean;
  isBlocker: boolean;
}

export interface LockDetail {
  sessionId: number;
  blockingSessionId: number | null;
  waitDurationMs: number;
  waitType: string | null;
  resourceDescription: string | null;
  resourceType: string | null;
  requestMode: string | null;
  requestStatus: string | null;
  databaseName: string | null;
}

export interface SessionDetail {
  sessionId: number;
  status: string;
  loginName: string;
  hostName: string | null;
  programName: string | null;
  clientNetAddress: string | null;
  blockingSessionId: number | null;
  waitType: string | null;
  waitTimeMs: number;
  waitResource: string | null;
  openTransactionCount: number;
  cpuTimeMs: number;
  memoryUsagePages: number;
  lastRequestStartTime: string | null;
  queryText: string | null;
  locks: LockDetail[];
}

export interface BlockingKpis {
  blockedSessions: number;
  activeChains: number;
  maxWaitTimeMs: number;
  headBlockers: number;
}

export interface WaitTypeAggregate {
  waitType: string;
  count: number;
  totalWaitMs: number;
}

export interface ProgramAggregate {
  programName: string;
  loginName: string;
  blockedCount: number;
  blockingCount: number;
}

export interface BlockingSnapshot {
  timestamp: string;
  kpis: BlockingKpis;
  blockedSessions: BlockedSession[];
  chains: BlockingChainNode[];
  waitTypeAggregates: WaitTypeAggregate[];
  programAggregates: ProgramAggregate[];
}
