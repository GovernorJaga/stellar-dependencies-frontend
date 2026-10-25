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

## Security: untrusted package metadata

Package names, descriptions, maintainer usernames and repository URLs come from third parties and are never trusted:

- All rendered metadata is inserted with `textContent` (or equivalent escaping); no third-party value is written through `innerHTML` or other markup sinks.
- Only `https:` URLs are turned into links. Any other scheme (for example `javascript:`, `data:` or `http:`) is rendered as inert text.
- Crafted metadata therefore cannot inject markup or `javascript:` links into the UI.

## Hosting

The UI is a static site that talks to a separate API origin. It can be served from any generic static host (S3 + CloudFront, Netlify, Vercel, GitHub Pages, nginx, etc.).

1. **Build output.** The deployable artifact is the contents of `public/` (`index.html`, styles, browser logic and exports). There is no server-side build step; publish `public/` as the site root.
2. **SPA fallback.** Configure the host to serve `index.html` for unknown paths so client-side routes resolve on refresh and deep links:
   - nginx: `try_files $uri $uri/ /index.html;`
   - Netlify: `/* /index.html 200` in `_redirects`
   - Vercel: a rewrite of `/(.*)` to `/index.html`
   - GitHub Pages: copy `index.html` to `404.html`
3. **API origin.** The UI calls the backend at a separate origin. Set the API base URL at deploy time (build/runtime config) and allow that origin in the CSP `connect-src` below.
4. **HTTPS only.** Serve the site over HTTPS so the API origin and all rendered `https:` links work without mixed-content warnings.

## Content-Security-Policy

Serve the following response header (or equivalent `<meta http-equiv="Content-Security-Policy">`) and replace `https://api.example.com` with your API origin:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' https://api.example.com;
  object-src 'none';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

Notes:

- `connect-src` must list the API origin; add any additional API origins you use.
- `script-src 'self'` assumes no inline scripts; keep browser logic in external files.
- `object-src 'none'`, `base-uri 'none'` and `frame-ancestors 'none'` block plugin, base-tag and framing attacks.
- Tighten `img-src`/`font-src` if you do not use data URIs or self-hosted fonts.

## Accessibility

The UI targets WCAG 2.1 AA. Findings from the audit and the fixes applied:

- **Keyboard navigation.** All interactive controls (search, package selection, export buttons, sample-data toggle) are reachable and operable by keyboard; no keyboard traps.
- **Focus order and visibility.** DOM order matches visual order, and every focusable element has a visible focus indicator (no `outline: none` without a replacement).
- **Labels.** Inputs and buttons have programmatic labels (`<label for>`, `aria-label` or visible text); icon-only controls carry accessible names.
- **Contrast.** Text and UI components meet AA contrast ratios (4.5:1 for body text, 3:1 for large text and UI boundaries).
- **Results announcements.** Results and status updates are exposed through an `aria-live` region so screen readers announce them when they change.

Core flows (search, select, export) work with keyboard and screen reader.
