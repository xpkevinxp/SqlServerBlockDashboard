import fs from "fs";
import path from "path";

const root = path.resolve("src");

const files = {
  "lib/utils.ts": `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return \`\${ms} ms\`;
  if (ms < 60_000) return \`\${(ms / 1000).toFixed(1)} s\`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return \`\${minutes}m \${seconds}s\`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}`,
  "lib/types/blocking.ts": `export interface HealthStatus {
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
`,
  "lib/sql/pool.ts": `import sql from "mssql";

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.SQLSERVER_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "SQLSERVER_CONNECTION_STRING no est뿯½ configurada. Revisa tu archivo .env",
    );
  }
  return connectionString;
}

function getQueryTimeout(): number {
  const timeout = Number(process.env.SQL_QUERY_TIMEOUT_MS ?? "10000");
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 10000;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) {
    return pool;
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      const connectionPool = new sql.ConnectionPool(getConnectionString());
      await connectionPool.connect();
      pool = connectionPool;
      return connectionPool;
    })().catch((error) => {
      poolPromise = null;
      pool = null;
      throw error;
    });
  }

  return poolPromise;
}

export async function query<T extends Record<string, unknown>>(
  sqlText: string,
): Promise<T[]> {
  const connectionPool = await getPool();
  const request = connectionPool.request();
  request.timeout = getQueryTimeout();
  const result = await request.query(sqlText);
  result.recordset ??= [];
  return result.recordset as T[];
}

export async function queryWithInputs<T extends Record<string, unknown>>(
  sqlText: string,
  inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }>,
): Promise<T[]> {
  const connectionPool = await getPool();
  const request = connectionPool.request();
  request.timeout = getQueryTimeout();

  for (const input of inputs) {
    request.input(input.name, input.type, input.value);
  }

  const result = await request.query(sqlText);
  result.recordset ??= [];
  return result.recordset as T[];
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
  }
}
`,
  "lib/sql/queries/health.ts": `import { query } from "../pool";
import type { HealthStatus } from "@/lib/types/blocking";

interface HealthRow {
  server_version: string;
  server_time: Date;
}

interface PermissionRow {
  has_view_server_state: number;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const startedAt = Date.now();

  try {
    const [healthRows, permissionRows] = await Promise.all([
      query<HealthRow>(\`
        SELECT
          @@VERSION AS server_version,
          GETDATE() AS server_time;
      \`),
      query<PermissionRow>(\`
        SELECT HAS_PERMS_BY_NAME(NULL, 'SERVER', 'VIEW SERVER STATE') AS has_view_server_state;
      \`),
    ]);

    const health = healthRows[0];
    const permission = permissionRows[0];

    return {
      connected: true,
      serverVersion: health?.server_version ?? null,
      serverTime: health?.server_time
        ? new Date(health.server_time).toISOString()
        : null,
      latencyMs: Date.now() - startedAt,
      hasViewServerState: Boolean(permission?.has_view_server_state),
    };
  } catch (error) {
    return {
      connected: false,
      serverVersion: null,
      serverTime: null,
      latencyMs: Date.now() - startedAt,
      hasViewServerState: false,
      error: error instanceof Error ? error.message : "Error de conexi뿯½n",
    };
  }
}
`,
  "lib/sql/queries/blocking-snapshot.ts": `import { query } from "../pool";
import type { BlockedSession } from "@/lib/types/blocking";

interface BlockedSessionRow {
  session_id: number;
  blocking_session_id: number;
  wait_type: string | null;
  wait_time: number;
  wait_resource: string | null;
  status: string;
  command: string | null;
  login_name: string;
  host_name: string | null;
  program_name: string | null;
  query_text: string | null;
  start_time: Date | null;
}

export async function getBlockedSessions(): Promise<BlockedSession[]> {
  const rows = await query<BlockedSessionRow>(\`
    SELECT
      r.session_id,
      r.blocking_session_id,
      r.wait_type,
      r.wait_time,
      r.wait_resource,
      r.status,
      r.command,
      s.login_name,
      s.host_name,
      s.program_name,
      blocked_sql.text AS query_text,
      r.start_time
    FROM sys.dm_exec_requests AS r
    INNER JOIN sys.dm_exec_sessions AS s
      ON s.session_id = r.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) AS blocked_sql
    WHERE r.blocking_session_id <> 0
      AND s.is_user_process = 1;
  \`);

  return rows.map((row) => ({
    sessionId: row.session_id,
    blockingSessionId: row.blocking_session_id,
    waitType: row.wait_type,
    waitTimeMs: row.wait_time,
    waitResource: row.wait_resource,
    status: row.status,
    command: row.command,
    loginName: row.login_name,
    hostName: row.host_name,
    programName: row.program_name,
    queryText: row.query_text,
    startTime: row.start_time ? new Date(row.start_time).toISOString() : null,
  }));
}
`,
  "lib/sql/queries/blocking-chain.ts": `import { query } from "../pool";
import type { BlockingChainNode } from "@/lib/types/blocking";

interface BlockingChainRow {
  head_blocker: number;
  session_id: number;
  blocking_session_id: number | null;
  level: number;
  wait_type: string | null;
  wait_time: number;
  wait_resource: string | null;
  session_status: string;
  login_name: string;
  host_name: string | null;
  program_name: string | null;
  open_transaction_count: number;
  query_text: string | null;
}

export async function getBlockingChains(): Promise<BlockingChainNode[]> {
  const rows = await query<BlockingChainRow>(\`
    ;WITH cteHead AS (
      SELECT
        s.session_id,
        r.request_id,
        r.wait_type,
        r.wait_resource,
        r.wait_time,
        r.blocking_session_id,
        r.sql_handle,
        c.most_recent_sql_handle,
        s.status AS session_status,
        s.login_name,
        s.host_name,
        s.program_name,
        s.open_transaction_count
      FROM sys.dm_exec_sessions AS s
      LEFT JOIN sys.dm_exec_requests AS r
        ON r.session_id = s.session_id
      LEFT JOIN sys.dm_exec_connections AS c
        ON c.session_id = s.session_id
      WHERE s.is_user_process = 1
    ),
    cteChain AS (
      SELECT
        h.session_id AS head_blocker,
        h.session_id,
        h.blocking_session_id,
        h.wait_type,
        h.wait_time,
        h.wait_resource,
        h.session_status,
        h.login_name,
        h.host_name,
        h.program_name,
        h.open_transaction_count,
        h.sql_handle,
        h.most_recent_sql_handle,
        0 AS [level]
      FROM cteHead AS h
      WHERE (h.blocking_session_id IS NULL OR h.blocking_session_id = 0)
        AND h.session_id IN (
          SELECT DISTINCT blocking_session_id
          FROM cteHead
          WHERE blocking_session_id <> 0
        )
      UNION ALL
      SELECT
        c.head_blocker,
        b.session_id,
        b.blocking_session_id,
        b.wait_type,
        b.wait_time,
        b.wait_resource,
        b.session_status,
        b.login_name,
        b.host_name,
        b.program_name,
        b.open_transaction_count,
        b.sql_handle,
        b.most_recent_sql_handle,
        c.[level] + 1
      FROM cteHead AS b
      INNER JOIN cteChain AS c
        ON c.session_id = b.blocking_session_id
      WHERE b.session_id <> c.session_id
    )
    SELECT
      c.head_blocker,
      c.session_id,
      c.blocking_session_id,
      c.[level],
      c.wait_type,
      c.wait_time,
      c.wait_resource,
      c.session_status,
      c.login_name,
      c.host_name,
      c.program_name,
      c.open_transaction_count,
      COALESCE(active_sql.text, recent_sql.text, input_buffer.event_info) AS query_text
    FROM cteChain AS c
    OUTER APPLY sys.dm_exec_sql_text(c.sql_handle) AS active_sql
    OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) AS recent_sql
    OUTER APPLY sys.dm_exec_input_buffer(c.session_id, NULL) AS input_buffer
    ORDER BY c.head_blocker, c.[level], c.session_id;
  \`);

  return rows.map((row) => ({
    headBlocker: row.head_blocker,
    sessionId: row.session_id,
    blockingSessionId: row.blocking_session_id,
    level: row.level,
    waitType: row.wait_type,
    waitTimeMs: row.wait_time,
    waitResource: row.wait_resource,
    sessionStatus: row.session_status,
    loginName: row.login_name,
    hostName: row.host_name,
    programName: row.program_name,
    openTransactionCount: row.open_transaction_count,
    queryText: row.query_text,
  }));
}
`,
  "lib/sql/queries/active-sessions.ts": `import { query } from "../pool";
import type { ActiveSession } from "@/lib/types/blocking";

interface ActiveSessionRow {
  session_id: number;
  status: string;
  login_name: string;
  host_name: string | null;
  program_name: string | null;
  client_interface_name: string | null;
  blocking_session_id: number | null;
  wait_type: string | null;
  wait_time: number;
  wait_resource: string | null;
  open_transaction_count: number;
  cpu_time: number;
  memory_usage: number;
  last_request_start_time: Date | null;
  command: string | null;
  query_text: string | null;
  is_blocked: number;
  is_blocker: number;
}

export async function getActiveSessions(): Promise<ActiveSession[]> {
  const rows = await query<ActiveSessionRow>(\`
    SELECT
      s.session_id,
      s.status,
      s.login_name,
      s.host_name,
      s.program_name,
      s.client_interface_name,
      r.blocking_session_id,
      r.wait_type,
      ISNULL(r.wait_time, 0) AS wait_time,
      r.wait_resource,
      s.open_transaction_count,
      s.cpu_time,
      s.memory_usage,
      s.last_request_start_time,
      r.command,
      COALESCE(active_sql.text, recent_sql.text, input_buffer.event_info) AS query_text,
      CASE WHEN ISNULL(r.blocking_session_id, 0) <> 0 THEN 1 ELSE 0 END AS is_blocked,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM sys.dm_exec_requests AS blocked
          WHERE blocked.blocking_session_id = s.session_id
        ) THEN 1
        ELSE 0
      END AS is_blocker
    FROM sys.dm_exec_sessions AS s
    LEFT JOIN sys.dm_exec_requests AS r
      ON r.session_id = s.session_id
    LEFT JOIN sys.dm_exec_connections AS c
      ON c.session_id = s.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) AS active_sql
    OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) AS recent_sql
    OUTER APPLY sys.dm_exec_input_buffer(s.session_id, NULL) AS input_buffer
    WHERE s.is_user_process = 1
    ORDER BY
      CASE WHEN ISNULL(r.blocking_session_id, 0) <> 0 THEN 0 ELSE 1 END,
      r.wait_time DESC,
      s.session_id;
  \`);

  return rows.map((row) => ({
    sessionId: row.session_id,
    status: row.status,
    loginName: row.login_name,
    hostName: row.host_name,
    programName: row.program_name,
    clientInterfaceName: row.client_interface_name,
    blockingSessionId: row.blocking_session_id,
    waitType: row.wait_type,
    waitTimeMs: row.wait_time,
    waitResource: row.wait_resource,
    openTransactionCount: row.open_transaction_count,
    cpuTimeMs: row.cpu_time,
    memoryUsagePages: row.memory_usage,
    lastRequestStartTime: row.last_request_start_time
      ? new Date(row.last_request_start_time).toISOString()
      : null,
    command: row.command,
    queryText: row.query_text,
    isBlocked: Boolean(row.is_blocked),
    isBlocker: Boolean(row.is_blocker),
  }));
}
`,
  "lib/sql/queries/lock-details.ts": `import sql from "mssql";
import { query, queryWithInputs } from "../pool";
import type { LockDetail, SessionDetail } from "@/lib/types/blocking";

interface SessionDetailRow {
  session_id: number;
  status: string;
  login_name: string;
  host_name: string | null;
  program_name: string | null;
  client_net_address: string | null;
  blocking_session_id: number | null;
  wait_type: string | null;
  wait_time: number;
  wait_resource: string | null;
  open_transaction_count: number;
  cpu_time: number;
  memory_usage: number;
  last_request_start_time: Date | null;
  query_text: string | null;
}

interface LockDetailRow {
  session_id: number;
  blocking_session_id: number | null;
  wait_duration_ms: number;
  wait_type: string | null;
  resource_description: string | null;
  resource_type: string | null;
  request_mode: string | null;
  request_status: string | null;
  database_name: string | null;
}

export async function getSessionDetail(
  sessionId: number,
): Promise<SessionDetail | null> {
  const sessionRows = await queryWithInputs<SessionDetailRow>(
    \`
    SELECT
      s.session_id,
      s.status,
      s.login_name,
      s.host_name,
      s.program_name,
      c.client_net_address,
      r.blocking_session_id,
      r.wait_type,
      ISNULL(r.wait_time, 0) AS wait_time,
      r.wait_resource,
      s.open_transaction_count,
      s.cpu_time,
      s.memory_usage,
      s.last_request_start_time,
      COALESCE(active_sql.text, recent_sql.text, input_buffer.event_info) AS query_text
    FROM sys.dm_exec_sessions AS s
    LEFT JOIN sys.dm_exec_requests AS r
      ON r.session_id = s.session_id
    LEFT JOIN sys.dm_exec_connections AS c
      ON c.session_id = s.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) AS active_sql
    OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) AS recent_sql
    OUTER APPLY sys.dm_exec_input_buffer(s.session_id, NULL) AS input_buffer
    WHERE s.session_id = @sessionId
      AND s.is_user_process = 1;
  \`,
    [{ name: "sessionId", type: sql.Int, value: sessionId }],
  );

  const session = sessionRows[0];
  if (!session) {
    return null;
  }

  const lockRows = await queryWithInputs<LockDetailRow>(
    \`
    SELECT
      wt.session_id,
      wt.blocking_session_id,
      wt.wait_duration_ms,
      wt.wait_type,
      wt.resource_description,
      tl.resource_type,
      tl.request_mode,
      tl.request_status,
      DB_NAME(tl.resource_database_id) AS database_name
    FROM sys.dm_tran_locks AS tl
    INNER JOIN sys.dm_os_waiting_tasks AS wt
      ON tl.lock_owner_address = wt.resource_address
    WHERE wt.session_id = @sessionId
       OR wt.blocking_session_id = @sessionId
    UNION ALL
    SELECT
      tl.request_session_id AS session_id,
      NULL AS blocking_session_id,
      0 AS wait_duration_ms,
      NULL AS wait_type,
      NULL AS resource_description,
      tl.resource_type,
      tl.request_mode,
      tl.request_status,
      DB_NAME(tl.resource_database_id) AS database_name
    FROM sys.dm_tran_locks AS tl
    WHERE tl.request_session_id = @sessionId
      AND tl.request_status = 'GRANT';
  \`,
    [{ name: "sessionId", type: sql.Int, value: sessionId }],
  );

  return {
    sessionId: session.session_id,
    status: session.status,
    loginName: session.login_name,
    hostName: session.host_name,
    programName: session.program_name,
    clientNetAddress: session.client_net_address,
    blockingSessionId: session.blocking_session_id,
    waitType: session.wait_type,
    waitTimeMs: session.wait_time,
    waitResource: session.wait_resource,
    openTransactionCount: session.open_transaction_count,
    cpuTimeMs: session.cpu_time,
    memoryUsagePages: session.memory_usage,
    lastRequestStartTime: session.last_request_start_time
      ? new Date(session.last_request_start_time).toISOString()
      : null,
    queryText: session.query_text,
    locks: lockRows.map((row) => ({
      sessionId: row.session_id,
      blockingSessionId: row.blocking_session_id,
      waitDurationMs: row.wait_duration_ms,
      waitType: row.wait_type,
      resourceDescription: row.resource_description,
      resourceType: row.resource_type,
      requestMode: row.request_mode,
      requestStatus: row.request_status,
      databaseName: row.database_name,
    })),
  };
}

export async function getLockDetailsForBlockedSessions(): Promise<LockDetail[]> {
  const rows = await query<LockDetailRow>(\`
    SELECT
      wt.session_id,
      wt.blocking_session_id,
      wt.wait_duration_ms,
      wt.wait_type,
      wt.resource_description,
      tl.resource_type,
      tl.request_mode,
      tl.request_status,
      DB_NAME(tl.resource_database_id) AS database_name
    FROM sys.dm_tran_locks AS tl
    INNER JOIN sys.dm_os_waiting_tasks AS wt
      ON tl.lock_owner_address = wt.resource_address
    WHERE tl.request_status = 'WAIT';
  \`);

  return rows.map((row) => ({
    sessionId: row.session_id,
    blockingSessionId: row.blocking_session_id,
    waitDurationMs: row.wait_duration_ms,
    waitType: row.wait_type,
    resourceDescription: row.resource_description,
    resourceType: row.resource_type,
    requestMode: row.request_mode,
    requestStatus: row.request_status,
    databaseName: row.database_name,
  }));
}
`,
  "lib/sql/queries/index.ts": `import { getBlockedSessions } from "./blocking-snapshot";
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
    const key = \`\${session.programName ?? "unknown"}|\${session.loginName}\`;
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
    const key = \`\${node.programName ?? "unknown"}|\${node.loginName}\`;
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
`,
  "app/api/health/route.ts": `import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/sql/queries/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getHealthStatus();
    const statusCode = health.connected ? 200 : 503;
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        serverVersion: null,
        serverTime: null,
        latencyMs: 0,
        hasViewServerState: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 },
    );
  }
}
`,
  "app/api/blocking/route.ts": `import { NextResponse } from "next/server";
import { getBlockingSnapshot } from "@/lib/sql/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getBlockingSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo obtener bloqueos",
      },
      { status: 500 },
    );
  }
}
`,
  "app/api/sessions/route.ts": `import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/sql/queries/active-sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await getActiveSessions();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      sessions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron obtener sesiones",
      },
      { status: 500 },
    );
  }
}
`,
  "app/api/sessions/[spid]/route.ts": `import { NextResponse } from "next/server";
import { getSessionDetail } from "@/lib/sql/queries/lock-details";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ spid: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { spid } = await context.params;
  const sessionId = Number(spid);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json(
      { error: "SPID inv뿯½lido" },
      { status: 400 },
    );
  }

  try {
    const session = await getSessionDetail(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Sesi뿯½n no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo obtener el detalle",
      },
      { status: 500 },
    );
  }
}
`,
  "components/providers/query-provider.tsx": `"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
`,
  "hooks/useHealthStatus.ts": `"use client";

import { useQuery } from "@tanstack/react-query";
import type { HealthStatus } from "@/lib/types/blocking";

async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health");
  const data = (await response.json()) as HealthStatus;
  return data;
}

export function useHealthStatus(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
  });
}
`,
  "hooks/useBlockingData.ts": `"use client";

import { useQuery } from "@tanstack/react-query";
import type { BlockingSnapshot } from "@/lib/types/blocking";

async function fetchBlockingSnapshot(): Promise<BlockingSnapshot> {
  const response = await fetch("/api/blocking");
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Error al obtener bloqueos");
  }
  return response.json() as Promise<BlockingSnapshot>;
}

export function useBlockingData(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["blocking"],
    queryFn: fetchBlockingSnapshot,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
  });
}
`,
  "hooks/useSessionsData.ts": `"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActiveSession } from "@/lib/types/blocking";

interface SessionsResponse {
  timestamp: string;
  sessions: ActiveSession[];
}

async function fetchSessions(): Promise<SessionsResponse> {
  const response = await fetch("/api/sessions");
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Error al obtener sesiones");
  }
  return response.json() as Promise<SessionsResponse>;
}

export function useSessionsData(enabled = true, intervalMs = 5000) {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    enabled,
    refetchInterval: enabled ? intervalMs : false,
  });
}
`,
  "hooks/useSessionDetail.ts": `"use client";

import { useQuery } from "@tanstack/react-query";
import type { SessionDetail } from "@/lib/types/blocking";

async function fetchSessionDetail(spid: number): Promise<SessionDetail> {
  const response = await fetch(\`/api/sessions/\${spid}\`);
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
  });
}
`,
  "components/ui/button.tsx": `import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-sky-600 text-white hover:bg-sky-500",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
        outline: "border border-zinc-700 bg-transparent hover:bg-zinc-900",
        ghost: "hover:bg-zinc-900",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
`,
  "components/ui/card.tsx": `import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-100 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-zinc-400", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
`,
  "components/ui/badge.tsx": `import { cn } from "@/lib/utils";

const variants = {
  default: "border-zinc-700 bg-zinc-900 text-zinc-200",
  danger: "border-red-900/60 bg-red-950/60 text-red-200",
  warning: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  success: "border-emerald-900/60 bg-emerald-950/60 text-emerald-200",
  info: "border-sky-900/60 bg-sky-950/60 text-sky-200",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
`,
  "components/ui/input.tsx": `import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type = "text",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        className,
      )}
      {...props}
    />
  );
}
`,
  "components/ui/switch.tsx": `import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 data-[state=checked]:bg-sky-600",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitives.Root>
  );
}
`,
  "components/ui/tabs.tsx": `import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content className={cn("mt-3", className)} {...props} />
  );
}
`,
  "components/ui/scroll-area.tsx": `import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex touch-none select-none p-0.5 transition-colors"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-zinc-700" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  );
}
`,
  "components/ui/separator.tsx": `import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        "shrink-0 bg-zinc-800",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
`,
  "components/ui/sheet.tsx": `import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 p-6 shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-zinc-400 hover:text-zinc-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold text-zinc-100", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-zinc-400", className)}
      {...props}
    />
  );
}
`,
  "components/dashboard/KpiCards.tsx": `"use client";

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
    label: "Wait time m뿯½ximo",
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
              <Icon className={\`h-4 w-4 \${item.accent}\`} />
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
`,
  "components/dashboard/ConnectionStatus.tsx": `"use client";

import { Badge } from "@/components/ui/badge";
import type { HealthStatus } from "@/lib/types/blocking";
import { formatDuration } from "@/lib/utils";

interface ConnectionStatusProps {
  health?: HealthStatus;
  isLoading?: boolean;
}

export function ConnectionStatus({ health, isLoading }: ConnectionStatusProps) {
  if (isLoading) {
    return <Badge variant="warning">Verificando conexi뿯½n...</Badge>;
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
`,
  "components/dashboard/WaitTypesChart.tsx": `"use client";

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
  const chartData = data.slice(0, 8).map((item) => ({
    name: item.waitType.replace("LCK_M_", ""),
    count: item.count,
    totalWaitMs: item.totalWaitMs,
  }));

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
`,
  "components/dashboard/BlockingChainGraph.tsx": `"use client";

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
      className={\`min-w-[220px] rounded-lg border px-3 py-2 text-left shadow-lg transition \${
        isSelected
          ? "border-sky-500 bg-sky-950/60"
          : isHead
            ? "border-red-800 bg-red-950/50"
            : "border-zinc-700 bg-zinc-900"
      }\`}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">SPID {node.sessionId}</span>
        {isHead ? <Badge variant="danger">Head</Badge> : <Badge>{\`Nivel \${node.level}\`}</Badge>}
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
        id: \`\${headBlocker}-\${node.sessionId}\`,
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
          id: \`\${node.blockingSessionId}-\${node.sessionId}\`,
          source: \`\${headBlocker}-\${node.blockingSessionId}\`,
          target: \`\${headBlocker}-\${node.sessionId}\`,
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
`,
  "components/dashboard/SessionsTable.tsx": `"use client";

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

  const filteredSessions = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();

    return sessions.filter((session) => {
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
  }, [filter, sessions, tab]);

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
                    <th className="px-3 py-2">Duraci뿯½n</th>
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
        {filteredSessions.length} sesiones visibles de {sessions.length}
      </CardContent>
    </Card>
  );
}
`,
  "components/dashboard/SessionDetailSheet.tsx": `"use client";

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
            {sessionId ? \`Detalle SPID \${sessionId}\` : "Detalle de sesi뿯½n"}
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
                      key={\`\${lock.resourceType}-\${lock.requestMode}-\${index}\`}
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
`,
  "components/dashboard/DashboardPage.tsx": `"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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

export function DashboardPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pollInterval, setPollInterval] = useState(5000);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const healthQuery = useHealthStatus(autoRefresh, pollInterval);
  const blockingQuery = useBlockingData(autoRefresh, pollInterval);
  const sessionsQuery = useSessionsData(autoRefresh, pollInterval);

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

  const handleSelectSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setDetailOpen(true);
  };

  const handleRefresh = () => {
    void healthQuery.refetch();
    void blockingQuery.refetch();
    void sessionsQuery.refetch();
  };

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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        {errorMessage ? (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Badge variant="info">
            {lastUpdated ? \`뿯½ltima actualizaci뿯½n: \${lastUpdated}\` : "Sin datos"}
          </Badge>
          {blockingQuery.isFetching || sessionsQuery.isFetching ? (
            <Badge variant="warning">Actualizando...</Badge>
          ) : null}
        </div>

        <KpiCards
          kpis={
            snapshot?.kpis ?? {
              blockedSessions: 0,
              activeChains: 0,
              maxWaitTimeMs: 0,
              headBlockers: 0,
            }
          }
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
`,
  "app/layout.tsx": `import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SQL Server Block Monitor",
  description: "Dashboard profesional para monitorear bloqueos en SQL Server 2019",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={\`\${geistSans.variable} \${geistMono.variable} dark h-full antialiased\`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
`,
  "app/page.tsx": `import { DashboardPage } from "@/components/dashboard/DashboardPage";

export default function Home() {
  return <DashboardPage />;
}
`,
  "app/globals.css": `@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #f4f4f5;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

.react-flow__controls-button {
  background: #18181b !important;
  border-bottom: 1px solid #27272a !important;
  color: #e4e4e7 !important;
}

.react-flow__controls-button:hover {
  background: #27272a !important;
}
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

console.log("restored", Object.keys(files).length, "files");
