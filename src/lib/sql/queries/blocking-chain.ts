import { query } from "../pool";
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
  const rows = await query<BlockingChainRow>(`
    ;WITH cteHead AS (
      SELECT
        s.session_id,
        r.wait_type,
        r.wait_resource,
        r.wait_time,
        r.blocking_session_id,
        s.status AS session_status,
        s.login_name,
        s.host_name,
        s.program_name,
        s.open_transaction_count
      FROM sys.dm_exec_sessions AS s
      OUTER APPLY (
        SELECT TOP 1
          req.wait_type,
          req.wait_resource,
          req.wait_time,
          req.blocking_session_id
        FROM sys.dm_exec_requests AS req
        WHERE req.session_id = s.session_id
        ORDER BY
          CASE WHEN ISNULL(req.blocking_session_id, 0) <> 0 THEN 0 ELSE 1 END,
          req.wait_time DESC
      ) AS r
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
        c.[level] + 1
      FROM cteHead AS b
      INNER JOIN cteChain AS c
        ON c.session_id = b.blocking_session_id
      WHERE b.session_id <> c.session_id
        AND c.[level] < 32
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
      CAST(NULL AS nvarchar(max)) AS query_text
    FROM cteChain AS c
    ORDER BY c.head_blocker, c.[level], c.session_id;
  `);

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
