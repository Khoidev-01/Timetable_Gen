# Journal: 2026-09-18 — Happy-case timetable

---
date: 2026-09-18
session: happy-case timetable
---

## Context

Build and validate a realistic, re-importable school dataset and a feasible timetable that satisfies the school’s mandatory scheduling rules.

## What Happened

- Added a safe school-data reset that removes operational records while preserving administrator accounts and system configuration.
- Rebuilt the workbook with 30 classes, 73 teachers, 44 rooms including four yards, and 968 semester assignment records.
- Added a soft Thursday preference for HDTN/GDDP and mandatory rules requiring GDTC/GDQP in the opposite session and on different days, with no subject exceeding two consecutive periods.
- Passed 101 targeted tests and the backend production build.
- Generated and persisted all 930/930 timetable slots with zero hard violations. Of 120 HDTN/GDDP activities, 52 landed on Thursday; wrong-session, same-day GDTC/GDQP, and over-two-period run violations were all zero.
- Cleared the imported data after verification. The final database contained zero teachers, classes, rooms, assignments, and timetables while retaining administrator and system configuration.

## Reflection

The dataset proved feasible through a persisted end-to-end timetable, not only unit tests. The full backend suite passed 246/248 tests, with two unrelated stale-contract failures in `schedule.tools.spec.ts`; global lint also retains substantial pre-existing failures outside this scope.

## Decisions

| Decision | Rationale | Impact |
|---|---|---|
| Keep Thursday placement as a soft preference | Concentration is desirable but must not invalidate an otherwise feasible timetable | 52/120 activities landed on Thursday without hard violations |
| Keep opposite-session, different-day, and maximum-run rules mandatory | They express required school scheduling behavior | Invalid GDTC/GDQP placement and subject runs over two periods are rejected |
| Preserve admin and system configuration during reset | School data should be safely re-importable without rebuilding the application baseline | Operational data can be cleared independently |
| Leave the database empty after validation | Manual workbook import is the intended handoff state | No sample operational or timetable records remain |

## Next

- Import the workbook manually for the next validation or demonstration.
- Address the unrelated full-suite failures and repository-wide lint debt separately.
