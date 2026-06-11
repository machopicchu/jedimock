# Contributing to JediMock

Thanks for taking the time to contribute. JediMock is a small, focused tool and the bar for contributions is quality over quantity — a few well-considered changes beat a flood of noise.

---

## Licence agreement

JediMock is released under the [Business Source Licence 1.1](./LICENSE), which converts to MIT on January 1, 2030.

**By submitting a pull request, you agree that your contribution is made under the same BSL 1.1 terms.** This means:

- Your code becomes part of the Licensed Work
- It is subject to the same use limitations until the Change Date
- On January 1, 2030, it automatically becomes MIT along with the rest of the codebase

If you are not comfortable with these terms, please do not submit a contribution.

---

## What we're looking for

**Good fits:**
- Bug fixes with a clear reproduction case
- Accessibility improvements
- Performance improvements with measurable impact
- New features that fit the core use case — mocking APIs in DevTools, zero footprint

**Not a good fit:**
- Features that require a server, a build step, or an external dependency
- UI overhauls without prior discussion
- Changes that increase file size significantly without clear benefit

If you're unsure whether something is worth building, open an issue first and describe what you want to do. A quick conversation saves everyone time.

---

## How to contribute

### 1. Fork and clone

```bash
git clone https://github.com/your-username/jedimock.git
cd jedimock
```

No build step, no package install. Open `app.html` directly in your browser.

### 2. Make your changes

The codebase is a single HTML file (`app.html`) with an optional split build (`app.js` + `styles.css`). Edit `app.html` — the split files are generated from it.

Keep changes focused. One bug fix or one feature per pull request.

### 3. Test manually

Open `app.html` in Chrome or Edge. Test the specific flow you changed, and also:

- All five tools still work (Mock, Editor, Beautifier, Diff, Validator)
- Session persists across page reload
- Both Intercept and Async ID modes generate valid scripts
- No console errors

### 4. Open a pull request

- Target the `main` branch
- Write a clear title: what changed and why
- If it fixes a bug, link the issue or describe the reproduction steps
- If it adds a feature, explain the use case

---

## Code style

- Vanilla JS, no frameworks, no build tools
- Keep the single-file constraint — the app must work by opening `app.html` directly
- No external dependencies beyond the fonts already in use
- Match the existing naming conventions (`camelCase` for functions, `kebab-case` for CSS classes)
- Comments where the intent isn't obvious, not where the code speaks for itself

---

## Reporting bugs

Open a GitHub issue with:

1. What you did
2. What you expected
3. What actually happened
4. Browser and OS

A short screen recording or screenshot is worth a thousand words.

---

## Questions

Open an issue or email [machopicchu97@gmail.com](mailto:machopicchu97@gmail.com).
