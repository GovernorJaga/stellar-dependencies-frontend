# DependencyLens Frontend

Web UI for DependencyLens: see the open-source projects behind your JavaScript application and prepare a funding shortlist.

Version 0.2.0. Independent of Drips; no affiliation or funding guarantee.

This repository is one of three:

- **stellar-dependencies-frontend** (this repo): web UI
- **stellar-dependencies-backend**: API and GitHub/npm scanner
- **stellar-dependencies-contract**: optional Solidity `ShortlistRegistry`

## Included features

- Responsive interface, search and package selection.
- Report view with sorting (by name, license and version) and filtering (by license, repository mapping present, and selected state) to narrow large reports.
- Per-package lookup failures are surfaced in the report view with their reasons, plus a failures-only filter, so no lookup failure is silently dropped.
- Repository mappings are labeled as **publisher-reported** leads to review, not proof of verified ownership.
- Report JSON and deduplicated shortlist JSON export.
- Local report import: load a previously exported report JSON via a file picker. Import makes no network calls, validates the file structure, enforces a size cap, and shows clear errors for invalid files.
- Clearly labeled offline demonstration (**Try sample data**). Demo packages and repository URLs are fictional.

## Project structure

- `public/`: HTML, styles, browser logic and exports.

```sh
npm run check   # JavaScript syntax check
```

Reports are returned by the backend to the requesting browser and are not persisted; export them to retain them, and use the local import to reload an export later.