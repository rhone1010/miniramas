'use client'

// app/admin/panel.tsx
//
// The control panel surface. Built on the portraits.html system: espresso
// masthead with gold underline navigation, limestone ground, Curator's Pick
// treatment on metric cards, coffee panels where you act or where the
// outside world touches the business.
//
// Cormorant is deliberately absent. Source Serif 4 carries the editorial
// voice and renders at true optical size, so headings don't quietly shrink.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PanelData } from '@/lib/admin/panel-types'
import { money, num, pct, secs, delta } from '@/lib/admin/format'

type Tab = 'overview'|'engine'|'marketing'|'customers'|'fulfilment'|'health'|'controls'

const TABS: Array<[Tab, string]> = [
  ['overview','Overview'], ['engine','Engine'], ['marketing','Marketing'],
  ['customers','Customers'], ['fulfilment','Fulfilment'], ['health','Health'],
  ['controls','Controls'],
]

export default function Panel({
  data, days, env,
}: { data: PanelData; days: number; env: string }) {
  const [tab, setTab] = useState<Tab>('overview')
  const router = useRouter()
  const openIncidents = data.health?.open_incidents ?? 0

  return (
    <>
      <style>{CSS}</style>

      <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true"><defs>
        <filter id="curatorDeckle" x="-8%" y="-6%" width="116%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.016" numOctaves={4} seed={7} result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5.5" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs></svg>

      <header className="mh">
        <div className="mh-mark">C</div>
        <div>
          <h1>Control Panel</h1>
          <div className="eyebrow">Liten &amp; Co</div>
        </div>
        <div className="mh-right">
          <span className="envpill">Prodigi {env}</span>
          <button className="signout" onClick={async () => {
            await fetch('/api/admin/auth/logout', { method: 'POST' })
            router.push('/admin/login')
          }}>Sign out</button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" className="tab"
            aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
            {id === 'health' && openIncidents > 0 && <span className="dot" />}
          </button>
        ))}
      </nav>

      <div className="wrap">
        {tab === 'overview'   && <Overview   d={data} days={days} router={router} />}
        {tab === 'engine'     && <Engine     d={data} />}
        {tab === 'marketing'  && <Marketing  d={data} />}
        {tab === 'customers'  && <Customers  d={data} />}
        {tab === 'fulfilment' && <Fulfilment d={data} />}
        {tab === 'health'     && <Health     d={data} />}
        {tab === 'controls'   && <Controls   d={data} />}
      </div>
    </>
  )
}

/* ══════════ shared pieces ══════════ */

function Card({ label, value, sub, delta: dl }:{
  label:string; value:string; sub?:string
  delta?:{text:string;dir:'up'|'down'|'flat'}
}) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="stat">{value}</div>
      {dl   && <div className={`delta ${dl.dir}`}>{dl.text}</div>}
      {sub  && <div className="sublabel">{sub}</div>}
    </div>
  )
}

function Note({ children }:{ children: React.ReactNode }) {
  return (
    <div className="note">
      <span className="gold-rule" />
      <span>{children}</span>
    </div>
  )
}

function Empty({ what }:{ what:string }) {
  return <div className="empty">Nothing recorded yet. {what}</div>
}

function Bar({ label, value, max, gold }:{
  label:string; value:number; max:number; gold?:boolean
}) {
  const w = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0
  return (
    <div className="bar">
      <span className="n">{label}</span>
      <div className="track"><div className={`fill${gold ? ' gold' : ''}`} style={{width:`${w}%`}} /></div>
      <span className="v">{num(value)}</span>
    </div>
  )
}

/* ══════════ OVERVIEW ══════════ */

function Overview({ d, days, router }:{ d:PanelData; days:number; router:ReturnType<typeof useRouter> }) {
  const o = d.overview
  if (!o) return <Empty what="The reporting functions may not be installed." />
  const f = o.funnel
  const top = f.visited || 1

  return (
    <section>
      <div className="range">
        <span className="lbl">Range</span>
        {[[1,'Today'],[7,'7 days'],[30,'30 days'],[365,'All']].map(([v,l]) => (
          <button key={String(v)} className={`rbtn${days === v ? ' on' : ''}`}
            onClick={() => router.push(`/admin?days=${v}`)}>{l}</button>
        ))}
      </div>

      <div className="grid g4">
        <Card label="Revenue" value={money(o.revenue_cents)}
              delta={delta(o.revenue_cents, o.revenue_prior_cents)} />
        <Card label="Crafts" value={num(o.crafts)}
              delta={delta(o.crafts, o.crafts_prior)} />
        <Card label="Prints ordered" value={num(o.prints)}
              delta={delta(o.prints, o.prints_prior, 'n')} />
        <Card label="New customers" value={num(o.customers)}
              delta={delta(o.customers, o.customers_prior, 'n')} />
      </div>

      <div className="grid g23">
        <div className="panel">
          <div className="panelhead"><h2>Where the {days === 1 ? 'day' : 'period'} went</h2></div>
          {f.visited === 0 ? (
            <Empty what="Visits appear once track.js is firing on the live site." />
          ) : (
            <>
              <div>
                {[
                  ['Visited', f.visited], ['Opened a Series', f.series],
                  ['Uploaded a photo', f.uploaded], ['Chose a finish', f.chose],
                  ['Reached checkout', f.checkout], ['Paid', f.paid],
                ].map(([label, v]) => {
                  const val = v as number
                  const w = Math.max(0.4, (val / top) * 100)
                  return (
                    <div className="fstep" key={label as string}>
                      <span className="n">{label as string}</span>
                      <div className="track"><div className="fill" style={{width:`${w}%`}} /></div>
                      <span className="v">
                        <b>{num(val)}</b>
                        {label !== 'Visited' && ` · ${Math.round((val / top) * 1000) / 10}%`}
                      </span>
                    </div>
                  )
                })}
              </div>
              <Note>
                Every step here is a real person who got that far and no
                further. The widest gap is where the work is.
              </Note>
            </>
          )}
        </div>

        <div className="coffee needs">
          <div className="panelhead"><h2>Needs you</h2></div>
          {o.orders_in_error === 0 && o.credits_held === 0 && (
            <div className="empty dark">Nothing is asking for you right now.</div>
          )}
          {o.orders_in_error > 0 && (
            <div className="needitem">
              <span className="pill p-bad">Fulfilment</span>
              <div className="t">{o.orders_in_error} print {o.orders_in_error === 1 ? 'order' : 'orders'} sitting in error</div>
              <div className="sublabel">Paid for, nothing printed.</div>
            </div>
          )}
          {o.credits_held > 0 && (
            <div className="needitem">
              <span className="pill p-warn">Credits</span>
              <div className="t">{num(o.credits_held)} credits bought but unused</div>
              <div className="sublabel">Value you hold that isn&apos;t yours yet.</div>
            </div>
          )}
          {(d.health?.open_incidents ?? 0) > 0 && (
            <div className="needitem">
              <span className="pill p-warn">Engine</span>
              <div className="t">{d.health!.open_incidents} open {d.health!.open_incidents === 1 ? 'incident' : 'incidents'}</div>
              <div className="sublabel">See the Health tab.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ══════════ ENGINE ══════════ */

function Engine({ d }:{ d:PanelData }) {
  const e = d.engine
  if (!e) return <Empty what="" />
  const out = e.outcomes
  const outMax = Math.max(out.passed, out.failed, out.rejected, out.redirected, 1)
  const finishMax = Math.max(...e.by_finish.map(f => f.crafted), 1)

  return (
    <section>
      <div className="grid g4">
        <Card label="Renders" value={num(e.renders_all_time)} sub="all time" />
        <Card label="First-pass rate" value={pct(e.first_pass_pct)} sub="accepted without a retry" />
        <Card label="Cost per kept piece" value={e.cost_per_kept != null ? `$${e.cost_per_kept}` : '—'} sub="every attempt included" />
        <Card label="Renders per kept piece" value={String(e.renders_per_kept ?? '—')}
              sub={`${num(e.renders_all_time)} renders · ${num(e.kept_pieces)} pieces`} />
      </div>

      <div className="grid g2">
        <div className="panel">
          <div className="panelhead"><h2>Finishes crafted</h2><span className="readonly">Last {e.days} days</span></div>
          {e.by_finish.length === 0 ? <Empty what="" /> : (
            <div>{e.by_finish.slice(0,8).map(f =>
              <Bar key={f.finish} label={f.finish} value={f.crafted} max={finishMax} />)}</div>
          )}
        </div>

        <div className="panel">
          <div className="panelhead"><h2>Where renders end</h2></div>
          <div>
            <Bar label="Passed"                 value={out.passed}     max={outMax} />
            <Bar label="Failed"                 value={out.failed}     max={outMax} gold />
            <Bar label="Photo turned away"      value={out.rejected}   max={outMax} gold />
            <Bar label="Sent to another Series" value={out.redirected} max={outMax} gold />
          </div>
          {out.redirected > 0 && (
            <Note>
              {out.redirected} {out.redirected === 1 ? 'photograph belonged' : 'photographs belonged'} in
              another room. Worth knowing which one.
            </Note>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panelhead"><h2>Cost and quality by finish</h2><span className="readonly">Last {e.days} days</span></div>
        {e.by_finish.length === 0 ? <Empty what="" /> : (
          <table>
            <thead><tr>
              <th>Finish</th><th className="num">Crafted</th><th className="num">First pass</th>
              <th className="num">Avg attempts</th><th className="num">Likeness</th><th className="num">Cost each</th>
            </tr></thead>
            <tbody>
              {e.by_finish.map(f => (
                <tr key={f.finish}>
                  <td>{f.finish}</td>
                  <td className="num">{num(f.crafted)}</td>
                  <td className="num">{pct(f.first_pct)}</td>
                  <td className="num">{f.avg_attempts ?? '—'}</td>
                  <td className="num">{f.likeness ?? '—'}</td>
                  <td className="num">{f.cost_each != null ? `$${f.cost_each}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

/* ══════════ MARKETING ══════════ */

function Marketing({ d }:{ d:PanelData }) {
  const m = d.marketing
  if (!m) return <Empty what="" />
  const h = m.headline
  const noData = h.visits === 0

  return (
    <section>
      <div className="grid g4">
        <Card label="Visits" value={num(h.visits)} sub={`${num(h.people)} distinct people`} />
        <Card label="Series opened" value={num(h.series_views)} />
        <Card label="Print Shop opened" value={num(h.printshop)}
              sub={`${num(h.print_checkout)} reached checkout`} />
        <Card label="Print intent" value={h.printshop ? `${Math.round(100*h.print_checkout/h.printshop)}%` : '—'}
              sub="opened → checkout" />
      </div>

      {noData ? (
        <div className="panel"><Empty what="Wire track() into portraits.html and this fills within a day." /></div>
      ) : (
        <>
          <div className="grid g2">
            <div className="coffee">
              <div className="panelhead"><h2>Where they came from</h2></div>
              <table>
                <thead><tr><th>Source</th><th className="num">Visits</th><th className="num">Paid</th><th className="num">Rate</th></tr></thead>
                <tbody>
                  {m.sources.map(s => (
                    <tr key={s.source}>
                      <td>{s.source}</td>
                      <td className="num">{num(s.visits)}</td>
                      <td className="num">{num(s.paid)}</td>
                      <td className="num">{s.visits ? `${Math.round(1000*s.paid/s.visits)/10}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="coffee">
              <div className="panelhead"><h2>By campaign</h2></div>
              {m.campaigns.length === 0 ? (
                <div className="empty dark">No tagged traffic yet. Ad URLs need utm_campaign and utm_content.</div>
              ) : (
                <table>
                  <thead><tr><th>Campaign</th><th>Creative</th><th className="num">Visits</th><th className="num">Paid</th></tr></thead>
                  <tbody>
                    {m.campaigns.map((c,i) => (
                      <tr key={i}>
                        <td>{c.campaign}</td><td>{c.content}</td>
                        <td className="num">{num(c.visits)}</td><td className="num">{num(c.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid g2">
            <div className="panel">
              <div className="panelhead"><h2>Rooms entered</h2></div>
              {m.rooms.length === 0 ? <Empty what="" /> : (
                <div>{m.rooms.map(r =>
                  <Bar key={r.room} label={r.room} value={r.n}
                       max={Math.max(...m.rooms.map(x=>x.n),1)} />)}</div>
              )}
            </div>
            <div className="panel">
              <div className="panelhead"><h2>Pages opened</h2></div>
              {m.pages.length === 0 ? <Empty what="" /> : (
                <div>{m.pages.map(p =>
                  <Bar key={p.target} label={p.target} value={p.n}
                       max={Math.max(...m.pages.map(x=>x.n),1)} gold />)}</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/* ══════════ CUSTOMERS ══════════ */

function Customers({ d }:{ d:PanelData }) {
  const c = d.customers
  if (!c) return <Empty what="" />
  return (
    <section>
      <div className="grid g4">
        <Card label="Known customers" value={num(c.total)} />
        <Card label="Crafted, never bought" value={num(c.crafted_only)} />
        <Card label="Bought more than once" value={num(c.repeat)} />
        <Card label="Credits held" value={num(c.credits_held)} sub="bought, not yet crafted" />
      </div>

      <div className="panel">
        <div className="panelhead"><h2>Everyone</h2><span className="readonly">{num(c.people.length)} shown</span></div>
        {c.people.length === 0 ? <Empty what="" /> : (
          <table>
            <thead><tr>
              <th>Customer</th><th>First seen</th>
              <th className="num">Pieces</th><th className="num">Credits</th>
              <th className="num">Spent</th><th className="num">Prints</th>
            </tr></thead>
            <tbody>
              {c.people.map(p => (
                <tr key={p.owner_key}>
                  <td>{p.email || <span className="mono">{p.owner_key.slice(0,10)}…</span>}</td>
                  <td>{new Date(p.first_seen).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                  <td className="num">{num(p.pieces)}</td>
                  <td className="num">{num(p.credits)}</td>
                  <td className="num">{money(p.spent_cents)}</td>
                  <td className="num">{num(p.prints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

/* ══════════ FULFILMENT ══════════ */

function Fulfilment({ d }:{ d:PanelData }) {
  const f = d.fulfilment
  if (!f) return <Empty what="" />
  const status = (s:string) =>
    s === 'error' ? 'p-bad'
    : s === 'delivered' || s === 'shipped' ? 'p-ok'
    : s === 'cancelled' ? 'p-mute' : 'p-warn'

  return (
    <section>
      <div className="grid g4">
        <Card label="Orders" value={num(f.orders)} sub="all time" />
        <Card label="In error" value={num(f.in_error)} sub={f.in_error ? 'paid, not printed' : 'none'} />
        <Card label="Print revenue" value={money(f.retail_cents)}
              sub={f.wholesale_cents ? `less ${money(f.wholesale_cents)} lab cost` : 'lab cost recorded when live'} />
        <Card label="Margin" value={pct(f.margin_pct)} />
      </div>

      <div className="coffee">
        <div className="panelhead"><h2>Orders</h2></div>
        {f.recent.length === 0 ? <div className="empty dark">No print orders yet.</div> : (
          <table>
            <thead><tr>
              <th>Order</th><th>Placed</th><th>Customer</th>
              <th className="num">Total</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {f.recent.map(o => (
                <tr key={o.id}>
                  <td className="mono">{(o.prodigi_order_id || o.id).slice(0,10)}…</td>
                  <td>{new Date(o.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</td>
                  <td>{o.customer_email}</td>
                  <td className="num">{money(o.retail_total_cents)}</td>
                  <td><span className={`pill ${status(o.status)}`}>{o.status.replace('_',' ')}</span></td>
                  <td>{o.tracking_url
                    ? <a className="btn ghost small" href={o.tracking_url} target="_blank" rel="noreferrer">Track</a>
                    : o.error_message ? <span className="err">{o.error_message.slice(0,60)}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {f.in_error > 0 && (
          <Note>
            {f.in_error} {f.in_error === 1 ? 'order is' : 'orders are'} paid and stuck. The
            customer has been charged and nothing has been printed.
          </Note>
        )}
      </div>
    </section>
  )
}

/* ══════════ HEALTH ══════════ */

function Health({ d }:{ d:PanelData }) {
  const h = d.health
  if (!h) return <Empty what="" />
  const maxS = Math.max(...h.hourly.map(x => x.avg_s), 1)

  return (
    <section>
      <div className="grid g4">
        <Card label="Typical craft time" value={secs(h.median_ms)} sub="median" />
        <Card label="Slowest 1 in 20" value={secs(h.p95_ms)} sub="95th percentile" />
        <Card label="Failure rate" value={pct(h.failure_pct)} sub={`last ${h.days} days`} />
        <Card label="Open incidents" value={num(h.open_incidents)} />
      </div>

      <div className="panel">
        <div className="panelhead"><h2>Craft time through the day</h2><span className="readonly">Hour, UTC</span></div>
        {h.hourly.length === 0 ? <Empty what="" /> : (
          <div className="hours">
            {h.hourly.map(x => (
              <div className="hcol" key={x.hour} title={`${x.hour}:00 — ${x.avg_s}s over ${x.n} renders`}>
                <div className="hbar" style={{height:`${Math.max(3,(x.avg_s/maxS)*100)}%`}} />
                <span className="hl">{String(x.hour).padStart(2,'0')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="coffee">
        <div className="panelhead"><h2>Open incidents</h2><span className="readonly">{num(h.incidents.length)} shown</span></div>
        {h.incidents.length === 0 ? (
          <div className="empty dark">Nothing has failed. Incidents appear here once logIncident() is wired.</div>
        ) : h.incidents.map(i => (
          <div className="incident" key={i.incident_id}>
            <div className="top">
              <span className={`pill ${i.severity === 'fatal' || i.severity === 'error' ? 'p-bad' : 'p-warn'}`}>{i.severity}</span>
              <span className="pill p-mute">{i.surface}</span>
              <span className="id">{i.incident_id}{i.count > 1 ? ` · \u00d7${i.count}` : ''}</span>
            </div>
            <div className="sum">{i.summary}</div>
            <div className="meta">
              {i.component} · first {new Date(i.first_seen).toLocaleString('en-GB')} ·
              last {new Date(i.last_seen).toLocaleString('en-GB')}
            </div>
            <div className="acts">
              <button className="btn small" onClick={() => copyIncident(i.incident_id)}>Copy for Claude</button>
            </div>
          </div>
        ))}
        <Note>
          Incidents are written to <code>logs/incidents/</code> too, so Claude
          Code can read them straight from the repo.
        </Note>
      </div>
    </section>
  )
}

async function copyIncident(id:string) {
  try {
    const res = await fetch(`/api/admin/incidents/${id}`)
    const text = await res.text()
    await navigator.clipboard.writeText(text)
    alert('Copied. Paste it into a chat with Claude.')
  } catch {
    alert('Could not copy. The incident is also in logs/incidents/.')
  }
}

/* ══════════ CONTROLS ══════════ */

function Controls({ d }:{ d:PanelData }) {
  const c = d.controls
  const [rows, setRows] = useState(c?.qa_settings ?? [])
  const [flags, setFlags] = useState(c?.flags ?? [])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  if (!c) return <Empty what="" />

  async function saveSeries(series:string) {
    const row = rows.find(r => r.series === series)
    if (!row) return
    setSaving(series); setSaved(null)
    const res = await fetch('/api/admin/settings', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kind:'qa', ...row }),
    })
    setSaving(null)
    setSaved(res.ok ? series : null)
    if (!res.ok) alert('Save failed. Nothing was changed.')
  }

  async function saveFlag(owner_key:string, fulfilment:boolean) {
    setFlags(f => f.map(x => x.owner_key === owner_key ? {...x, fulfilment} : x))
    const res = await fetch('/api/admin/settings', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ kind:'flag', owner_key, fulfilment }),
    })
    if (!res.ok) {
      setFlags(f => f.map(x => x.owner_key === owner_key ? {...x, fulfilment: !fulfilment} : x))
      alert('Save failed. Nothing was changed.')
    }
  }

  const set = (series:string, key:'source_strictness'|'render_strictness'|'qa_enabled', v:number|boolean) =>
    setRows(r => r.map(x => x.series === series ? {...x, [key]: v} : x))

  return (
    <section>
      <div className="grid g2">
        <div className="stack">
          {rows.map(r => (
            <div className="panel" key={r.series}>
              <div className="panelhead">
                <h2>{r.series}</h2>
                <span className="readonly">Live</span>
              </div>

              <div className="ctrl">
                <div className="ctrl-head"><span className="t">How fussy about the photograph</span></div>
                <div className="desc">Higher turns away more source photos before crafting. At 1, almost nothing is refused.</div>
                <div className="sliderow">
                  <input type="range" min={1} max={10} value={r.source_strictness}
                    onChange={e => set(r.series,'source_strictness',Number(e.target.value))} />
                  <span className="sval">{r.source_strictness}</span>
                </div>
              </div>

              <div className="ctrl">
                <div className="ctrl-head"><span className="t">How fussy about the likeness</span></div>
                <div className="desc">Higher retries more renders before accepting one. Costs more and takes longer.</div>
                <div className="sliderow">
                  <input type="range" min={1} max={10} value={r.render_strictness}
                    onChange={e => set(r.series,'render_strictness',Number(e.target.value))} />
                  <span className="sval">{r.render_strictness}</span>
                </div>
              </div>

              <div className="ctrl">
                <div className="ctrl-head"><span className="t">Checking on</span></div>
                <div className="desc">Off means every render ships without being scored.</div>
                <label className="toggle">
                  <input type="checkbox" checked={r.qa_enabled}
                    onChange={e => set(r.series,'qa_enabled',e.target.checked)} />
                  <span className="switch" />{r.qa_enabled ? 'On' : 'Off'}
                </label>
              </div>

              <div className="saverow">
                <button className="btn" disabled={saving === r.series}
                  onClick={() => saveSeries(r.series)}>
                  {saving === r.series ? 'Saving…' : `Save ${r.series}`}
                </button>
                <span className="sublabel">
                  {saved === r.series ? 'Saved. Takes effect on the next upload.' : 'Takes effect on the next upload. No deploy.'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="coffee">
            <div className="panelhead"><h2>Fulfilment</h2></div>
            <div className="desc dark">
              Prints only reach the lab for accounts switched on here.
              Environment is <code>{'PRODIGI_ENV'}</code>, changed in Vercel — not from this panel.
            </div>
            {flags.length === 0 ? <div className="empty dark">No accounts flagged yet.</div> : (
              <table>
                <thead><tr><th>Account</th><th className="num">Send to lab</th></tr></thead>
                <tbody>
                  {flags.map(f => (
                    <tr key={f.owner_key}>
                      <td className="mono">{f.owner_key.slice(0,22)}{f.owner_key.length>22?'…':''}</td>
                      <td className="num">
                        <label className="toggle">
                          <input type="checkbox" checked={f.fulfilment}
                            onChange={e => saveFlag(f.owner_key, e.target.checked)} />
                          <span className="switch" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panelhead"><h2>Prompts</h2><span className="readonly">Read only</span></div>
            <div className="desc">
              Shown so you can confirm what is running. Changing a prompt happens
              in the engine, never here.
            </div>
            {c.prompts.length === 0 ? <Empty what="" /> : (
              <table>
                <thead><tr><th>Engine</th><th>Active since</th><th className="num">Score</th></tr></thead>
                <tbody>
                  {c.prompts.map(p => (
                    <tr key={p.engine_id}>
                      <td>{p.engine_id}</td>
                      <td>{new Date(p.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td className="num">{p.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════ STYLE ══════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400;1,8..60,500&family=Manrope:wght@400;500;600;700&display=swap');

.mh,.tabs,.wrap{--stage-gutter:44px}
:root{
  --mh-h:68px;
  --stone:url("/textures/limestone.jpg");
  --coffee-tex:url("/textures/coffee_leather.jpg");
  --noise:url("/textures/noise.png");
  --ink:#2a241e; --ink-soft:#5a5248; --taupe:#aba39a;
  --vellum-100:#f8f4eb; --vellum-200:#f3ecdd; --vellum-300:#e9dec8;
  --limestone:#f1ece3;
  --oxblood:#7d4242; --gold:#b68a53; --series:#d7bd89;
  --espresso:#26201a; --coffee-700:#332620;
  --card-line:rgba(196,169,110,.28);
  --hairline:rgba(123,92,58,.20);
  --serif:'Source Serif 4',Georgia,serif;
  --sans:'Manrope',system-ui,sans-serif;
  --r-card:8px;
  --data:#9a6060; --data-track:rgba(125,66,66,.12); --data-2:#b39a67;
  --ok:#5f7a55; --warn:#8a6a2f; --bad:#8a3a3a;
  --ok-d:#9db98f; --warn-d:#d7bd89; --bad-d:#cf8f8f;
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  min-height:100%;
  background-color:var(--limestone);
  background-image:
    radial-gradient(1200px 640px at 50% -6%, rgba(255,253,248,.75), rgba(255,253,248,0) 66%),
    linear-gradient(0deg, rgba(241,236,227,.62), rgba(241,236,227,.62)),
    var(--stone);
  background-repeat:no-repeat,repeat,repeat;
  background-size:auto,auto,1100px 1100px;
  background-attachment:fixed;
  color:var(--ink); font-family:var(--sans); font-size:1rem; line-height:1.5;
  overflow-x:hidden; -webkit-font-smoothing:antialiased;
}
button{font:inherit;border:none;background:none;color:inherit}
a{color:inherit}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem}

.mh{position:sticky;top:0;z-index:60;height:var(--mh-h);background:var(--espresso);
  border-bottom:1px solid var(--card-line);display:flex;align-items:center;gap:18px;
  padding-inline:var(--stage-gutter)}
.mh-mark{width:30px;height:30px;border-radius:50%;border:1px solid var(--series);
  color:var(--series);display:grid;place-items:center;font-family:var(--serif);
  font-size:18px;font-style:italic;line-height:1}
.mh h1{font-family:var(--serif);font-style:italic;font-weight:400;font-size:1.5rem;
  line-height:1;color:var(--vellum-100)}
.mh .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--taupe);margin-top:4px}
.mh-right{margin-left:auto;display:flex;align-items:center;gap:16px}
.envpill{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;
  padding:.34rem .78rem;border-radius:999px;background:var(--coffee-700);
  border:1px solid var(--card-line);color:var(--series)}
.signout{font-family:var(--serif);font-style:italic;font-size:1rem;padding:.34rem .9rem;
  border-radius:999px;background:var(--coffee-700);border:1px solid var(--card-line);
  color:var(--vellum-300);cursor:pointer;transition:background .16s,border-color .16s,color .16s}
.signout:hover{background:#40302a;border-color:var(--gold);color:var(--vellum-100)}

.tabs{position:sticky;top:var(--mh-h);z-index:59;display:flex;gap:32px;
  padding-inline:var(--stage-gutter);background:var(--espresso);
  border-bottom:1px solid var(--card-line);overflow-x:auto}
.tab{position:relative;white-space:nowrap;cursor:pointer;font-family:var(--serif);
  font-size:1.12rem;line-height:1;color:var(--vellum-300);padding:13px 0 12px;
  transition:color .16s}
.tab:hover{color:var(--vellum-100)}
.tab[aria-selected="true"]{color:var(--gold)}
.tab[aria-selected="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;
  height:2px;background:var(--gold)}
.tab .dot{display:inline-block;width:5px;height:5px;border-radius:50%;
  background:var(--bad-d);margin-left:.42rem;vertical-align:middle}

.wrap{padding:40px var(--stage-gutter) 88px;max-width:2200px;margin:0 auto}
section > .grid + .grid, section > .grid + .panel, section > .grid + .coffee,
section > .panel + .panel, section > .panel + .grid, section > .coffee + .panel,
section > .panel + .coffee, section > .coffee + .coffee{margin-top:40px}

.range{display:flex;gap:22px;align-items:baseline;margin-bottom:26px}
.range .lbl{font-size:10px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--taupe);font-weight:500}
.rbtn{font-family:var(--serif);font-style:italic;font-size:1.02rem;padding:0 0 3px;
  border-bottom:1.5px solid transparent;color:var(--ink-soft);cursor:pointer}
.rbtn.on{color:var(--oxblood);border-bottom-color:var(--oxblood)}

.grid{display:grid;gap:18px}
.g4{grid-template-columns:repeat(4,1fr)}
.g2{grid-template-columns:repeat(2,1fr)}
.g23{grid-template-columns:2.1fr 1fr}
@media(max-width:1400px){.g4{grid-template-columns:repeat(2,1fr)}.g23{grid-template-columns:1fr}}
@media(max-width:900px){.g4,.g2{grid-template-columns:1fr}
  .mh,.tabs,.wrap{--stage-gutter:18px}.wrap{padding-top:26px}}

.card{position:relative;isolation:isolate;overflow:hidden;border-radius:var(--r-card);
  background-color:#fbf6ef;
  background-image:
    radial-gradient(circle at 12% 12%, rgba(255,255,255,.42), transparent 44%),
    radial-gradient(circle at 88% 88%, rgba(121,83,44,.045), transparent 50%),
    linear-gradient(180deg, rgba(255,255,255,.24), rgba(217,197,166,.05));
  border:1px solid rgba(183,135,65,.34);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 .15rem .45rem rgba(62,41,23,.045);
  padding:16px 18px 14px;display:flex;flex-direction:column}
.card::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background-image:var(--noise);background-repeat:repeat;background-size:14rem 14rem;
  opacity:.04;mix-blend-mode:multiply}
.card > *{position:relative;z-index:2}

.panel{position:relative;isolation:isolate;overflow:hidden;border-radius:var(--r-card);
  background-color:#f8f4ea;
  background-image:
    radial-gradient(circle at 8% 6%, rgba(255,255,255,.5), transparent 46%),
    linear-gradient(180deg, rgba(255,255,255,.2), rgba(217,197,166,.06)),
    linear-gradient(0deg, rgba(248,244,234,.72), rgba(248,244,234,.72)),
    var(--stone);
  background-repeat:no-repeat,no-repeat,repeat,repeat;
  background-size:auto,auto,auto,900px 900px;
  border:1px solid var(--hairline);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6), 0 .12rem .4rem rgba(62,41,23,.04);
  padding:24px 26px}
.panel > *{position:relative;z-index:2}

.coffee{position:relative;isolation:isolate;overflow:hidden;border-radius:var(--r-card);
  background-color:#1a1613;
  background-image:
    radial-gradient(circle at 18% 12%, rgba(255,255,255,.045), transparent 42%),
    radial-gradient(circle at 82% 84%, rgba(255,255,255,.025), transparent 48%),
    linear-gradient(180deg, rgba(255,255,255,.018), rgba(0,0,0,.04)),
    linear-gradient(0deg, rgba(26,22,19,.42), rgba(26,22,19,.42)),
    var(--coffee-tex);
  background-repeat:no-repeat,no-repeat,no-repeat,repeat,repeat;
  background-size:auto,auto,auto,auto,800px 800px;
  border:1px solid rgba(174,133,78,.2);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 .8rem 1.8rem rgba(25,16,10,.18);
  padding:24px 26px;color:var(--vellum-200)}
.coffee::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background-image:var(--noise);background-repeat:repeat;background-size:13rem 13rem;
  opacity:.12;mix-blend-mode:soft-light}
.coffee > *{position:relative;z-index:2}
.coffee .panelhead{border-bottom-color:rgba(215,189,137,.22)}
.coffee .panelhead h2{color:var(--series)}
.coffee .readonly,.coffee .sublabel,.coffee th{color:var(--taupe)}
.coffee th{border-bottom-color:rgba(215,189,137,.22)}
.coffee td{border-bottom-color:rgba(215,189,137,.12);color:var(--vellum-200)}
.coffee code,.coffee .desc.dark{color:var(--vellum-300)}
.needs::after{content:"";position:absolute;inset:.35rem;z-index:1;pointer-events:none;
  border:1px solid rgba(215,189,137,.14);border-radius:inherit}
.needitem + .needitem{margin-top:20px;padding-top:20px;border-top:1px solid rgba(215,189,137,.14)}
.needitem .t{margin-top:9px;font-size:1rem;font-weight:600;color:var(--vellum-100)}

.card h3,.panel h3{font-size:10px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--taupe);font-weight:500}
.panelhead{display:flex;align-items:baseline;gap:16px;padding-bottom:12px;
  margin-bottom:16px;border-bottom:1px solid var(--hairline)}
.panelhead h2{font-family:var(--serif);font-style:italic;font-weight:400;
  font-size:1.6rem;line-height:1}
.readonly{margin-left:auto;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--taupe);font-weight:500}

.stat{font-size:2.9rem;font-weight:700;letter-spacing:-.03em;line-height:1;margin-top:14px;
  font-variant-numeric:tabular-nums lining-nums}
.delta{font-size:11px;font-weight:600;letter-spacing:.06em;margin-top:6px}
.up{color:var(--ok)} .down{color:var(--bad)} .flat{color:var(--taupe)}
.sublabel{font-size:11px;color:var(--taupe);letter-spacing:.04em;margin-top:6px}

.bar{display:grid;grid-template-columns:158px 1fr 66px;align-items:center;gap:16px;padding:9px 0}
.bar + .bar{border-top:1px solid var(--hairline)}
.bar .n{font-size:.95rem}
.bar .track{height:4px;background:var(--data-track);border-radius:2px;overflow:hidden}
.bar .fill{height:100%;background:var(--data);border-radius:2px}
.bar .fill.gold{background:var(--data-2)}
.bar .v{font-size:1rem;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}

.fstep{display:grid;grid-template-columns:200px 1fr 116px;align-items:center;gap:20px;padding:11px 0}
.fstep + .fstep{border-top:1px solid var(--hairline)}
.fstep .track{height:6px;background:var(--data-track);border-radius:3px;overflow:hidden}
.fstep .fill{height:100%;background:var(--data);border-radius:3px}
.fstep .n{font-size:.95rem}
.fstep .v{font-size:12px;color:var(--taupe);text-align:right;font-variant-numeric:tabular-nums}
.fstep .v b{color:var(--ink);font-size:1rem;font-weight:600}

table{width:100%;border-collapse:collapse;font-size:.95rem}
th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--taupe);font-weight:500;padding:0 14px 9px 0;border-bottom:1px solid var(--hairline)}
td{padding:11px 14px 11px 0;border-bottom:1px solid var(--hairline);vertical-align:middle}
tr:last-child td{border-bottom:none}
.num{font-variant-numeric:tabular-nums lining-nums;text-align:right;padding-right:0;font-weight:600}
th.num{text-align:right;padding-right:0;font-weight:500}
.err{font-size:.8rem;color:var(--bad-d)}

.pill{display:inline-block;font-size:10px;font-weight:600;letter-spacing:.14em;
  padding:.22rem .56rem;border-radius:999px;text-transform:uppercase}
.p-ok{background:rgba(95,122,85,.12);color:var(--ok)}
.p-warn{background:rgba(138,106,47,.12);color:var(--warn)}
.p-bad{background:rgba(138,58,58,.12);color:var(--bad)}
.p-mute{background:rgba(171,163,154,.16);color:var(--ink-soft)}
.coffee .p-ok{background:rgba(157,185,143,.14);color:var(--ok-d)}
.coffee .p-warn{background:rgba(215,189,137,.14);color:var(--warn-d)}
.coffee .p-bad{background:rgba(207,143,143,.14);color:var(--bad-d)}
.coffee .p-mute{background:rgba(233,222,200,.12);color:var(--vellum-300)}

.note{position:relative;margin-top:24px;padding:16px 22px 16px 26px;
  font-family:var(--serif);font-size:1.12rem;line-height:1.55;color:var(--ink-soft);
  background:#fffefb;border-left:2px solid var(--gold);border-radius:0 4px 4px 0}
.coffee .note{background:#2b211b;color:var(--vellum-200);
  border-left-color:var(--series);border-radius:0 4px 4px 0}
.note .gold-rule{display:none}
.note code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85em}

.empty{padding:26px 0;color:var(--taupe);font-family:var(--serif);
  font-style:italic;font-size:1.12rem}
.empty.dark{color:var(--vellum-300)}

.hours{display:flex;align-items:flex-end;gap:4px;height:170px;padding-top:8px}
.hcol{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}
.hbar{width:100%;background:var(--data);border-radius:2px 2px 0 0;min-height:3px}
.hl{font-size:9px;color:var(--taupe);margin-top:6px;font-variant-numeric:tabular-nums}

.ctrl{padding:20px 0;border-bottom:1px solid var(--hairline)}
.ctrl:first-of-type{padding-top:4px}
.ctrl-head .t{font-family:var(--serif);font-style:italic;font-size:1.22rem}
.ctrl .desc,.desc{font-size:.875rem;color:var(--ink-soft);max-width:60ch;margin:6px 0 16px}
.sliderow{display:flex;align-items:center;gap:18px}
input[type=range]{flex:1;max-width:400px;accent-color:var(--oxblood);height:20px}
.sval{font-size:1.3rem;font-weight:700;min-width:34px;text-align:center;
  font-variant-numeric:tabular-nums}
.toggle{display:inline-flex;align-items:center;gap:11px;cursor:pointer;
  font-family:var(--serif);font-style:italic;font-size:1.05rem}
.switch{width:46px;height:25px;border-radius:999px;background:#ded3c1;position:relative;
  transition:background .18s;flex:0 0 auto}
.switch::after{content:'';position:absolute;top:3px;left:3px;width:19px;height:19px;
  border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .18s}
.toggle input{display:none}
.toggle input:checked + .switch{background:var(--oxblood)}
.toggle input:checked + .switch::after{transform:translateX(21px)}
.saverow{margin-top:22px;display:flex;gap:14px;align-items:center}
.saverow .sublabel{margin-top:0}

.btn{display:inline-block;font-family:var(--serif);font-style:italic;font-size:1.05rem;
  padding:.46rem 1.15rem;border-radius:999px;cursor:pointer;background:var(--oxblood);
  color:var(--vellum-100);border:1px solid var(--oxblood);text-decoration:none;
  transition:background .16s}
.btn:hover{background:#6a3737}
.btn:disabled{opacity:.6;cursor:default}
.btn.ghost{background:none;color:var(--oxblood);border-color:rgba(125,66,66,.4)}
.btn.small{font-size:.95rem;padding:.32rem .9rem}
.coffee .btn.ghost{background:var(--coffee-700);color:var(--series);border-color:var(--card-line)}
.coffee .btn.ghost:hover{background:#40302a;border-color:var(--gold)}

.stack{display:flex;flex-direction:column;gap:18px}
.incident{border:1px solid rgba(215,189,137,.16);border-radius:6px;padding:16px 18px;
  background:rgba(51,38,32,.55)}
.incident + .incident{margin-top:14px}
.incident .top{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.incident .id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--taupe)}
.incident .sum{font-size:1rem;font-weight:600;margin:9px 0 4px;color:var(--vellum-100)}
.incident .meta{font-size:.8rem;color:var(--taupe)}
.incident .acts{margin-top:14px;display:flex;gap:12px}
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`
