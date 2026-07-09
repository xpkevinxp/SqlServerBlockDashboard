import sql from "mssql";
import { query, queryWithInputs } from "../pool";
import type { LockDetail, SessionDetail } from "@/lib/types/blocking";
import { QUERY_TEXT_SQL } from "./sql-fragments";

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
    `
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
      ${QUERY_TEXT_SQL} AS query_text
    FROM sys.dm_exec_sessions AS s
    OUTER APPLY (
      SELECT TOP 1
        req.blocking_session_id,
        req.wait_type,
        req.wait_time,
        req.wait_resource,
        req.sql_handle
      FROM sys.dm_exec_requests AS req
      WHERE req.session_id = s.session_id
      ORDER BY
        CASE WHEN ISNULL(req.blocking_session_id, 0) <> 0 THEN 0 ELSE 1 END,
        req.wait_time DESC
    ) AS r
    LEFT JOIN sys.dm_exec_connections AS c
      ON c.session_id = s.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) AS active_sql
    OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) AS recent_sql
    WHERE s.session_id = @sessionId
      AND s.is_user_process = 1;
  `,
    [{ name: "sessionId", type: sql.Int, value: sessionId }],
  );

  const session = sessionRows[0];
  if (!session) {
    return null;
  }

  const lockRows = await queryWithInputs<LockDetailRow>(
    `
    SELECT
      wt.session_id,
      wt.blocking_session_id,
      wt.wait_duration_ms,
      wt.wait_type COLLATE DATABASE_DEFAULT AS wait_type,
      wt.resource_description COLLATE DATABASE_DEFAULT AS resource_description,
      tl.resource_type COLLATE DATABASE_DEFAULT AS resource_type,
      tl.request_mode COLLATE DATABASE_DEFAULT AS request_mode,
      tl.request_status COLLATE DATABASE_DEFAULT AS request_status,
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
      CAST(NULL AS nvarchar(128)) COLLATE DATABASE_DEFAULT AS wait_type,
      CAST(NULL AS nvarchar(256)) COLLATE DATABASE_DEFAULT AS resource_description,
      tl.resource_type COLLATE DATABASE_DEFAULT AS resource_type,
      tl.request_mode COLLATE DATABASE_DEFAULT AS request_mode,
      tl.request_status COLLATE DATABASE_DEFAULT AS request_status,
      DB_NAME(tl.resource_database_id) AS database_name
    FROM sys.dm_tran_locks AS tl
    WHERE tl.request_session_id = @sessionId
      AND tl.request_status = 'GRANT';
  `,
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
  const rows = await query<LockDetailRow>(`
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
  `);

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
