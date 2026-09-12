/**
 * A minimal chainable stand-in for the Supabase query builder, for unit
 * tests that need to assert on admin*Api.ts logic without a live database.
 * RLS itself is NOT exercised here — that is validated separately against
 * a real local Postgres instance (see supabase/stub_supabase_platform.sql
 * and the Phase 3 RLS test script); this only lets us test that each API
 * function calls the right table/columns and shapes its return value
 * correctly.
 *
 * Every chain method (select/eq/order/limit/maybeSingle/single/upsert/...)
 * returns the same chainable object, which resolves (via the thenable
 * `.then`) to the fixed `{ data, error, count }` result it was built with.
 */
export function chainable<T>(result: { data?: T | null; error?: { message: string } | null; count?: number | null }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null }
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: typeof resolved) => void) => resolve(resolved)
      }
      if (prop === 'catch' || prop === 'finally') {
        return () => chain
      }
      return (..._args: unknown[]) => chain
    },
  }
  const chain: any = new Proxy({}, handler)
  return chain
}
