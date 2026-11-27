---
url: /vlo/performance.md
---
# Performance

Vlo does little work per step, and that work does not grow with the run. This page gives
the measured numbers, the setup they came from, and what they do not show.

**The headline result: resume time is flat.** A run with 20,018 events resumes as fast as a
run with 38.

## Why it is fast

* **One transaction per step.** The event, the new state and the next tasks commit
  together.
* **State is the snapshot.** One checkpoint per run is rewritten with every event, so a
  resume loads one row and checks one hash, however long the run is.
* **The journal is the queue.** A task is a row committed with the event. There is no
  broker hop, and a worker in the same process skips HTTP entirely.
* **Small rows.** Payloads over 256 KiB move to a content-addressed blob store.

## Setup

Read every number on this page together with this setup.

| | |
| --- | --- |
| Machine | Apple M2 laptop, 8 cores |
| Runtime | Node 24.6 |
| Date | 27 November 2026 |
| Journal | On the same machine in both columns: a SQLite file, and Postgres 14 over localhost |
| Workers | In-process |
| Resume figures | The median of 7 fresh processes each |

These are local engine numbers. There is no network between the host and the database, and
no replication. See [What these numbers are not](#what-these-numbers-are-not).

## Steps and workflows

| Measure | SQLite | Postgres 14 |
| --- | --- | --- |
| One step, committed, median | 0.33 ms | 0.96 ms |
| One step, committed, p99 | 0.65 ms | 1.62 ms |
| Steps per second, in sequence | About 3,000 | About 1,000 |
| A 3-step workflow, start to finish, median / p99 | 3.1 ms / 3.9 ms | 7.6 ms / 11.1 ms |
| A 5-step workflow, start to finish, median / p99 | 4.7 ms / 5.9 ms | 11.7 ms / 12.8 ms |
| Tasks completed across 2,000 separate runs, per second | 975 | 721 |
| Host start: load the kernel and open the journal | 2.3 ms | 9.0 ms |

## Resume

A resume here is a cold process loading a run and continuing it.

| Run length | SQLite | Postgres 14 |
| --- | --- | --- |
| 38 events | 7.7 ms | 10.5 ms |
| 2,018 events | 7.9 ms | 10.6 ms |
| 20,018 events | 7.7 ms | 10.7 ms |
| Worst case: full rebuild from the journal, 20,018 events | 464 ms | 468 ms |

The worst case is a rare path. It runs only when a checkpoint is missing or was written by a
different workflow build, and it costs about 23 microseconds per event. See
[reliability.md](./reliability.md#state-that-checks-itself).

## Footprint and idle cost

| Measure | Result |
| --- | --- |
| Kernel file size | 297,573 bytes |
| Kernel load time | 2.1 ms |
| Memory the kernel adds to a process | About 400 KB |
| Storage for one parked run | About 1.3 KB on SQLite, 2.0 KB on Postgres |
| Processes needed while 5,000 runs wait | 0 |

Ten thousand waiting runs are about 20 MB of rows on Postgres and no compute.

## What these numbers are not

* **They are not production numbers.** No figure here was measured with a network between
  the host and its database.
* **Step time follows the database round trip.** One step is about 15 database round trips,
  so step time is roughly 15 times the round trip. Against a remote Postgres with a 23 ms
  round trip, a step took 336 ms and a resume about 400 ms. Resume stayed flat there too:
  398 ms for a run with 30 events and 400 ms for one with 410. **Keep the host in the same
  region as its journal.**
* **Throughput is not a ceiling or a scale test.** The 721 tasks per second came from one
  laptop and one client starting runs in sequence. Vlo has not been load-tested on server
  hardware.
* **One very wide run is slow.** 1,000 tasks inside a single run finished at 45 per second,
  against 975 per second across separate runs. Per-task cost grows with the width of the
  run. This is a defect to fix; until then, put wide work in child runs with `fanOutRuns`.
  See [limits.md](./limits.md#known-weak-spots).
* **They are not a comparison.** Nothing here was measured against another engine on the
  same hardware, so these numbers do not show that Vlo is faster than anything else.

## How to read them

| Measure | Verdict | How to think about it |
| --- | --- | --- |
| Resume time as a run grows | Excellent | The line is flat. This is the result the design exists to produce. |
| Footprint | Excellent | Small enough that starting a process costs nothing noticeable. |
| Cost of waiting | Excellent | About 2 KB per parked run and no process. |
| One step | Good | About the cost of one small database transaction. Measured with no network, so it is a floor. |
| Small workflow, end to end | Good, with a caveat | Single-digit milliseconds on local Postgres, in an easy setup. |
| Worst-case rebuild | Acceptable | A rare path, about half a second for 20,018 events. |
| Throughput | Unproven | One laptop, one client. Not a scale test. |
| Database round trips per step | Weak | About 15. The largest lever on real-world speed. |
| Very wide fan-out in one run | Poor | A defect. Child runs avoid it today. |

## Practical guidance

1. Run the host in the same region as its journal, ideally the same network.
2. Use Postgres for anything beyond one process. SQLite is single-writer; see
   [limits.md](./limits.md#sqlite-is-single-writer).
3. Fan out wide work as child runs, not as hundreds of tasks in one run.
4. Keep state small, or compact long runs with `continue_as_new`. State over 256 KiB is
   read from the blob store on every event.
