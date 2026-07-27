# Liten & Co — Implementation Findings: portraits-calibration-01

**Run:** `1d447703-330f-41cd-9e68-8945853406c5` · **Series:** portraits · **Status:** complete · **Generated:** 2026-06-07
**Items:** 399 completed · **Spend:** $52.08

This document is generated from bench data and written to guide final-product decisions. Numbers first, synthesis second, raw samples last for audit.

## 1. Viability scorecard

| Metric | Actual | Target | Verdict |
|---|---|---|---|
| Intake accept rate | 98.9% | ≥ 75.0% | MEETS TARGET |
| Pass rate (accepted intakes) | 95.3% | ≥ 90.0% | MEETS TARGET |
| First-pass rate | 87.3% | ≥ 70.0% | MEETS TARGET |
| Aesthetic sub-5 share | 0.0% | ≤ 5.0% | MEETS TARGET |
| Cost per accepted render | $0.15 | judgment vs price point | — |

Counts: 28 redirected · 4 intake-rejected · 346 passed · 17 failed · 4 errored.

## 2. Matrix breakdown

| Cell (preset|location|scale) | Total | Pass rate | Avg fidelity | Avg aesthetic | Cost |
|---|---|---|---|---|---|
| alabaster|realistic|pedestal|close_up | 99 | 96.7% | 8.10 | 8.96 | $13.62 |
| bronze|realistic|pedestal|close_up | 100 | 96.7% | 8.35 | 8.99 | $13.48 |
| impressionist|realistic|pedestal|close_up | 100 | 100.0% | 8.46 | 9.00 | $12.83 |
| mixed_metals|realistic|pedestal|close_up | 100 | 87.9% | 8.01 | 8.99 | $14.48 |

Weakest cell: **mixed_metals|realistic|pedestal|close_up** at 87.9% pass. Prioritize prompt work here.

## 3. Failure analysis & prompt recommendations

### face_drift — 12 fails (70.6% of all fails)

**Recommendation:** Ensure the rendered face closely matches the unique features of the source photo. · Accurately replicate the subject's facial expressions and structure. · Enhance facial details for improved likeness to the photograph.

<details><summary>Sample triage suggestions</summary>

- Create a bust preserving unique facial features and expressions.
- Ensure the sculpture captures the unique facial features and expression from the photograph.
- Enhance facial details for likeness to match the photo subject.
- Enhance facial fidelity to match the source's distinct expression and features.
- Ensure rendered face closely matches the unique features of the source person.

</details>

### other — 5 fails (29.4% of all fails)

**Recommendation:** (synthesis disabled — see samples)

## 4. What customers upload — classification & redirect

| Detected subject | Items |
|---|---|
| person_single | 367 |
| house_building | 8 |
| pet_animal | 8 |
| landscape_place | 8 |
| person_group | 4 |

Series mismatches: **28** of 395 classified (7.1%).
Redirect destinations: houses (8), pets (8), landscapes (8), groups (4).
Redirect accuracy: no human reviews yet — review a sample of redirected items in the UI before trusting the production gate.

## 5. Action items

1. [face_drift] Ensure the rendered face closely matches the unique features of the source photo. · Accurately replicate the subject's facial expressions and structure. · Enhance facial details for improved likeness to the photograph.
2. [other] (synthesis disabled — see samples)
3. Human-review the 20 most recent redirected items to establish redirect accuracy before the production gate ships.
