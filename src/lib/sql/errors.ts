export function formatSqlError(error: unknown): { message: string; status: number } {
  const raw = error instanceof Error ? error.message : "Error desconocido";

  if (
    raw.includes("does not have permission") ||
    raw.includes("VIEW SERVER STATE") ||
    raw.includes("permission was denied")
  ) {
    return {
      message:
        "El usuario SQL no tiene permisos suficientes. Un DBA debe ejecutar: GRANT VIEW SERVER STATE TO [kipuprod];",
      status: 403,
    };
  }

  return { message: raw, status: 500 };
}