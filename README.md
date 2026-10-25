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
- Visible caveat in the report noting that package metadata comes from each package's latest npm release and may differ from the installed version; the installed version is shown when the backend provides it.

## Project structure

- `public/`: HTML, styles, browser logic and exports.
- `scripts/serve.js`: zero-dependency local static server for `public/`.

```sh
npm start       # serve public/ locally at http://localhost:3000
npm run check   # JavaScript syntax check
```

## Local development

`npm start` runs a small static server written for Node 22 using only the standard library, so **no `npm install` is required**. It serves the contents of `public/` as the site root.

- **Port.** Listens on port `3000` by default; set `PORT` to override, e.g. `PORT=8080 npm start`.
- **Path traversal.** Request paths are resolved inside `public/`; any attempt to escape that directory (for example `../` sequences or encoded variants) is rejected with `403 Forbidden`.
- **SPA fallback.** Unknown paths that do not map to a file are served `index.html` with `200 OK`, matching the production SPA fallback described under [Hosting](#hosting).

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
3. **API origin.** The UI calls the backend at a separate origin. Configure the API base URL as described under [API base URL configuration](#api-base-url-configuration) and allow that origin in the CSP `connect-src` below.
4. **HTTPS only.** Serve the site over HTTPS so the API origin and all rendered `https:` links work without mixed-content warnings.

## API base URL configuration

The UI does not hardcode a backend host. The API base URL is read from a small runtime config, so pointing the UI at a different backend needs **no code change** — only a config edit.

The config lives in `public/config.js`, which is loaded before the browser logic:

```js
// public/config.js
window.DEPENDENCYLENS_CONFIG = {
  // Base URL of the backend API, without a trailing slash.
  // Leave empty to call the API on the same origin as the UI.
  apiBaseUrl: 'https://api.example.com',
};
```

- **Same origin.** Set `apiBaseUrl` to `''` (or omit it) to call the API on the UI's own origin.
- **Separate backend.** Set `apiBaseUrl` to the backend origin, e.g. `https://api.example.com`. Do not add a trailing slash.
- **Per environment.** Keep one `config.js` per environment (local, staging, production) and publish the matching file with the rest of `public/` at deploy time. Because it is a plain static file, it can also be swapped on the host without rebuilding.
- **Meta tag alternative.** If you prefer not to ship a config file, provide the value through a meta tag in `index.html` instead:

  ```html
  <meta name="dependencies-api-base-url" content="https://api.example.com" />
  ```

  The UI uses the meta tag when `window.DEPENDENCYLENS_CONFIG.apiBaseUrl` is not set.

When you change the API origin, also update the CSP `connect-src` entry below to match.

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

- `connect-src` must list the API origin configured in `public/config.js` (or the meta tag); add any additional API origins you use.
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
