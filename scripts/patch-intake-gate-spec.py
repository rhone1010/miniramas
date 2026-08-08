#!/usr/bin/env python3
"""
THE INTAKE GATE, TO RICH'S SPEC

Photographs that are plainly fine have been refused. Three separate causes,
all in this one file.

**1 · The model was judging a thumbnail.**
`detail: 'low'` downsamples the image to roughly 512px before it reaches the
model. It was then asked whether the photograph is sharp and well lit. It
was answering about a thumbnail, and a thumbnail of a good photograph looks
soft and flat. This is the likeliest single cause of what Rich has been
hitting, and it is one word.

**2 · The signals were collected and never used.**
`sharpness_ok`, `lighting_ok`, `occlusion_ok`, `subject_count` have been
returned, recorded in qa_log, and read by nothing. The decision was
`score >= threshold` and nothing else — so a composite number stood in for
six specific judgements, and a photo could fail on a 5 with no identifiable
fault. That is what made it feel arbitrary. It was arbitrary.

**3 · Booleans cannot express severity.**
"Somewhat dark" and "facial detail is lost to exposure" are different
answers and `lighting_ok:false` is the only one available for both. The
prompt now asks for a three-step severity on each concern — good, minor,
severe — so the rules can separate advice from refusal.

WHAT THE RULES NOW ARE — Rich's spec, verbatim

  HARD FAIL, and only these:
    no face detected · more than one primary subject · face too small to
    preserve likeness · severe blur · major features obscured · facial
    detail genuinely lost to exposure · unreadable file

  ADVISORY, never a refusal:
    somewhat dark · somewhat soft · smaller than ideal · strongly angled
    pose · minor obstruction · lower resolution than ideal

  The overall score is informational. It does not override the rules.

Two consequences worth stating plainly.

**The strictness dial no longer refuses anyone on its own.** It sets the bar
at which a photo is called advisory rather than clean, and it can no longer
turn a usable photograph away. Refusals now come only from the six hard
faults. That is the point of the change.

**The resolution floor stops being a hard fail.** Rich's spec is explicit:
resolution alone should not fail an image unless the face crop is too small.
It becomes advisory, and face size continues to carry the real decision.

Usage:  python scripts\\patch-intake-gate-spec.py
"""
import io
import os

GATES = os.path.join("lib", "bench", "bench-gates.ts")
SHARED = os.path.join("lib", "bench", "bench-shared.ts")
GATE_ROUTE = os.path.join("app", "api", "v1", "portraits", "gate", "route.ts")

OLD_ROUTE = "    const status = intake.passed ? 'passed' : 'intake_rejected'"
NEW_ROUTE = """    /* Three outcomes now, not two. `intake_rejected` is reserved for the
       six hard faults; an advisory is a usable photograph with a note,
       and the customer is shown a choice rather than a wall. A caller
       that has not been taught 'advisory' reads it as not-rejected,
       which is the safe direction. */
    const status =
      intake.verdict === 'fail'     ? 'intake_rejected' :
      intake.verdict === 'advisory' ? 'advisory' : 'passed'"""

OLD_ROUTE_BODY = """    return NextResponse.json({
      status,
      intake: { score: intake.score, reasons: intake.reasons },
    })"""
NEW_ROUTE_BODY = """    return NextResponse.json({
      status,
      intake: {
        score:   intake.score,
        reasons: intake.reasons,
        verdict: intake.verdict,
        signals: intake.signals,
      },
    })"""



# ── 1 · the prompt asks for severity ──────────────────────────────────
OLD_PROMPT_TAIL = '''Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": <boolean>,
  "face_size_ok": <boolean>,
  "sharpness_ok": <boolean>,
  "lighting_ok": <boolean>,
  "occlusion_ok": <boolean>,
  "subject_count": <integer>,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}'''

NEW_PROMPT_TAIL = '''Judge each concern on a three-step scale, because the difference between
"not ideal" and "unusable" decides whether this customer is turned away.

  "good"   — no meaningful issue
  "minor"  — noticeably short of ideal, and the face is still fully readable
  "severe" — facial information is genuinely lost and cannot be recovered

Reserve "severe" for photographs where the likeness itself is unavailable:
a face lost to darkness or blown highlights, motion blur that erases
features, a face largely hidden. A photograph that is simply darker or
softer than you would choose is "minor". Most ordinary photographs taken
indoors are "minor" at worst.

Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": <boolean>,
  "face_size": <"good" | "minor" | "severe">,
  "sharpness": <"good" | "minor" | "severe">,
  "lighting": <"good" | "minor" | "severe">,
  "occlusion": <"good" | "minor" | "severe">,
  "pose_extreme": <boolean, true only if the head is turned so far that one
                   eye is not visible>,
  "subject_count": <integer, how many people are a primary subject>,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}'''

OLD_PLACE_TAIL = '''Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": false,
  "face_size_ok": true,
  "sharpness_ok": <boolean>,
  "lighting_ok": <boolean>,
  "occlusion_ok": <boolean>,
  "subject_count": 1,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}'''

NEW_PLACE_TAIL = '''Judge each concern as "good", "minor" or "severe". Reserve "severe" for
photographs where the structure itself cannot be read.

Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": false,
  "face_size": "good",
  "sharpness": <"good" | "minor" | "severe">,
  "lighting": <"good" | "minor" | "severe">,
  "occlusion": <"good" | "minor" | "severe">,
  "pose_extreme": false,
  "subject_count": 1,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}'''

# ── 2 · the model sees the photograph, not a thumbnail ────────────────
OLD_DETAIL = ("        { type: 'image_url', image_url: { url: "
              "`data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'low' } },")
NEW_DETAIL = """        /* 'low' downsamples to about 512px. The model was being asked
           whether a photograph is sharp and well lit, and answering about
           a thumbnail — which is soft and flat however good the original
           is. Intake is the one gate that turns a paying customer away;
           it sees the real image. */
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'high' } },"""

# ── 3 · the decision ──────────────────────────────────────────────────
OLD_DECISION_START = "  const score = Math.max(1, Math.min(10, Number(parsed.score) || 5))"
OLD_DECISION_END = "    costCents: COST_CENTS.gpt4o_mini_score,\n  }\n}"

NEW_DECISION = '''  const score = Math.max(1, Math.min(10, Number(parsed.score) || 5))
  const reasons: string[] = Array.isArray(parsed.reasons)
    ? parsed.reasons.slice(0, 3).map((r: unknown) => String(r).slice(0, 160))
    : ['intake parse failed, defaulting to neutral 5']

  /* ── SEVERITY ─────────────────────────────────────────────────────
     Three steps, not a boolean. 'somewhat dark' and 'the face is lost to
     exposure' were both lighting_ok:false, and the gate could not tell
     them apart — so it treated advice as refusal. Anything unrecognised
     reads as 'good': a scorer that returns nonsense must not refuse a
     customer. */
  const sev = (v: unknown): 'good' | 'minor' | 'severe' => {
    const s = String(v || 'good').toLowerCase()
    return s === 'severe' ? 'severe' : s === 'minor' ? 'minor' : 'good'
  }

  const isSubject   = input.mode === 'subject'
  const faceVisible = isSubject ? Boolean(parsed.face_visible ?? true) : true
  const faceSize    = isSubject ? sev(parsed.face_size) : 'good'
  const sharpness   = sev(parsed.sharpness)
  const lighting    = sev(parsed.lighting)
  const occlusion   = sev(parsed.occlusion)
  const poseExtreme = Boolean(parsed.pose_extreme ?? false)
  const subjects    = Math.max(1, Number(parsed.subject_count) || 1)

  /* ── HARD FAIL · Rich's spec, 2026-08-07 ──────────────────────────
     These six and nothing else. A photograph is refused only when the
     likeness genuinely cannot be recovered from it. Everything short of
     that is advice, and advice does not turn a customer away. */
  const hardFail =
    (isSubject && !faceVisible) ||
    (isSubject && subjects > 1) ||
    faceSize  === 'severe' ||
    sharpness === 'severe' ||
    occlusion === 'severe' ||
    lighting  === 'severe'

  /* ── ADVISORY ─────────────────────────────────────────────────────
     Usable, not ideal. The resolution floor lives here now rather than in
     hardFail: the spec is explicit that resolution alone must not refuse
     an image unless the face crop itself is too small, and face size is
     judged separately above. */
  const advisory =
    !hardFail && (
      faceSize  === 'minor' ||
      sharpness === 'minor' ||
      lighting  === 'minor' ||
      occlusion === 'minor' ||
      poseExtreme ||
      !input.resolutionOk ||
      score < input.threshold
    )

  if (isSubject && !faceVisible)  reasons.unshift('no face found in this photograph')
  if (isSubject && subjects > 1)  reasons.unshift('more than one person is a primary subject')
  if (faceSize  === 'severe') reasons.unshift('the face is too small to hold a likeness')
  if (sharpness === 'severe') reasons.unshift('the face is too blurred to read')
  if (occlusion === 'severe') reasons.unshift('the face is largely hidden')
  if (lighting  === 'severe') reasons.unshift('facial detail is lost to the exposure')
  if (!hardFail && !input.resolutionOk) reasons.push('smaller file than ideal')
  if (!hardFail && poseExtreme) reasons.push('the head is turned a long way from camera')

  const verdict: 'pass' | 'advisory' | 'fail' =
    hardFail ? 'fail' : advisory ? 'advisory' : 'pass'

  /* `passed` stays true for an advisory. Every caller reads it as "may
     this craft proceed", and under this spec an advisory proceeds. A
     caller that wants the distinction reads `verdict`. */
  const passed = !hardFail

  return {
    score,
    passed,
    verdict,
    reasons,
    signals: {
      face_visible:  faceVisible,
      face_size_ok:  faceSize === 'good',
      sharpness_ok:  sharpness === 'good',
      lighting_ok:   lighting === 'good',
      occlusion_ok:  occlusion === 'good',
      subject_count: subjects,
      resolution_ok: input.resolutionOk,
    },
    costCents: COST_CENTS.gpt4o_mini_score,
  }
}'''

# ── 4 · the type ──────────────────────────────────────────────────────
OLD_TYPE = """export interface IntakeResult {
  score:    number              // 1-10 composite usability
  passed:   boolean
  reasons:  string[]            // human-readable notes, pass or fail"""

NEW_TYPE = """export interface IntakeResult {
  score:    number              // 1-10 composite usability, informational only
  passed:   boolean             // may the craft proceed. true for an advisory.
  /* Three outcomes, Rich's spec 2026-08-07. `passed` answers "may this go
     ahead"; `verdict` says on what terms. An advisory is usable and is
     shown to the customer as a choice, never as a refusal. */
  verdict:  'pass' | 'advisory' | 'fail'
  reasons:  string[]            // human-readable notes, pass or fail"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main():
    for f in (GATES, SHARED):
        if not os.path.exists(f):
            raise SystemExit("FAIL: %s not found. Run from the repo root." % f)

    with io.open(GATES, encoding="utf-8", newline="") as fh:
        g = fh.read()
    if "verdict" in g:
        raise SystemExit("Already applied. Nothing written.")

    g = swap(g, "the subject prompt", OLD_PROMPT_TAIL, NEW_PROMPT_TAIL)
    g = swap(g, "the place prompt", OLD_PLACE_TAIL, NEW_PLACE_TAIL)
    g = swap(g, "the image detail", OLD_DETAIL, NEW_DETAIL)

    # the whole decision block, start to the close of scoreIntake
    for a, b, new in ((OLD_DECISION_START, OLD_DECISION_END, NEW_DECISION),
                      (crlf(OLD_DECISION_START), crlf(OLD_DECISION_END), crlf(NEW_DECISION))):
        i = g.find(a)
        j = g.find(b, i)
        if i > -1 and j > -1:
            g = g[:i] + new + g[j + len(b):]
            break
    else:
        raise SystemExit("FAIL: the decision block was not found. Nothing written.")

    with io.open(SHARED, encoding="utf-8", newline="") as fh:
        s = fh.read()
    s = swap(s, "IntakeResult", OLD_TYPE, NEW_TYPE)

    # gates
    # Two calls in this file use detail. Only the intake one changes: the
    # aesthetic scorer judges composition and lighting drama on a finished
    # render, which read perfectly well small. Full detail there would be
    # paying for a judgement that does not need it.
    if g.count("detail: 'high'") != 1:
        raise SystemExit("FAIL: intake detail not set exactly once")
    if "sourceImageB64}`, detail: 'low'" in g:
        raise SystemExit("FAIL: intake is still sending a thumbnail")
    if "const hardFail" not in g or "const advisory" not in g:
        raise SystemExit("FAIL: the three outcomes were not written")
    if "score >= input.threshold" in g:
        raise SystemExit("FAIL: the old score-only decision survives")
    if g.count("'pass' | 'advisory' | 'fail'") != 1:
        raise SystemExit("FAIL: verdict type missing from the scorer")
    if "MIN_LONG_EDGE_PX" not in g:
        raise SystemExit("FAIL: the resolution floor constant was lost")

    with io.open(GATES, "w", encoding="utf-8", newline="") as fh:
        fh.write(g)
    with io.open(SHARED, "w", encoding="utf-8", newline="") as fh:
        fh.write(s)

    # the route, if it is where it should be
    if os.path.exists(GATE_ROUTE):
        with io.open(GATE_ROUTE, encoding="utf-8", newline="") as fh:
            r = fh.read()
        if "intake.verdict" not in r:
            r = swap(r, "the gate route status", OLD_ROUTE, NEW_ROUTE)
            r = swap(r, "the gate route body", OLD_ROUTE_BODY, NEW_ROUTE_BODY)
            if r.count("'advisory'") < 1:
                raise SystemExit("FAIL: the route does not report an advisory")
            with io.open(GATE_ROUTE, "w", encoding="utf-8", newline="") as fh:
                fh.write(r)
            print("  gate route now reports pass / advisory / fail")
    else:
        print("  NOTE: %s not found; the route still reports two outcomes" % GATE_ROUTE)

    print("Patched %s and %s" % (GATES, SHARED))
    print("  the model now sees the photograph, not a 512px thumbnail")
    print("  six hard faults refuse; everything else is advice")
    print("  the strictness dial can no longer turn a usable photo away")
    print("  resolution is advisory; face size carries the decision")


if __name__ == "__main__":
    main()
