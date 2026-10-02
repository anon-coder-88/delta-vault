# DeltaVault

Responsive, front-end-only DeltaVault website: home, trade, vault directory, BTC/ETH vault detail, portfolio, token, documentation and risk routes. Uses the supplied Delta Aperture identity, locally hosted licensed fonts, a lazy-loaded Three.js aperture and Lightweight Charts.

## Run and verify

Use the repository's configured pnpm version. `pnpm dev` starts development and `pnpm build` produces the static export in `dist/client`.

- `node --import tsx --test tests/*.test.ts` tests accounting and public-data normalization.
- `node node_modules/typescript/bin/tsc --noEmit` checks types.
- `node node_modules/eslint/bin/eslint.js components/deltavault lib/deltavault app --quiet` checks authored application code.

## Behavior and boundaries

The simulator starts with 10,000 demo USD, persists a versioned ledger in browser local storage, validates all actions again at confirmation and rejects stale reviews. Positions close or liquidate only once. Deposits and withdrawals use the same cash and share records as portfolio views. Scenario prices are independent of public Coinbase reference data. Demo actions do not request wallet signatures or generate transaction hashes.

Injected wallets connect through Wagmi/Viem. Native ETH reads target Robinhood Chain Testnet (46630), through its public rate-limited RPC. Quote/candle reads use Coinbase Exchange public endpoints. Loading, unavailable, stale and retry states are explicit. No contracts, protocol indexer, ABIs, audit claims, token allocations or governance feeds are fabricated.

The sample fee and maintenance rules are disclosed in Documentation. This is a demonstration, not production financial execution. Real trading and vault writes require verified contracts and a separate integration scope.

## Verification limits

Type checks, accounting/data tests and static export were run during implementation. Initial browser preview navigation timed out. During the navigation repair, the actual production export was tested in the preview browser: homepage CTA, navbar-to-Portfolio navigation, wallet dialog, trade review/confirmation and persisted position history passed. The original production Link click failure was reproduced before replacing it. Full visual/keyboard/mobile checks, provider connection against an installed wallet, browser-origin CORS, WebMCP invocation, Core Web Vitals and cross-browser compatibility remain unverified. Responsive layouts, focus states, reduced motion and static/failed-WebGL fallback are implemented but should receive browser QA before public release.

## Static navigation

Page links use native anchors through `SiteLink`. The deployed Vinext RSC link runtime was reproduced throwing on prefetch and click despite successful builds. Browser navigation avoids that failing path and preserves links before hydration. Local-storage demo state survives page changes. Verify the production export, not only the development server, when changing navigation.

The shared `PageCurtain` plays an aperture entrance on every document load and a short cover before same-origin page navigation. It leaves hash links, external links, downloads, and modified clicks to the browser. The entrance animates away even before hydration; reduced-motion users see no curtain or navigation delay. Each new document then reveals its own content, while the demo ledger persists in local storage.
