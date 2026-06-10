# Liten & Co — Implementation Findings: portraits-bronze-spot-01

**Run:** `7db7d332-b344-4206-bf92-27f586052ba5` · **Series:** portraits · **Status:** complete · **Generated:** 2026-06-07
**Items:** 20 completed · **Spend:** $1.45

This document is generated from bench data and written to guide final-product decisions. Numbers first, synthesis second, raw samples last for audit.

## 1. Viability scorecard

| Metric | Actual | Target | Verdict |
|---|---|---|---|
| Intake accept rate | 91.7% | ≥ 75.0% | MEETS TARGET |
| Pass rate (accepted intakes) | 90.9% | ≥ 90.0% | MEETS TARGET |
| First-pass rate | 90.9% | ≥ 70.0% | MEETS TARGET |
| Aesthetic sub-5 share | 0.0% | ≤ 5.0% | MEETS TARGET |
| Cost per accepted render | $0.14 | judgment vs price point | — |

Counts: 8 redirected · 1 intake-rejected · 10 passed · 1 failed · 0 errored.

## 2. Matrix breakdown

| Cell (preset|location|scale) | Total | Pass rate | Avg fidelity | Avg aesthetic | Cost |
|---|---|---|---|---|---|
| bronze|realistic|pedestal|close_up | 20 | 90.9% | 8.18 | 9.00 | $1.73 |

Weakest cell: **bronze|realistic|pedestal|close_up** at 90.9% pass. Prioritize prompt work here.

## 3. Failure analysis & prompt recommendations

### face_drift — 1 fails (100.0% of all fails)

**Recommendation:** Match facial proportions to the source. · Align jawline precisely with the source.

<details><summary>Sample triage suggestions</summary>

- Enhance facial accuracy by matching facial proportions and jawline to the source.

</details>

## 4. What customers upload — classification & redirect

| Detected subject | Items |
|---|---|
| person_single | 12 |
| house_building | 2 |
| pet_animal | 2 |
| landscape_place | 2 |
| person_group | 2 |

Series mismatches: **8** of 20 classified (40.0%).
Redirect destinations: houses (2), pets (2), landscapes (2), groups (2).
Redirect accuracy: no human reviews yet — review a sample of redirected items in the UI before trusting the production gate.

## 5. Action items

1. [face_drift] Match facial proportions to the source. · Align jawline precisely with the source.
2. Human-review the 8 most recent redirected items to establish redirect accuracy before the production gate ships.
