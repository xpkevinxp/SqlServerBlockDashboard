export const QUERY_TEXT_SQL = `COALESCE(
  active_sql.text COLLATE DATABASE_DEFAULT,
  recent_sql.text COLLATE DATABASE_DEFAULT
)`;