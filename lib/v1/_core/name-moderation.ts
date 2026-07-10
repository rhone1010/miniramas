// name-moderation.ts
// lib/v1/_core/name-moderation.ts
//
// Piece-name moderation — a TEXT gate, distinct from the image classifier in
// ./moderation.ts. A piece name becomes the human-readable `label` on a
// collection_pieces row and sits beside images of real people — often families
// and CHILDREN — so this gate is REQUIRED, and child-safety coverage is the
// category that actually matters, not just profanity.
//
// TWO-LAYER MATCHING (so we catch evasions without false-positiving real names):
//
//   1. BLOCKED_SUBSTR — genuinely unambiguous strings (slurs, explicit terms,
//      child-safety compounds) that never appear inside an innocent name.
//      Matched as a SUBSTRING of the boundary-less normalized form
//      (lowercase → fold leetspeak → strip every non-letter), so spaced/l33t
//      evasions like "f u c k" and "ch1ld p0rn" collapse onto their bare form
//      and are caught.
//
//   2. BLOCKED_WORD — short / embeddable terms that hide inside legitimate names
//      and places ("sex" in Essex/Sussex/Middlesex, "cunt" in Scunthorpe, "ass"
//      in Cassandra, "cum" in Cumming, "rape" in grape…). Matched as WHOLE WORDS
//      (\bterm\b) against a boundary-PRESERVING tokenization, so "Essex" passes
//      but a standalone "sex" still blocks. Tradeoff accepted: a spaced evasion
//      of a short word-layer term ("s e x") is not caught by this layer — but
//      those terms as a standalone token are the case that matters.
//
// The server is the HARD gate. portraits.html carries a MIRROR of this logic for
// instant re-prompt UX; if you edit the lists here, update that mirror too.

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '2': 'z',
}

function foldLeet(lower: string): string {
  let out = ''
  for (const ch of lower) out += LEET[ch] ?? ch
  return out
}

/** Boundary-less form: lowercase → fold leetspeak → strip everything but a–z. */
export function normalizeName(raw: string): string {
  return foldLeet((raw || '').toLowerCase()).replace(/[^a-z]/g, '')
}

/** Boundary-preserving form: lowercase → fold leetspeak → non-letters to single
 *  spaces → trim. Yields space-separated letter tokens for \bword\b matching. */
export function tokenizeName(raw: string): string {
  return foldLeet((raw || '').toLowerCase()).replace(/[^a-z]+/g, ' ').trim()
}

// LAYER 1 — unambiguous; substring-matched on the boundary-less form.
export const BLOCKED_SUBSTR: string[] = [
  // slurs (do not appear inside innocent names)
  'nigger', 'nigga', 'faggot', 'wetback', 'tranny', 'raghead', 'beaner',
  // strong profanity / explicit
  'fuck', 'motherfuck', 'bullshit', 'asshole', 'blowjob', 'handjob', 'cumshot',
  'gangbang', 'deepthroat', 'creampie', 'masturbat', 'ejaculat', 'dildo',
  'whore', 'porn', 'incest', 'orgasm', 'pussy', 'penis', 'vagina', 'boobs',
  'bestiality',
  // child-safety — the priority category. Explicit compounds, zero tolerance.
  'childporn', 'childsex', 'childabuse', 'childrape', 'kidporn', 'kidsex',
  'pedophile', 'paedophile', 'pedophilia', 'paedophilia', 'lolicon', 'shotacon',
  'jailbait', 'infantrape', 'toddlercon', 'minorporn', 'minorsex', 'preteen',
  'underage',
]

// LAYER 2 — short / embeddable; whole-word matched (\bterm\b) so they don't
// trip on real names/places. Includes short slurs and short child-safety tokens.
export const BLOCKED_WORD: string[] = [
  // sexual / profanity that embed in real words
  'sex', 'rape', 'cum', 'anal', 'dick', 'ass', 'tit', 'tits', 'hoe', 'slut',
  'prick', 'wank', 'twat', 'bollock', 'shit',
  // short slurs that embed in real words (coon→raccoon, spic→auspicious, etc.)
  'coon', 'spic', 'gook', 'kike', 'chink', 'cunt', 'retard', 'fag',
  // short child-safety tokens (standalone). 'cp' deliberately omitted — it
  // collides with innocent initials ("C.P."); the explicit compounds above and
  // pedo/loli below cover the real cases.
  'pedo', 'paedo', 'loli',
]

const WORD_RE = new RegExp(`\\b(${BLOCKED_WORD.join('|')})\\b`)

export interface NameCheck { ok: boolean; normalized: string; hit?: string }

// Normalize + two-layer disallowed test.
//   ok:false          → reject and re-prompt (never store, never reveal `hit`)
//   empty normalized  → ok:true; caller applies the neutral fallback label
export function checkName(raw: string): NameCheck {
  const normalized = normalizeName(raw)
  if (!normalized) return { ok: true, normalized }
  const sub = BLOCKED_SUBSTR.find((w) => normalized.includes(w))
  if (sub) return { ok: false, normalized, hit: sub }
  const m = WORD_RE.exec(tokenizeName(raw))
  if (m) return { ok: false, normalized, hit: m[1] }
  return { ok: true, normalized }
}

// Neutral fallback when the customer provides no name. NEVER the old plaque
// default string.
export const NEUTRAL_LABEL = 'Untitled portrait'
export const MAX_LABEL_LEN = 80

// Server-authoritative decision for what to store in collection_pieces.label:
//   { label }          → accept (trimmed original name, or NEUTRAL_LABEL if empty)
//   { rejected: true } → provided name failed moderation; caller returns a
//                        neutral "choose a different name" message, stores nothing
export function resolveLabel(raw: unknown): { label: string } | { rejected: true } {
  if (typeof raw !== 'string' || !raw.trim()) return { label: NEUTRAL_LABEL }
  const res = checkName(raw)
  if (!res.ok) return { rejected: true }
  return { label: raw.trim().slice(0, MAX_LABEL_LEN) }   // human original, capped
}
