# Performance measurements

The current benchmark scripts measure the local build. They do not establish a universal speed or bundle-size lead.
Earlier throughput tables predate the current JavaScript grammar and renderer changes, so this report no longer presents them as current results.

## Runtime and output costs

```sh
lpm run build
lpm run bench:efficiency
```

The script prints JSON for the small, medium, and large JavaScript fixtures.
It compares inline output with class output and a shared GitHub Dark stylesheet.
Both modes use the same grammar, source, and theme, without line numbers or diff markers.

Each mode runs in three fresh Node.js processes. Each fixture has seven warm batches.
Import time, initialization, first-call time, and warm throughput are separate measurements.
Retained heap uses explicit garbage collection. Peak RSS includes the complete process and benchmark harness.

Output measurements include raw HTML, compressed HTML, and compressed HTML with one stylesheet.
A repeated-block measurement includes ten identical blocks and one stylesheet. Repeated source favors compression.
A single small block can transfer fewer bytes with inline output. Shared CSS becomes more useful as the page contains more code.

The script measures built Node.js package imports. These import measurements are not browser bundle measurements.
The script does not measure browser painting, hydration, or network latency.

## Other benchmarks

```sh
lpm run bench
```

The existing Vitest suites measure tokenization, rendering, and comparisons with Prism.js and highlight.js.
They remain useful as local diagnostics. Their timing does not establish equivalent grammar coverage.

For any external comparison, pin the engine version, languages, themes, input, and renderer options.
Measure browser bundles independently with a fixed bundler version, target, and compression configuration.
Compare source reconstruction and reviewed grammar expectations separately from runtime costs.

See [efficiency guidance](./docs/efficiency.md) for the output API and stylesheet requirements.
