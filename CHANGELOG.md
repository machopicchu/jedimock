# Changelog

## 1.3.10 — 2026-08-27

- Prepared a new cache-safe website release after the full local and hosted browser regression suites passed.
- Preserved the current application behavior while updating every website release marker and immutable asset URL.
- Packaged the website separately for GitHub Pages and Cloudflare Pages deployment.

## Browser extension 1.0.0 — public release — 2026-08-27

- Added focused quick mocking plus the complete Advanced setup workflow for fetch, XHR, Async ID, and Firebase v8 Firestore.
- Added response merging, request-body modification, headers, fallback behavior, per-call response rules, cURL import, local sharing, and import/export.
- Added a local saved-mocks library with one-click activation, editing, renaming, duplication, and deletion.
- Added explicit `{{id}}` substitution, searchable trigger-response paths, and legacy saved-mock compatibility.
- Added stable 390-pixel popup sizing, invalid-target protection, local-only storage, narrow permissions, and Chrome Web Store materials.
- Replaced the quiet footer support link with a full-width amber Support JediMock button, a proper vector coffee icon, clear free-use wording, and an occasional dismissible post-activation reminder.
- Passed the complete runtime, browser, privacy, accessibility, packaging, and release-check suites.

## 1.3.9 — 2026-08-27

- Added an optional, user-initiated Support JediMock link to the browser extension without gating any functionality.
- Documented the external Buy Me a Coffee destination in the extension listing and privacy materials.
- Updated the Chrome Web Store screenshot to the current 1280×800 listing requirement.
- Prepared and validated browser extension 1.1.3.

## 1.3.8 — 2026-08-27

- Replaced the system lightning emoji with the official JediMock icon on the extension privacy page.
- Updated the extension 1.1.2 popup, Advanced setup, and Chrome Web Store artwork to use the same packaged brand icon.

## 1.3.7 — 2026-08-27

- Added a public privacy policy and landing-page link for the Chrome Web Store release.
- Prepared the extension 1.1.1 store listing, privacy disclosures, submission assets, and final package checks.
- Kept the website application behavior unchanged from 1.3.6.

## 1.3.6 — 2026-08-27

- Corrected the site title and description across the landing page and application.
- Moved the compact workflow layout to 480px so the three-step guide cannot clip on narrow screens.
- Kept the Generate action in one stable row and removed the unnecessary 700px card-size jump.

## 1.3.5 — 2026-08-27

- Removed the 640px breakpoint that caused the workflow and Generate button to jump while resizing.
- Preserved the Generate button's normal height until the true phone layout at 420px.

## 1.3.4 — 2026-08-27

- Removed the awkward intermediate Generate-card layout between tablet and phone widths.
- Kept Generate and Regenerate visually consistent, using the standard primary color for both states.

## 1.3.3 — 2026-08-27

- Made the Generate script button compact and proportional on smaller screens while retaining a comfortable touch height.
- Kept the full-width action only on very narrow phone layouts.

## 1.3.2 — 2026-08-27

- Fixed the Copy script confirmation so repeated clicks always return the button to its normal state.
- Kept the Copy script button width stable while its label changes to Copied, on both desktop and compact layouts.

## 1.3.1 — 2026-08-26

- Clarified that users can stop a mock either with `JediMock.stop()` or by reloading the page.
- Kept the finish guide, Console message, and copy confirmation consistent.
- Re-recorded the landing-page walkthrough at 1320×840 as a polished 8.5-second loop with smooth scrolling, step labels, cursor feedback, the 401 scenario, and a longer copy-confirmation finish.

## 1.3.0 — 2026-08-26

- Added `JediMock.stop()` to generated scripts so active fetch, XHR, async, and Firestore mocks can be stopped without reloading the page.
- Added lowercase and uppercase stop aliases: `jedimock.stop()` and `JEDIMOCK.stop()`.
- Replaced the finish guide's reload instruction with the new stop command.
- Moved Reset this tab from Advanced setup into the tab controls where the action belongs.

## 1.2.1 — 2026-08-25

- Matched the generated-script finish guide to the app's existing workflow style, including numbered circles, connector lines, spacing, and responsive behavior.

## 1.2.0 — 2026-08-25

- Reworked the generated-script finish into three explicit steps: copy the script, paste it into DevTools Console, and reload the page to stop the mock.
- Kept Copy script as the single prominent action and made the finish guide responsive on narrow screens.

## 1.1.7 — 2026-08-25

- Removed manual resizing from the main mock-response JSON box so it cannot stretch and distort the workflow.
- Kept long JSON usable through scrolling inside the fixed-height editor.

## 1.1.6 — 2026-08-25

- Prevented the three-step workflow guide from overflowing its rounded container on phone-sized screens.
- Rebalanced the mobile stepper into flexible columns with wrapped labels and bounded connector lines.

## 1.1.5 — 2026-08-25

- Prevented duplicate automatic tab names after closing a tab and creating another.
- Preserved a tab's unique automatic number when its URL-derived name is cleared.
- Added browser regression coverage for middle-tab deletion and subsequent tab creation.

## 1.1.4 — 2026-08-25

- Kept the Generate button compact on small tablets and narrow desktop windows.
- Reserved the full-width Generate button for phone-sized screens at 420px and below.

## 1.1.3 — 2026-08-25

- Fixed the Test Lab's default POST example so Fetch and XHR send valid JSON immediately.
- Added explicit accessible names to the mock builder, response options, async setup, and JSON-tool form controls.
- Added release checks that prevent malformed Test Lab JSON and missing key control labels from returning.

## 1.1.2 — 2026-08-25

- Isolated the hosted QA harness so test tabs can never overwrite the real app session again.
- Added a narrow cleanup for the leaked “Share privacy QA” fixture from 1.1.1.
- Removed sticky positioning from Generate so it no longer covers response controls.
- Matched the Generate heading to the muted step styling used by steps 1 and 2.
- Restored compact collapsed spacing for Advanced setup at responsive widths.

## 1.1.1 — 2026-08-25

- Made full response override the default and renamed it “Return this JSON.”
- Moved the advanced “Modify real response” behavior out of the main response header and into Advanced setup.
- Preserved explicit response behavior in existing tabs while defaulting new, reset, imported legacy, and shared legacy tabs to full override.
- Clarified that fallback applies only while waiting for a real response in “Modify real response” mode.

## 1.1.0 — 2026-08-25

- Simplified the core mock workflow into three visible steps without removing any capabilities.
- Collapsed advanced mode and target controls into a compact summary that always shows the active configuration.
- Reduced visual noise by grouping secondary and custom scenarios under “More scenarios.”
- Added a complete working starter example for first-time users.
- Strengthened the generate-and-copy finish with persistent action placement and clearer confirmation.
- Added browser regression coverage for the simplified first-use journey.

## 1.0.0 — 2026-08-25

- Promoted the verified release candidate after all core, release, deployment, desktop, mobile, and hosted browser checks passed.
- No product behavior changed from `1.0.0-rc.1`; this promotion freezes the tested candidate as the first major release.

## 1.0.0-rc.1 — 2026-08-25

- Added HTTP method matching and Exact, Contains, and Pattern URL modes behind a simple “Change” control.
- Added a live request matcher preview and context-aware visibility for fallback and response rules.
- Corrected fetch and XHR matching, fallback, request editing, response rules, persistence, sharing, and import edge cases.
- Renamed “Timeout” to “Very slow (30s)” so the preset accurately describes its behavior.
- Added cache-versioned assets, production security headers, deployment verification, and automated release checks.
- Removed remote font requests, isolated external links, warned before placing tab data in share URLs, and improved keyboard focus and dialog accessibility.
- Expanded automated coverage across core helpers and real browser flows.

This is the release candidate for JediMock 1.0.0. Promote it only after the hosted URL passes the deployment and browser suites without regressions.
