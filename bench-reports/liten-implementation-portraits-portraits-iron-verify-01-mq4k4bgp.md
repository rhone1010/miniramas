# Liten & Co — Implementation Findings: portraits-iron-verify-01

**Run:** `88b46dad-f169-490e-9c23-4cbab1937e6c` · **Series:** portraits · **Status:** complete · **Generated:** 2026-06-08
**Items:** 100 completed · **Spend:** $11.67

This document is generated from bench data and written to guide final-product decisions. Numbers first, synthesis second, raw samples last for audit.

## 1. Viability scorecard

| Metric | Actual | Target | Verdict |
|---|---|---|---|
| Intake accept rate | 89.0% | ≥ 75.0% | MEETS TARGET |
| Pass rate (accepted intakes) | 98.8% | ≥ 90.0% | MEETS TARGET |
| First-pass rate | 93.8% | ≥ 70.0% | MEETS TARGET |
| Aesthetic sub-5 share | 0.0% | ≤ 5.0% | MEETS TARGET |
| Cost per accepted render | $0.15 | judgment vs price point | — |

Counts: 8 redirected · 10 intake-rejected · 80 passed · 1 failed · 1 errored.

## 2. Matrix breakdown

| Cell (preset|location|scale) | Total | Pass rate | Avg fidelity | Avg aesthetic | Cost |
|---|---|---|---|---|---|
| iron|realistic|pedestal|close_up | 100 | 98.8% | 8.38 | 8.96 | $11.95 |

Weakest cell: **iron|realistic|pedestal|close_up** at 98.8% pass. Prioritize prompt work here.

## 3. Failure analysis & prompt recommendations

### other — 1 fails (100.0% of all fails)

**Recommendation:** (synthesis disabled — see samples)

## 4. What customers upload — classification & redirect

| Detected subject | Items |
|---|---|
| person_single | 91 |
| person_group | 2 |
| pet_animal | 2 |
| landscape_place | 2 |
| house_building | 2 |

Series mismatches: **8** of 99 classified (8.1%).
Redirect destinations: groups (2), pets (2), landscapes (2), houses (2).
Redirect accuracy: no human reviews yet — review a sample of redirected items in the UI before trusting the production gate.

## 5. Action items

1. [other] (synthesis disabled — see samples)
2. Human-review the 8 most recent redirected items to establish redirect accuracy before the production gate ships.
