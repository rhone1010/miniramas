// lib/store/tests/helpers/fake-supabase.ts
//
// An in-memory stand-in for the parts of the Supabase client the grant code
// uses: table reads and conditional updates, inserts, rpc, and storage
// upload/download. Filters behave like PostgREST's: an update touches only the
// rows every filter matches, and returns them when .select() is chained.
//
// faults: make a specific operation fail once, to reach the error paths.

type Row = Record<string, any>
type Filter = (r: Row) => boolean

export type Fault =
  | { op: 'update'; table: string; match?: (patch: Row) => boolean }
  | { op: 'upload' }
  | { op: 'download' }

export function fakeSupabase(init: { tables?: Record<string, Row[]>; objects?: Record<string, Buffer> } = {}) {
  const tables: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(init.tables ?? {})) tables[k] = v.map((r) => ({ ...r }))
  const objects = new Map<string, Buffer>(Object.entries(init.objects ?? {}))
  const faults: Fault[] = []
  const rpcHandlers: Record<string, (args: any) => any> = {}
  const calls = { uploads: [] as Array<{ path: string; upsert: boolean }>, rpc: [] as Array<{ name: string; args: any }> }

  const takeFault = (pred: (f: Fault) => boolean) => {
    const i = faults.findIndex(pred)
    if (i < 0) return false
    faults.splice(i, 1)
    return true
  }

  function builder(table: string, mode: 'select' | 'update', patch?: Row) {
    const filters: Filter[] = []
    let wantRows = mode === 'select'
    let limitN: number | null = null
    const run = () => {
      const rows = (tables[table] ??= [])
      const hit = rows.filter((r) => filters.every((f) => f(r)))
      if (mode === 'update') {
        if (takeFault((f) => f.op === 'update' && f.table === table && (!f.match || f.match(patch!)))) {
          return { data: null, error: { message: 'injected update failure' } }
        }
        for (const r of hit) Object.assign(r, patch)
        return { data: wantRows ? hit.map((r) => ({ ...r })) : null, error: null }
      }
      const out = limitN == null ? hit : hit.slice(0, limitN)
      return { data: out.map((r) => ({ ...r })), error: null }
    }
    const b: any = {
      select: () => { wantRows = true; return b },
      eq: (c: string, v: any) => { filters.push((r) => r[c] === v); return b },
      in: (c: string, vs: any[]) => { filters.push((r) => vs.includes(r[c])); return b },
      lt: (c: string, v: any) => { filters.push((r) => r[c] != null && r[c] < v); return b },
      order: () => b,
      limit: (n: number) => { limitN = n; return b },
      maybeSingle: async () => { const { data, error } = run(); return { data: data?.[0] ?? null, error } },
      single: async () => { const { data, error } = run(); return { data: data?.[0] ?? null, error } },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    }
    return b
  }

  const sb: any = {
    from: (table: string) => ({
      select: (_cols?: string) => builder(table, 'select'),
      update: (patch: Row) => builder(table, 'update', patch),
      insert: (rows: Row | Row[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        ;(tables[table] ??= []).push(...list.map((r) => ({ ...r })))
        const res = { data: list, error: null }
        return { ...Promise.resolve(res), then: (a: any, b: any) => Promise.resolve(res).then(a, b),
                 select: () => ({ single: async () => ({ data: list[0], error: null }) }) }
      },
    }),
    rpc: async (name: string, args: any) => {
      calls.rpc.push({ name, args })
      const h = rpcHandlers[name]
      if (!h) return { data: null, error: { message: `no rpc ${name}` } }
      return h(args)
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, bytes: Buffer, opts: { upsert?: boolean } = {}) => {
          calls.uploads.push({ path, upsert: !!opts.upsert })
          if (takeFault((f) => f.op === 'upload')) return { data: null, error: { message: 'injected upload failure', statusCode: '500' } }
          if (objects.has(path) && !opts.upsert) {
            return { data: null, error: { message: 'The resource already exists', statusCode: '409' } }
          }
          objects.set(path, Buffer.from(bytes))
          return { data: { path }, error: null }
        },
        download: async (path: string) => {
          if (takeFault((f) => f.op === 'download')) return { data: null, error: { message: 'injected download failure' } }
          const buf = objects.get(path)
          if (!buf) return { data: null, error: { message: 'Object not found' } }
          return { data: { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }, error: null }
        },
      }),
    },
  }

  return {
    sb,
    tables,
    objects,
    calls,
    fault: (f: Fault) => faults.push(f),
    onRpc: (name: string, h: (args: any) => any) => { rpcHandlers[name] = h },
    row: (table: string, id: string) => (tables[table] ?? []).find((r) => r.id === id),
  }
}
