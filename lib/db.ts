import { neon } from '@neondatabase/serverless';

const rawSql = neon(process.env.DATABASE_URL!);

// Defensive wrapper around @neondatabase/serverless@1.x.
//
// Why: the Neon HTTP gateway returns `{ fields, rows: null, ... }` for some
// empty result sets (most commonly `SELECT … WHERE … LIMIT 1` queries that
// match nothing). The driver's `processQueryResult` then crashes with
//
//     TypeError: Cannot read properties of null (reading 'map')
//
// because it does `r.rows.map(...)` without guarding. The bug is still
// present in the latest 1.1.0 release, so until upstream fixes it we wrap
// every tagged-template call here and translate that exact crash into an
// empty array — which is what every call site already treats null/missing
// rows as anyway.
//
// We deliberately match on the precise error message so unrelated TypeErrors
// (programmer bugs, real driver crashes) still bubble up unchanged.
const NULL_ROWS_BUG_MARKER = "reading 'map'";

const sql: typeof rawSql = ((...args: any[]) => {
  let pending: any;
  try {
    pending = (rawSql as any)(...args);
  } catch (err: any) {
    if (err?.message?.includes(NULL_ROWS_BUG_MARKER)) return Promise.resolve([] as any);
    throw err;
  }
  // NeonQueryPromise is thenable; Promise.resolve() unwraps it so .catch
  // works uniformly. We MUST NOT call .then() directly on the original
  // because that would consume it and prevent re-use.
  return Promise.resolve(pending).catch((err: any) => {
    if (err?.message?.includes(NULL_ROWS_BUG_MARKER)) return [] as any;
    throw err;
  });
}) as any;

// Preserve any helper methods the driver attaches (e.g. .transaction,
// .query) so existing callers that reach for them keep working.
for (const key of Object.keys(rawSql as any)) {
  try { (sql as any)[key] = (rawSql as any)[key]; } catch {}
}

export default sql;
