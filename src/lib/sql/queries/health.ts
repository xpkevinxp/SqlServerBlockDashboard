import { query } from "../pool";
import type { HealthStatus } from "@/lib/types/blocking";

interface HealthRow {
  server_version: string;
  server_time: Date;
}

interface PermissionRow {
  has_view_server_state: number | null;
  has_view_server_state_grant: number;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const startedAt = Date.now();

  try {
    const [healthRows, permissionRows] = await Promise.all([
      query<HealthRow>(`
        SELECT
          @@VERSION AS server_version,
          GETDATE() AS server_time;
      `),
      query<PermissionRow>(`
        SELECT
          HAS_PERMS_BY_NAME(NULL, 'SERVER', 'VIEW SERVER STATE') AS has_view_server_state,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM sys.server_permissions AS perm
              INNER JOIN sys.server_principals AS sp
                ON sp.principal_id = perm.grantee_principal_id
              WHERE sp.name IN (SUSER_SNAME(), ORIGINAL_LOGIN(), SYSTEM_USER)
                AND perm.permission_name = 'VIEW SERVER STATE'
                AND perm.state IN ('G', 'W')
            ) THEN 1
            ELSE 0
          END AS has_view_server_state_grant;
      `),
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
      hasViewServerState: Boolean(
        permission?.has_view_server_state || permission?.has_view_server_state_grant,
      ),
    };
  } catch (error) {
    return {
      connected: false,
      serverVersion: null,
      serverTime: null,
      latencyMs: Date.now() - startedAt,
      hasViewServerState: false,
      error: error instanceof Error ? error.message : "Error de conexion",
    };
  }
}
