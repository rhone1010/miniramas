# Liten & Co — Implementation Findings: portraits-bronze-spot-01

**Run:** `234f62b8-a165-465f-a836-cc6e7b9963ca` · **Series:** portraits · **Status:** complete · **Generated:** 2026-06-08
**Items:** 20 completed · **Spend:** $1.46

This document is generated from bench data and written to guide final-product decisions. Numbers first, synthesis second, raw samples last for audit.

## 1. Viability scorecard

| Metric | Actual | Target | Verdict |
|---|---|---|---|
| Intake accept rate | 75.0% | ≥ 75.0% | MEETS TARGET |
| Pass rate (accepted intakes) | 100.0% | ≥ 90.0% | MEETS TARGET |
| First-pass rate | 88.9% | ≥ 70.0% | MEETS TARGET |
| Aesthetic sub-5 share | 0.0% | ≤ 5.0% | MEETS TARGET |
| Cost per accepted render | $0.16 | judgment vs price point | — |

Counts: 8 redirected · 3 intake-rejected · 9 passed · 0 failed · 0 errored.

## 2. Matrix breakdown

| Cell (preset|location|scale) | Total | Pass rate | Avg fidelity | Avg aesthetic | Cost |
|---|---|---|---|---|---|
| bronze|realistic|pedestal|close_up | 20 | 100.0% | 8.33 | 9.00 | $1.46 |

Weakest cell: **bronze|realistic|pedestal|close_up** at 100.0% pass. Prioritize prompt work here.

## 3. Failure analysis & prompt recommendations

No categorized failures in this run.
## 4. What customers upload — classification & redirect

| Detected subject | Items |
|---|---|
| person_single | 12 |
| person_group | 2 |
| house_building | 2 |
| pet_animal | 2 |
| landscape_place | 2 |

Series mismatches: **8** of 20 classified (40.0%).
Redirect destinations: groups (2), houses (2), pets (2), landscapes (2).
Redirect accuracy: no human reviews yet — review a sample of redirected items in the UI before trusting the production gate.

## 5. Action items

1. Human-review the 8 most recent redirected items to establish redirect accuracy before the production gate ships.
