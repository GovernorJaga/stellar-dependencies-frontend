# DependencyLens Frontend

Web UI for DependencyLens: see the open-source projects behind your JavaScript application and prepare a funding shortlist.

Version 0.2.0. Independent of Drips; no affiliation or funding guarantee.

This repository is one of three:

- **stellar-dependencies-frontend** (this repo): web UI
- **stellar-dependencies-backend**: API and GitHub/npm scanner
- **stellar-dependencies-contract**: optional Solidity `ShortlistRegistry`

## Included features

- Responsive interface, search and package selection.
- Report JSON and deduplicated shortlist JSON export.
- Clearly labeled offline demonstration (**Try sample data**). Demo packages and repository URLs are fictional.
- Visible caveat in the report noting that package metadata comes from each package's latest npm release and may differ from the installed version; the installed version is shown when the backend provides it.

## Project structure

- `public/`: HTML, styles, browser logic and exports.

```sh
npm run check   # JavaScript syntax check
```

Reports are returned by the backend to the requesting browser and are not persisted; export them to retain them.