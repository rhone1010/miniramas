// lib/v1/wallpapers/studio-round.ts
//
// ONE PLACE THAT KNOWS THERE ARE TWO VOCABULARIES.
//
// The general Studio and the Halloween Studio are the same product with
// different words. `season` selects which words, and everything downstream
// — the route, the generator — sees one validated choice and four prompts
// either way.
//
// This file exists so that neither vocabulary file has to import the other,
// and so the route does not grow a branch per season. Christmas in November
// is one more case here and one more data file, which is the whole point of
// treating a season as a vocabulary rather than a product.
//
// ── WHY THE HALLOWEEN BUILDER IS HERE AND NOT IN studio-halloween.ts ───
//
// That file is Rich's vocabulary. It carries the words, the axis
// discipline and the reasoning behind both. Assembly is a different job
// and it changes for different reasons — this is where a change to how a
// prompt is put together belongs, so a builder edit can never put a hand
// on the words.
//
// ── ENERGY IS SHARED, ON PURPOSE ───────────────────────────────────────
//
// Both rooms take Energy from studio-prompt.ts. It describes composition
// and motion, which do not become seasonal — a Surge is a Surge whether
// the world is Glass or Infernal. Duplicating it would mean two lists to
// keep in step and a spread function that has to ask which one it is
// walking.
//
// ── TWIST IS HALLOWEEN ONLY, AND ROLLED PER IMAGE ──────────────────────
//
// Not per round. The four in a round differ by Energy AND by twist, which
// is what stops the fifth press feeling exhausted. The customer never sees
// it and never chooses it.
//
// It also replaces the general room's composition-variant on the third
// tile: that tile exists to be the same Energy seen differently, and a
// different twist does that job better than a different camera.

import {
  ENERGIES,
  COMPOSITION,
  BASE,
  WORLDS, MOODS, PALETTES,
  buildRound,
  isValid,
  remix,
  type Choice,
  type EnergyId,
} from './studio-prompt'

import {
  HW_WORLDS, HW_MOODS, HW_PALETTES, HW_BASE,
  isHwValid,
  randomTwist,
  type HwChoice,
} from './studio-halloween'

export type StudioSeason = null | 'halloween'

/** What a round looks like by the time the route has it, regardless of
 *  which vocabulary produced it. */
export interface StudioRoundEntry {
  prompt:       string
  energy:       EnergyId
  /** What the page prints on the frame. It tags the four from its own copy
   *  of the spread while generating, then overwrites each with this — so
   *  if the two ever disagree, what was actually rendered wins. */
  energy_label: string
  /** Halloween only, and never shown. Logged so a good round can be
   *  explained after the fact. */
  twist:        string | null
}

export type ValidateResult =
  | { ok: true;  season: StudioSeason; choice: Choice | HwChoice }
  | { ok: false; got: Record<string, unknown> }

/**
 * Every id checked against the vocabulary the season selects.
 *
 * THIS IS THE ENTIRE SAFETY STORY FOR THE STUDIO. No prompt, no fragment
 * of one, no seed, no step count, no model name, no negative prompt —
 * whatever a future caller sends, whatever a browser is talked into
 * sending. Four dropdowns cannot be talked into anything, and that stops
 * being true the moment the browser is trusted with words that reach the
 * model.
 *
 * Nothing in this function reads a field it was not told to expect.
 */
export function validateStudioChoice(body: any): ValidateResult {
  const season: StudioSeason = body?.season === 'halloween' ? 'halloween' : null

  // Energy comes from the general list either way.
  const energy = pickId(ENERGIES, body?.energy)

  if (season === 'halloween') {
    const choice: Partial<HwChoice> = {
      world:   pickId(HW_WORLDS,   body?.world),
      mood:    pickId(HW_MOODS,    body?.mood),
      palette: pickId(HW_PALETTES, body?.palette),
      energy,
    }
    if (!isHwValid(choice)) return fail(body)
    return { ok: true, season, choice }
  }

  const choice: Partial<Choice> = {
    world:   pickId(WORLDS,   body?.world),
    mood:    pickId(MOODS,    body?.mood),
    palette: pickId(PALETTES, body?.palette),
    energy,
  }
  if (!isValid(choice)) return fail(body)
  return { ok: true, season, choice }
}

/**
 * The four prompts.
 *
 * General: studio-prompt's own buildRound, called rather than
 * reimplemented. The spread it produces — chosen Energy, one calmer, the
 * chosen Energy again, one wilder — looks wrong in a log the first time
 * (SURGE / FLOW / SURGE / ERUPTION) and is correct. Do not "fix" it here.
 *
 * Halloween: the same spread, assembled against the Halloween vocabulary,
 * with a twist rolled per image.
 */
export function buildStudioRound(
  season: StudioSeason,
  choice: Choice | HwChoice,
  remixId?: string,
): StudioRoundEntry[] {

  if (season !== 'halloween') {
    return buildRound(choice as Choice).map(r => ({
      prompt:       remixId ? remix(r.prompt, remixId) : r.prompt,
      energy:       r.energy,
      energy_label: labelFor(r.energy),
      twist:        null,
    }))
  }

  const c = choice as HwChoice

  return spreadEnergies(c.energy).map(energy => {
    const twist = randomTwist()
    const prompt = buildHwPrompt({ ...c, energy }, twist.body)
    return {
      prompt:       remixId ? remix(prompt, remixId) : prompt,
      energy,
      energy_label: labelFor(energy),
      twist:        twist.id,
    }
  })
}

// ─── HALLOWEEN ASSEMBLY ─────────────────────────────────────────

/**
 * Same order as the general room, for the same reason: base and
 * composition first, because a four-step model weights early tokens and
 * the wallpaper-ness has to survive being followed by five more sentences.
 *
 * COMPOSITION IS THE SHARED ONE, not a Halloween copy. It is the largest
 * quality lever in either room, it costs nothing per image, and two copies
 * would drift the first time one was improved.
 *
 * Twist goes last. It is a modifier on a scene that already exists, and
 * putting it earlier makes it compete with the World for what the picture
 * is of.
 */
function buildHwPrompt(c: HwChoice, twistBody: string): string {
  const w = HW_WORLDS.find(e => e.id === c.world)
  const m = HW_MOODS.find(e => e.id === c.mood)
  const e = ENERGIES.find(x => x.id === c.energy)
  const p = HW_PALETTES.find(x => x.id === c.palette)
  if (!w || !m || !e || !p) throw new Error('studio: unknown halloween vocabulary id')

  return [HW_BASE, COMPOSITION, w.body, m.body, e.body, p.body, twistBody]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The spread, matching studio-prompt's buildRound exactly.
 *
 * AT THE ENDS IT TURNS INWARD BY TWO RATHER THAN CLAMPING. Clamping was
 * tried in the general room and was wrong: at Stillness, "one calmer" is
 * Stillness again, so the round came back three near-identical images at
 * the setting most likely to be chosen first.
 *
 * Duplicated here rather than exported from studio-prompt because that
 * function also builds the general prompt. If the rule ever changes it has
 * to change in both places — which is the cost of not touching Rich's file
 * to add an export, and it is worth stating rather than hiding.
 */
function spreadEnergies(chosen: EnergyId): EnergyId[] {
  const i = ENERGIES.findIndex(e => e.id === chosen)
  if (i < 0) throw new Error('studio: unknown energy id')

  const last   = ENERGIES.length - 1
  const calmer = i === 0    ? i + 2 : i - 1
  const wilder = i === last ? i - 2 : i + 1

  return [i, calmer, i, wilder].map(n => ENERGIES[n].id)
}

// ─── SMALL HELPERS ──────────────────────────────────────────────

/** Returns the id only if it is in the list. Anything else becomes
 *  undefined and fails validation — the caller never gets to say what an
 *  id means. */
function pickId<T extends string>(list: { id: T }[], v: unknown): T | undefined {
  if (typeof v !== 'string') return undefined
  return list.find(e => e.id === v)?.id
}

function labelFor(energy: EnergyId): string {
  return ENERGIES.find(e => e.id === energy)?.label ?? String(energy)
}

/** The refusal echoes what was sent, so a stale cached page is diagnosable
 *  from the network tab rather than from a guess. */
function fail(body: any): ValidateResult {
  return {
    ok: false,
    got: {
      season:  body?.season,
      world:   body?.world,
      mood:    body?.mood,
      energy:  body?.energy,
      palette: body?.palette,
    },
  }
}
