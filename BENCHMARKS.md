# Benchmarks

Recorded throughput for the hot paths bounded or batched by issues #85 and #31.
Re-run the script after touching `src/core/evaluation` or
`src/core/communications/DataStorage` and update this file when the shape of
the results changes:

```
node scripts/benchmark-scoring.js --events 5000
```

## Report scoring (`evaluate`, value metric)

The legacy baseline is the pre-#31 implementation: a greedy first-match scan
with `splice` inside the inner loop, O(n·m) in the event counts. The current
implementation counts multiset matches through a hash map, O(n+m). Both sides
run inside this repository; the legacy copy lives only in the benchmark
script.

Workload: two synthetic runs over ~50 topics with mostly-matching values and
some noise (the realistic scoring case), scored per topic.

Source: `scripts/benchmark-scoring.js`. Recorded run below from this working
copy (Node v22.18.0, linux x64):

| events scored | legacy scan+splice | current `evaluate` | speedup |
| ------------- | ------------------ | ------------------ | ------- |
| 1,000         | 143.7 ms           | 2.8 ms             | 50.7x   |
| 5,000         | 1,396.0 ms         | 18.2 ms            | 76.6x   |
| 20,000        | 7,922.8 ms         | 60.9 ms            | 130.0x  |

The quadratic cost is also why scoring now reads events through a documented
bound: `updateReportScore` loads at most `MAX_SCORING_EVENTS` (10000) events
per dataset side, so scoring memory is proportional to that cap rather than to
the run length (issue #31, "bounded result sets").

## Event writes (`DataStorage.saveEvent`)

The data path used to open one document save per MQTT message — one driver
round trip per event by definition. Events now queue and flush as a single
`insertMany` when 50 documents queue up or 200 ms passes, whichever comes
first.

The table records the number of write calls the batching layer issues for a
burst (the dominant cost on a real deployment, where each call is a network
round trip) plus wall time against an in-memory stand-in for the driver.
Measure real-driver wall time on your own hardware before quoting absolute
numbers.

Source: same script. Recorded run (same machine as above):

| events enqueued | batch size | write calls issued |
| --------------- | ---------- | ------------------ |
| 5,000           | 50         | 2                  |
| 20,000          | 50         | 2                  |

For comparison, the unbatched behaviour issues exactly one write call per
event: 5,000 and 20,000 calls respectively. Failure handling changed with it:
a failed batch retries twice before its events are counted as dropped and
reported through the logger and the optional `onDrop` hook, instead of being
logged and forgotten per event.

## Log reads (`GET /api/logs/*/:fileName`, issue #85)

Bounded by design rather than benchmarked: without a `Range` header the
endpoint returns at most the last `LOG_READ_MAX_BYTES` (1 MiB) of the file, so
response memory no longer grows with the log; with a range the slice streams
straight from disk to the socket without buffering at all. See the constant's
comment in `src/server/routes/logs.js`.
