# Contributing

Use LPM 0.76.5 and Node.js 22 or later for development.
The package runtime remains compatible with Node.js 18.

## Local checks

Install the locked dependencies:

```sh
lpm install --frozen-lockfile --strict-integrity --no-skills --no-editor-setup --no-security-summary --policy=deny
```

Run the release gate:

```sh
lpm run release:check
```

Check the local publication contents:

```sh
lpm publish --check --yes
```

The last command checks the package locally and does not upload it.
The release gate includes metadata, vulnerability and signature audits, types, coverage, builds, resource limits, and package consumers.

## Runtime and release checks

CI checks Node.js 18.20.8, 22, 24, and 26.
The Node 18 development install uses `--no-engine-strict` because some test dependencies require a newer runtime.
Runtime tests still run on Node 18.
The package has no production dependencies.

Keep `package.json`, each skill version, and the changelog version in agreement.
The tag check requires `v` followed by the exact package version.
The changelog describes nested grammar tokens and embedded grammar bundle costs for this release.

When you update dependencies, keep lockfile integrity, registry signatures, and publication timestamps.
After each update, run both security audits.
Do not substitute a successful install for a successful audit.
The package file allowlist includes documentation, skills, license files, and built output.

## Browser worker checks

The worker runtime and bundle checks are part of the release gate.
The browser harness additionally requires Chrome and Node.js 22 or later.
Set `CHROME_BIN` to select a Chrome executable outside the default macOS path.

```sh
lpm run test:worker-browser
```

Set `NEO_DEMOS_DIR` to a built demo checkout to include its preview and route-cleanup checks.
Set `NEO_WORKER_REPORT` to save the JSON result and demo screenshots in a local directory.
