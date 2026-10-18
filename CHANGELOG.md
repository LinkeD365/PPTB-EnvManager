# Changelog

## [Unreleased]

### Bug Fixes

* [2026-10-18] handle empty and formatted organization settings XML without creating whitespace or comment settings
* [2026-10-18] recheck host connections and reviewed edits after preflight and before every save request; cancel on target changes
* [2026-10-18] clear stale policies on connection changes and surface policy-loading failures

### Documentation

* [2026-10-18] add a human testing checklist with maintainer-confirmed passing results and distinguish safe paging rejection from full pagination support
* [2026-10-18] document exact external metadata sources, AI assistance, and pre-submission acceptance checks
* [2026-10-18] add implementation reference and link it from the README
* [2026-10-18] document write effects, confirmation behavior, and upstream credits
* [2026-10-18] document asynchronous save regression suites and the remaining live PPTB acceptance checklist

### Features

* [2026-10-18] revalidate server values before writes, bundle API metadata, reject visibly paged lists, and render descriptions as text
* [2026-10-18] show write changes in a scrollable, five-line read-only field
* [2026-10-18] require target-and-scope confirmation before saving settings or governance policies
* [2026-10-18] validate and escape organization settings XML before update
* [2026-10-18] enable required Power Platform APIs and add automated test scripts
* [2026-10-18] add component tests for all React components

## [1.1.0](https://github.com/LinkeD365/PPTB-EnvManager/compare/1.0.2...1.1.0) (2026-10-13)


### Features

* update @pptb/types to 1.2.7 and support up to 5 connections ([978f64d](https://github.com/LinkeD365/PPTB-EnvManager/commit/978f64d691e7a45eead661d5494e212bfeb11631))

## [1.0.2](https://github.com/LinkeD365/PPTB-EnvManager/compare/1.0.1...1.0.2) (2026-09-23)


### Bug Fixes

* add missing period in project description ([81de1f1](https://github.com/LinkeD365/PPTB-EnvManager/commit/81de1f184e2b4f12c38e340ea7e53b5372811ae2))
* add missing period in project description ([121f993](https://github.com/LinkeD365/PPTB-EnvManager/commit/121f99305b321e676f4e50d4dcf1f52dad740ab1))
* harden release workflow dispatch ([521aea5](https://github.com/LinkeD365/PPTB-EnvManager/commit/521aea572c3a10d0727683d285967e5c9ff5170d))
* update screenshot link in README and enhance CSP requirements section ([0f6d7b4](https://github.com/LinkeD365/PPTB-EnvManager/commit/0f6d7b4fa9c7cdd420c21e45908d3faa5d8d23ad))
