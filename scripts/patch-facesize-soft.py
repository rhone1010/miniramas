#!/usr/bin/env python3
"""
Face size was a hard AND in the intake gate, so no strictness setting could
reach it — a source with a small face was rejected at strictness 10 and at
strictness 1 alike.

Calibration run 01 is not in dispute: small faces are the dominant face-drift
driver. So the finding is kept and only its severity changes. A small face now
costs three points off the intake score instead of failing outright. At the
strictness Rich runs for the soft launch a marginal photo gets through; a
genuinely tiny face still lands under the threshold and is still refused.

The resolution floor stays hard. It is a local measurement, not a model
opinion, and a source below it cannot be printed at any size.

Usage:  python scripts\\patch-facesize-soft.py
"""
import io
import os

PATH = os.path.join("lib", "bench", "bench-gates.ts")

OLD = """  const faceSizeOk = input.mode !== 'subject' || Boolean(parsed.face_size_ok ?? true)
  if (!faceSizeOk) reasons.unshift('face too small in frame for reliable likeness — crop closer')

  const passed = input.resolutionOk && faceSizeOk && score >= input.threshold"""

NEW = """  const faceSizeOk = input.mode !== 'subject' || Boolean(parsed.face_size_ok ?? true)
  if (!faceSizeOk) reasons.unshift('face is small in frame — likeness will hold better cropped closer')

  // Softened 2026-08-07 on Rich's ruling. This was `&& faceSizeOk`, which no
  // strictness setting could reach: a small face failed at 10 and at 1 alike.
  // The calibration finding stands, so it still costs — three points off a
  // ten-point score is heavy — but the dial now governs it like everything
  // else. A genuinely tiny face still lands under the threshold and is still
  // refused; a marginal one gets through at a loose setting.
  //
  // Note for CENG: the returned score now carries the penalty, so intake
  // scores logged after this date are not directly comparable with those
  // before it for sources where face_size_ok was false.
  const FACE_SIZE_PENALTY = 3
  const effectiveScore = faceSizeOk ? score : Math.max(1, score - FACE_SIZE_PENALTY)

  const passed = input.resolutionOk && effectiveScore >= input.threshold"""


def crlf(t):
    """The repo is CRLF. A pattern written with bare newlines never matches it,
    and a replace that silently does nothing is worse than one that fails."""
    return t.replace("\n", "\r\n")


def main():
    if not os.path.exists(PATH):
        raise SystemExit("FAIL: %s not found. Run this from the repo root." % PATH)

    with io.open(PATH, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    for old, new in ((OLD, NEW), (crlf(OLD), crlf(NEW))):
        n = doc.count(old)
        if n == 1:
            doc = doc.replace(old, new, 1)
            break
        if n > 1:
            raise SystemExit("FAIL: anchor matched %d times, expected 1" % n)
    else:
        raise SystemExit(
            "FAIL: anchor not found. The gate may already be patched, or the "
            "wording has changed. Nothing was written."
        )

    # the returned score must be the one the decision used
    doc = doc.replace("  return {\n    score,\n", "  return {\n    score: effectiveScore,\n", 1)
    doc = doc.replace("  return {\r\n    score,\r\n", "  return {\r\n    score: effectiveScore,\r\n", 1)

    # gates
    if "&& faceSizeOk &&" in doc:
        raise SystemExit("FAIL: the hard AND is still present")
    if "input.resolutionOk && effectiveScore >= input.threshold" not in doc:
        raise SystemExit("FAIL: new pass condition not written")
    if "score: effectiveScore" not in doc:
        raise SystemExit("FAIL: returned score still the unpenalised one")
    if "face_size_ok:  Boolean(parsed.face_size_ok ?? true)" not in doc:
        raise SystemExit("FAIL: face_size_ok signal was lost — it must still be logged")
    if "if (!input.resolutionOk) reasons.unshift('below resolution floor')" not in doc:
        raise SystemExit("FAIL: resolution floor rule was disturbed")

    with io.open(PATH, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % PATH)
    print("  face size: hard block -> %d-point penalty" % 3)
    print("  resolution floor: unchanged, still hard")
    print("  face_size_ok still recorded in signals")


if __name__ == "__main__":
    main()
