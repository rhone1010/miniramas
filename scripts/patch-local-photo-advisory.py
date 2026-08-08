#!/usr/bin/env python3
"""
THE CHECK THAT WAS NOT THE GATE

The server was fixed this evening: six hard faults refuse, everything else
advises, and the model sees the full photograph rather than a thumbnail. The
refusals continued anyway, and no new row appeared in qa_log — because the
card Rich kept seeing was never coming from the gate.

`localPhotoCheck` measures average luminance and pixel variance in the
browser, in a canvas, before anything is sent anywhere. `faultState` then
reads those flags and refuses on its own authority:

    if (f && f.verySoft) return 6;
    if (f && f.dim)      return 7;

That is a mean brightness value overruling a vision model that had just
scored the same photograph 9 out of 10 and written "Subject is well-lit and
clearly visible". A mean is not a judgement. A photograph with a bright
window behind a well-lit face averages dark, and a photograph of a dark
jumper averages dark, and this could not tell them apart.

WHAT CHANGES

The local flags stop being a refusal and become what they always were: a
hint, available before the server answers. They still populate, they are
still logged, and `advisoryState` still reads them — so the two-button card
can say "this may be darker than ideal" without turning anyone away.

The server keeps the decision. It is the only part of this that looks at a
face rather than an average.

WHAT DOES NOT CHANGE

  · a file the browser cannot decode still fails, at state 8. That is not
    a judgement, it is a broken file.
  · `quality_verdict === 'red'` from analyze still fails.
  · every server-side refusal still refuses.

Usage:  python scripts\\patch-local-photo-advisory.py public\\portraits.html
"""
import io
import sys

OLD = """    var a = SRC.analyze || {};
    if (a.quality_verdict === 'red') return 8;
    var px = a.smallest_face_min_dim_px;
    if (px != null && px < FACE_WARN_RED_PX) return 5;
    var f = SRC.flags;
    if (f && f.verySoft) return 6;
    if (f && f.dim)      return 7;
    if (px != null && px < FACE_WARN_YELLOW_PX) return 5;
    if (f && f.soft)     return 6;
    return 0;
  }"""

NEW = """    var a = SRC.analyze || {};
    /* A file the browser could not decode. Not a judgement about a
       photograph — a broken file, and the one local fault that stands. */
    if (a.quality_verdict === 'red') return 8;

    /* ── WHY THE LOCAL FLAGS NO LONGER REFUSE · 2026-08-07 ────────────
       localPhotoCheck averages luminance and variance across the whole
       image in a canvas. Those two numbers were refusing photographs that
       the server had just scored 9/10 with "Subject is well-lit and
       clearly visible" — and because the refusal happened here, in the
       browser, no row was ever written to qa_log and the cause was
       invisible from the outside.

       A mean cannot tell a bright window behind a well-lit face from a
       genuinely dark room, and it never sees a face at all. The server
       does. So the flags advise and the server decides, which is Rich's
       spec of 2026-08-07 applied to the half of the gate that was still
       enforcing on its own.

       The flags are still computed and still read by advisoryState below,
       so the note survives — it is a note now rather than a wall. */
    return 0;
  }

  /* What to SAY about a photograph that is going ahead anyway. Same
     numbering as faultState, so one card serves both, but nothing here
     stops a craft. */
  function advisoryState(){
    var g = SRC.gate;
    if (g && g.status === 'advisory'){
      var raw = ((g.intake && g.intake.reasons) || []).join(' ').toLowerCase();
      if (/face|small|close|crop|distance|far/.test(raw))  return 5;
      if (/blur|sharp|focus|soft/.test(raw))               return 6;
      if (/dim|dark|light|expos|bright/.test(raw))         return 7;
      if (/resolution|smaller file/.test(raw))             return 5;
      return 0;
    }
    var a = SRC.analyze || {};
    var px = a.smallest_face_min_dim_px;
    if (px != null && px < FACE_WARN_RED_PX) return 5;
    var f = SRC.flags;
    if (f && f.verySoft) return 6;
    if (f && f.dim)      return 7;
    if (px != null && px < FACE_WARN_YELLOW_PX) return 5;
    if (f && f.soft)     return 6;
    return 0;
  }"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "advisoryState" in doc:
        raise SystemExit("Already applied. Nothing written.")

    for old, new in ((OLD, NEW), (crlf(OLD), crlf(NEW))):
        n = doc.count(old)
        if n == 1:
            doc = doc.replace(old, new, 1)
            break
        if n > 1:
            raise SystemExit("FAIL: matched %d times, expected 1" % n)
    else:
        raise SystemExit("FAIL: faultState tail not found. Nothing was written.")

    # gates
    if doc.count("function advisoryState()") != 1:
        raise SystemExit("FAIL: advisoryState not written exactly once")
    if "if (f && f.dim)      return 7;\n    if (px != null && px < FACE_WARN_YELLOW_PX)" in doc \
       and doc.count("if (f && f.dim)") != 1:
        raise SystemExit("FAIL: the local refusal survives in faultState")
    if doc.count("if (f && f.dim)") != 1:
        raise SystemExit("FAIL: expected the dim flag once, in advisoryState, found %d"
                         % doc.count("if (f && f.dim)"))
    if "if (a.quality_verdict === 'red') return 8;" not in doc:
        raise SystemExit("FAIL: the undecodable-file fault was lost")
    if "g.status === 'intake_rejected'" not in doc:
        raise SystemExit("FAIL: server refusals no longer refuse")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the browser's brightness average no longer refuses a photograph")
    print("  the server keeps the decision; it is the part that sees a face")
    print("  an undecodable file still fails, as it should")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-local-photo-advisory.py <file.html>")
    main(sys.argv[1])
