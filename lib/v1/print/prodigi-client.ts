// lib/v1/print/prodigi-client.ts
//
// Thin fetch wrapper around the Prodigi Print API v4.
// Env-switches between sandbox and live based on PRODIGI_ENV.
//
// Auth:  X-API-Key header, separate keys per environment.
// Docs:  https://www.prodigi.com/print-api/docs/
//
// Required env vars:
//   PRODIGI_ENV         = 'sandbox' | 'live'   (default: 'sandbox')
//   PRODIGI_KEY_SANDBOX = <sandbox key from dashboard>
//   PRODIGI_KEY_LIVE    = <live key from dashboard>

const SANDBOX_BASE = 'https://api.sandbox.prodigi.com/v4.0'
const LIVE_BASE    = 'https://api.prodigi.com/v4.0'

// ── ENV ──────────────────────────────────────────────────────
function getConfig() {
  const env    = (process.env.PRODIGI_ENV || 'sandbox').toLowerCase()
  const isLive = env === 'live'
  const baseUrl = isLive ? LIVE_BASE : SANDBOX_BASE
  const apiKey  = isLive
    ? process.env.PRODIGI_KEY_LIVE
    : process.env.PRODIGI_KEY_SANDBOX
  if (!apiKey) {
    throw new Error(
      `Prodigi: missing ${isLive ? 'PRODIGI_KEY_LIVE' : 'PRODIGI_KEY_SANDBOX'} in env`
    )
  }
  return { baseUrl, apiKey, isLive }
}

// ── TYPES ────────────────────────────────────────────────────
export type ShippingMethod = 'Budget' | 'Standard' | 'Express' | 'Overnight'
export type Sizing         = 'fillPrintArea' | 'fitPrintArea' | 'stretchToPrintArea'

export interface Address {
  line1:           string
  line2?:          string
  postalOrZipCode: string
  countryCode:     string   // ISO-2: 'US', 'GB', 'CA', etc.
  townOrCity:      string
  stateOrCounty?:  string
}

export interface Recipient {
  name:          string
  email:         string
  phoneNumber?:  string
  address:       Address
}

export interface Asset {
  printArea: string        // 'default' for prints/posters
  url:       string        // MUST be publicly fetchable by Prodigi servers
  sizing?:   Sizing
}

export interface OrderItemRequest {
  sku:     string
  copies:  number
  sizing?: Sizing
  assets:  Asset[]
  recipientCost?: { amount: string; currency: string }
}

export interface OrderRequest {
  shippingMethod:     ShippingMethod
  recipient:          Recipient
  items:              OrderItemRequest[]
  idempotencyKey?:    string         // use Stripe session_id to dedupe webhook retries
  merchantReference?: string         // human-readable order number, OK to reuse for reprints
  metadata?:          Record<string, unknown>
  callbackUrl?:       string         // override per-order if needed; usually set in dashboard
}

export interface QuoteRequest {
  shippingMethod?:        ShippingMethod
  destinationCountryCode: string
  currencyCode?:          string
  items: Array<{
    sku:         string
    copies:      number
    attributes?: Record<string, string>
    assets?:     Array<{ printArea: string }>
  }>
}

export interface QuoteResponse {
  outcome: 'Ok' | string
  quotes: Array<{
    shipmentMethod: string
    costSummary: {
      items:      { amount: string; currency: string }
      shipping:   { amount: string; currency: string }
      totalCost?: { amount: string; currency: string }
      totalTax?:  { amount: string; currency: string }
    }
    shipments: Array<{
      carrier:             { name: string; service: string }
      fulfillmentLocation: { countryCode: string; labCode: string }
      cost:                { amount: string; currency: string }
      items:               string[]
    }>
    items: Array<{
      id:         string
      sku:        string
      copies:     number
      unitCost:   { amount: string; currency: string }
      attributes: Record<string, unknown>
      assets:     Array<{ printArea: string }>
    }>
  }>
}

export interface OrderResponse {
  outcome: 'Created' | 'Ok' | string
  order: {
    id:                 string
    created:            string
    lastUpdated:        string
    callbackUrl?:       string
    merchantReference?: string
    shippingMethod:     string
    idempotencyKey?:    string
    status: {
      stage:  'InProgress' | 'Complete' | 'Cancelled' | string
      issues: unknown[]
      details: {
        downloadAssets:             string
        printReadyAssetsPrepared:   string
        allocateProductionLocation: string
        inProduction:               string
        shipping:                   string
      }
    }
    charges:   unknown[]
    shipments: Array<{
      id:            string
      carrier:       { name: string; service: string }
      tracking?:     { number: string; url: string }
      dispatchDate?: string
      status:        string
      items:         Array<{ itemId: string }>
    }>
    recipient: Recipient
    items: Array<{
      id:                 string
      status:             string
      merchantReference?: string
      sku:                string
      copies:             number
      sizing:             string
      assets:             Asset[]
    }>
  }
}

// ── ERRORS ───────────────────────────────────────────────────
export class ProdigiError extends Error {
  constructor(
    message:      string,
    public status: number,
    public body:   unknown,
  ) {
    super(message)
    this.name = 'ProdigiError'
  }
}

// ── INTERNAL FETCH ───────────────────────────────────────────
async function call<T>(
  method: 'GET' | 'POST',
  path:   string,
  body?:  unknown,
): Promise<T> {
  const { baseUrl, apiKey, isLive } = getConfig()
  const url = `${baseUrl}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key':    apiKey,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let parsed: unknown
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }

  if (!res.ok) {
    console.error('[prodigi]', method, path, 'failed', {
      env:    isLive ? 'live' : 'sandbox',
      status: res.status,
      body:   parsed,
    })
    throw new ProdigiError(
      `Prodigi ${method} ${path} failed: ${res.status}`,
      res.status,
      parsed,
    )
  }

  return parsed as T
}

// ── PUBLIC API ───────────────────────────────────────────────

/**
 * GET /Products/{sku}
 * Returns product metadata: dimensions, print areas, available attributes.
 * Cache the result per SKU — these change rarely.
 */
export async function getProduct(sku: string) {
  return call<{ outcome: string; product: Record<string, unknown> }>(
    'GET',
    `/Products/${encodeURIComponent(sku)}`,
  )
}

/**
 * POST /Quotes
 * Returns shipping + total for a basket against a destination country.
 * Call this at cart-time, per cart change, server-side.
 */
export async function getQuote(req: QuoteRequest): Promise<QuoteResponse> {
  return call<QuoteResponse>('POST', '/Quotes', req)
}

/**
 * POST /Orders
 * Creates AND submits an order. No draft state exists in v4.
 *
 * Pass `idempotencyKey = <stripe_session_id>` so retried webhooks don't
 * place duplicate orders. Pass `merchantReference = <your_order_number>`
 * for human-readable tracking — it's reusable for reprints.
 */
export async function createOrder(req: OrderRequest): Promise<OrderResponse> {
  return call<OrderResponse>('POST', '/Orders', req)
}

/**
 * GET /Orders/{id}
 * Fetches current status. Prefer dashboard-configured webhook callbacks;
 * use this for on-demand sync or as fallback if a callback was missed.
 */
export async function getOrder(orderId: string): Promise<OrderResponse> {
  return call<OrderResponse>('GET', `/Orders/${encodeURIComponent(orderId)}`)
}

/**
 * POST /Orders/{id}/actions/cancel
 * Cancels before lab pickup. After production starts this returns an error.
 */
export async function cancelOrder(orderId: string) {
  return call<{ outcome: string }>(
    'POST',
    `/Orders/${encodeURIComponent(orderId)}/actions/cancel`,
  )
}

/**
 * Env diagnostic — exposed so the smoke-test script can confirm what it's hitting.
 */
export function getEnv() {
  const { baseUrl, isLive } = getConfig()
  return { env: isLive ? 'live' : 'sandbox', baseUrl }
}
