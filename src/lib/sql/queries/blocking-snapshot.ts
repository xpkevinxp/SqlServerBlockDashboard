import { query } from "../pool";
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
  const rows = await query<BlockedSessionRow>(`
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
      CAST(NULL AS nvarchar(max)) AS query_text,
      r.start_time
    FROM sys.dm_exec_requests AS r
    INNER JOIN sys.dm_exec_sessions AS s
      ON s.session_id = r.session_id
    WHERE r.blocking_session_id <> 0
      AND s.is_user_process = 1;
  `);

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
