#!/usr/bin/env python3
"""
measure-likeness.py

Measures likeness between a source photograph and a set of rendered images
using InsightFace (buffalo_l): ArcFace 512-d embedding cosine similarity,
plus scale-invariant facial geometry ratios derived from the 5-point
landmarks, plus the model's own age estimate.

RENDERS NOTHING. Reads images, writes one CSV and a console report.

Usage:
    python3 measure-likeness.py --source SRC.jpg --renders DIR [--out report.csv]

Render filenames are expected to carry the effect id as the leading token
before the first underscore-digit or extension, e.g.:
    coral.jpg  coral_01.jpg  iron_a1.jpg  sea_glass_02.jpg
Effect id is parsed as everything before a trailing _<digits> or _a<digits>.

Detection failure is a RESULT, not an error. An effect whose renders cannot
be detected as faces is reported as such.
"""

import argparse
import csv
import math
import os
import re
import sys
from collections import defaultdict

import numpy as np

try:
    import cv2
except ImportError:
    sys.exit("cv2 not available. pip install opencv-python-headless")

try:
    from insightface.app import FaceAnalysis
except ImportError:
    sys.exit("insightface not available. pip install insightface onnxruntime")


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

# Trailing attempt/index suffixes to strip when deriving the effect id.
SUFFIX_RE = re.compile(r"_(?:a?\d+)$", re.IGNORECASE)


def effect_id_from_filename(filename):
    stem = os.path.splitext(os.path.basename(filename))[0]
    prev = None
    while prev != stem:
        prev = stem
        stem = SUFFIX_RE.sub("", stem)
    return stem


def load_app(det_size=640):
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=-1, det_size=(det_size, det_size))
    return app


def largest_face(faces):
    """The hero subject is the biggest detected face."""
    if not faces:
        return None
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def detect(app, path, retry_sizes=(640, 512, 384, 256)):
    """
    Detect with progressively smaller det_size. Stylized renders often miss at
    640 and land at 320. Returns (face, det_size_used) or (None, None).
    """
    img = cv2.imread(path)
    if img is None:
        return None, None, None
    for size in retry_sizes:
        app.prepare(ctx_id=-1, det_size=(size, size))
        face = largest_face(app.get(img))
        if face is not None:
            return face, size, img.shape
    return None, None, img.shape


def geometry(face):
    """
    Scale- and rotation-tolerant facial proportions from the 5-point kps:
      0 left eye, 1 right eye, 2 nose tip, 3 left mouth, 4 right mouth.

    All measures are normalised by interocular distance, so they do not move
    with image size or crop. Returns None if kps are unavailable.
    """
    kps = getattr(face, "kps", None)
    if kps is None or len(kps) < 5:
        return None
    kps = np.asarray(kps, dtype=float)

    l_eye, r_eye, nose, l_mouth, r_mouth = kps[0], kps[1], kps[2], kps[3], kps[4]

    iod = float(np.linalg.norm(r_eye - l_eye))
    if iod < 1e-6:
        return None

    eye_mid = (l_eye + r_eye) / 2.0
    mouth_mid = (l_mouth + r_mouth) / 2.0

    x0, y0, x1, y1 = face.bbox
    box_w = float(x1 - x0)
    box_h = float(y1 - y0)

    # Perpendicular distance from nose to the eye line: asymmetry tell.
    eye_vec = r_eye - l_eye
    eye_unit = eye_vec / iod
    nose_rel = nose - eye_mid
    nose_lateral = float(np.dot(nose_rel, eye_unit))  # signed, along eye line

    return {
        "iod_px": iod,
        # Face length proxy: how far the mouth sits below the eyes.
        "eye_to_mouth_over_iod": float(np.linalg.norm(mouth_mid - eye_mid) / iod),
        # Nose length proxy.
        "eye_to_nose_over_iod": float(np.linalg.norm(nose - eye_mid) / iod),
        # Mouth width relative to eye spacing.
        "mouth_w_over_iod": float(np.linalg.norm(r_mouth - l_mouth) / iod),
        # Face width relative to eye spacing: the "widened / narrowed" measure.
        "box_w_over_iod": box_w / iod,
        # Overall face aspect.
        "box_aspect": box_h / box_w if box_w > 1e-6 else float("nan"),
        # Signed lateral nose offset: positive means shifted toward right eye.
        "nose_lateral_over_iod": nose_lateral / iod,
    }


# Which geometry keys get reported as deltas, and a human label for each.
GEOM_KEYS = [
    ("box_w_over_iod", "face width"),
    ("eye_to_mouth_over_iod", "face length"),
    ("eye_to_nose_over_iod", "nose length"),
    ("mouth_w_over_iod", "mouth width"),
    ("box_aspect", "face aspect"),
    ("nose_lateral_over_iod", "nose lateral offset"),
]


def cosine(a, b):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return float("nan")
    return float(np.dot(a, b) / (na * nb))


def pct_delta(src, ren):
    if src is None or ren is None:
        return float("nan")
    if abs(src) < 1e-9:
        return float("nan")
    return (ren - src) / abs(src) * 100.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="source photograph")
    ap.add_argument("--renders", required=True, help="directory of rendered images")
    ap.add_argument("--out", default="likeness-report.csv")
    ap.add_argument("--verdicts", default=None,
                    help="optional CSV of your own pass/fail: filename,verdict")
    args = ap.parse_args()

    if not os.path.isfile(args.source):
        sys.exit("source not found: %s" % args.source)
    if not os.path.isdir(args.renders):
        sys.exit("renders directory not found: %s" % args.renders)

    verdicts = {}
    if args.verdicts:
        with open(args.verdicts, newline="", encoding="utf-8") as fh:
            for row in csv.reader(fh):
                if len(row) >= 2 and row[0].strip():
                    verdicts[os.path.basename(row[0].strip())] = row[1].strip().lower()

    print("loading buffalo_l ...", file=sys.stderr)
    app = load_app()

    src_face, src_det_size, _ = detect(app, args.source)
    if src_face is None:
        sys.exit("NO FACE DETECTED IN SOURCE. Nothing can be measured against it.")
    src_geom = geometry(src_face)
    src_age = int(getattr(src_face, "age", -1) or -1)
    print("source: face found at det_size %d, estimated age %d"
          % (src_det_size, src_age), file=sys.stderr)

    files = sorted(
        f for f in os.listdir(args.renders)
        if os.path.splitext(f)[1].lower() in IMAGE_EXTS
    )
    if not files:
        sys.exit("no images found in %s" % args.renders)

    rows = []
    by_effect = defaultdict(list)

    for name in files:
        path = os.path.join(args.renders, name)
        eff = effect_id_from_filename(name)
        face, det_size, _shape = detect(app, path)

        row = {
            "file": name,
            "effect": eff,
            "detected": "no",
            "det_size": "",
            "cosine": "",
            "age_est": "",
            "age_delta": "",
            "verdict": verdicts.get(name, ""),
        }
        for key, _label in GEOM_KEYS:
            row["d_" + key] = ""

        if face is None:
            rows.append(row)
            by_effect[eff].append(row)
            continue

        row["detected"] = "yes"
        row["det_size"] = det_size
        row["cosine"] = round(cosine(src_face.normed_embedding,
                                     face.normed_embedding), 4)

        age = int(getattr(face, "age", -1) or -1)
        row["age_est"] = age
        if age >= 0 and src_age >= 0:
            row["age_delta"] = age - src_age

        g = geometry(face)
        if g and src_geom:
            for key, _label in GEOM_KEYS:
                row["d_" + key] = round(pct_delta(src_geom.get(key), g.get(key)), 1)

        rows.append(row)
        by_effect[eff].append(row)

    fieldnames = (["file", "effect", "detected", "det_size", "cosine",
                   "age_est", "age_delta", "verdict"]
                  + ["d_" + k for k, _ in GEOM_KEYS])
    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    # ---- console report ----------------------------------------------
    total = len(rows)
    detected = [r for r in rows if r["detected"] == "yes"]
    missed = [r for r in rows if r["detected"] == "no"]

    print()
    print("=" * 66)
    print("DETECTION")
    print("=" * 66)
    print("%d of %d renders yielded a detectable face." % (len(detected), total))
    if missed:
        print()
        print("NO FACE FOUND -- these effects may be outside what any face model")
        print("can measure. That is itself a finding.")
        miss_by_eff = defaultdict(int)
        for r in missed:
            miss_by_eff[r["effect"]] += 1
        for eff in sorted(miss_by_eff):
            n_tot = len(by_effect[eff])
            print("  %-22s %d/%d undetected" % (eff, miss_by_eff[eff], n_tot))

    if not detected:
        print("\nNothing further to report.")
        return

    print()
    print("=" * 66)
    print("COSINE SIMILARITY  (1.0 identical, ArcFace same-person ~0.3-0.4+)")
    print("=" * 66)
    eff_scores = defaultdict(list)
    for r in detected:
        eff_scores[r["effect"]].append(float(r["cosine"]))
    for eff in sorted(eff_scores, key=lambda e: -np.mean(eff_scores[e])):
        vals = eff_scores[eff]
        print("  %-22s mean %.3f   min %.3f   max %.3f   n=%d"
              % (eff, np.mean(vals), min(vals), max(vals), len(vals)))

    print()
    print("=" * 66)
    print("GEOMETRY DRIFT  (percent change vs source, mean per effect)")
    print("=" * 66)
    print("  %-22s %8s %8s %8s %8s"
          % ("effect", "width", "length", "nose", "mouth"))
    for eff in sorted(eff_scores):
        rs = [r for r in by_effect[eff] if r["detected"] == "yes"]

        def m(key):
            vals = [r["d_" + key] for r in rs if r["d_" + key] != ""]
            return np.mean(vals) if vals else float("nan")

        print("  %-22s %+7.1f%% %+7.1f%% %+7.1f%% %+7.1f%%"
              % (eff,
                 m("box_w_over_iod"),
                 m("eye_to_mouth_over_iod"),
                 m("eye_to_nose_over_iod"),
                 m("mouth_w_over_iod")))

    ages = [r["age_delta"] for r in detected if r["age_delta"] != ""]
    if ages:
        print()
        print("=" * 66)
        print("AGE DRIFT  (model estimate, render minus source)")
        print("=" * 66)
        print("  mean %+.1f years across %d renders" % (np.mean(ages), len(ages)))
        worst = sorted((r for r in detected if r["age_delta"] != ""),
                       key=lambda r: -abs(r["age_delta"]))[:8]
        for r in worst:
            print("  %-30s %+d years" % (r["file"], r["age_delta"]))

    # ---- agreement, only if verdicts were supplied --------------------
    scored = [r for r in detected if r["verdict"] in ("pass", "fail")]
    if scored:
        print()
        print("=" * 66)
        print("AGREEMENT WITH YOUR VERDICTS")
        print("=" * 66)
        passes = [float(r["cosine"]) for r in scored if r["verdict"] == "pass"]
        fails = [float(r["cosine"]) for r in scored if r["verdict"] == "fail"]
        print("  you PASSED %d: mean cosine %.3f" % (len(passes), np.mean(passes))
              if passes else "  no passes supplied")
        print("  you FAILED %d: mean cosine %.3f" % (len(fails), np.mean(fails))
              if fails else "  no fails supplied")

        if passes and fails:
            print()
            print("  Best threshold sweep -- how often cosine agrees with you:")
            best = (0, None)
            for i in range(20, 81):
                t = i / 100.0
                agree = sum(1 for r in scored
                            if (float(r["cosine"]) >= t) == (r["verdict"] == "pass"))
                if agree > best[0]:
                    best = (agree, t)
                if i % 5 == 0:
                    print("    cosine >= %.2f -> %d/%d" % (t, agree, len(scored)))
            print()
            print("  BEST: cosine >= %.2f agrees %d/%d (%.0f%%)"
                  % (best[1], best[0], len(scored),
                     100.0 * best[0] / len(scored)))
            base = max(sum(1 for r in scored if r["verdict"] == "pass"),
                       sum(1 for r in scored if r["verdict"] == "fail"))
            print("  BASE RATE (always guess the majority): %d/%d (%.0f%%)"
                  % (base, len(scored), 100.0 * base / len(scored)))
            print()
            if best[0] > base:
                print("  -> Beats the base rate. The signal is real.")
            else:
                print("  -> Does NOT beat always-guessing. Cosine alone is not enough.")

    print()
    print("CSV written: %s" % args.out)


if __name__ == "__main__":
    main()
