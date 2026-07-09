import { query } from "../pool";
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
  const rows = await query<ActiveSessionRow>(`
    ;WITH blocker_sessions AS (
      SELECT DISTINCT blocking_session_id
      FROM sys.dm_exec_requests
      WHERE blocking_session_id <> 0
    )
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
      CAST(NULL AS nvarchar(max)) AS query_text,
      CASE WHEN ISNULL(r.blocking_session_id, 0) <> 0 THEN 1 ELSE 0 END AS is_blocked,
      CASE WHEN bs.blocking_session_id IS NULL THEN 0 ELSE 1 END AS is_blocker
    FROM sys.dm_exec_sessions AS s
    LEFT JOIN blocker_sessions AS bs
      ON bs.blocking_session_id = s.session_id
    OUTER APPLY (
      SELECT TOP 1
        req.blocking_session_id,
        req.wait_type,
        req.wait_time,
        req.wait_resource,
        req.command
      FROM sys.dm_exec_requests AS req
      WHERE req.session_id = s.session_id
      ORDER BY
        CASE WHEN ISNULL(req.blocking_session_id, 0) <> 0 THEN 0 ELSE 1 END,
        req.wait_time DESC
    ) AS r
    WHERE s.is_user_process = 1
    ORDER BY
      CASE WHEN ISNULL(r.blocking_session_id, 0) <> 0 THEN 0 ELSE 1 END,
      r.wait_time DESC,
      s.session_id;
  `);

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