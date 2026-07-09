import sql from "mssql";

let pool: sql.ConnectionPool | null = null;
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.SQLSERVER_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "SQLSERVER_CONNECTION_STRING no esta configurada. Revisa tu archivo .env",
    );
  }
  return connectionString;
}

function createPool(): sql.ConnectionPool {
  const basePool = new sql.ConnectionPool(getConnectionString());
  const baseConfig = (basePool as unknown as { config: sql.config }).config;

  const config: sql.config = {
    ...baseConfig,
    options: {
      ...baseConfig.options,
      encrypt: true,
      trustServerCertificate: true,
    },
  };

  return new sql.ConnectionPool(config);
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) {
    return pool;
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      const connectionPool = createPool();
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

export async function query<T>(sqlText: string): Promise<T[]> {
  const connectionPool = await getPool();
  const result = await connectionPool.request().query(sqlText);
  return (result.recordset ?? []) as T[];
}

export async function queryWithInputs<T>(
  sqlText: string,
  inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }>,
): Promise<T[]> {
  const connectionPool = await getPool();
  const request = connectionPool.request();

  for (const input of inputs) {
    request.input(input.name, input.type, input.value);
  }

  const result = await request.query(sqlText);
  return (result.recordset ?? []) as T[];
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    poolPromise = null;
  }
}