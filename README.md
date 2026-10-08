# Songs of Creation map

A shared hex map for the *Songs of Creation* play-by-post game. Play happens in Discord; after each post, a player updates this map so it shows the world as that post left it.

It is built phone first and one-handed: drag to move, tap a hex to change it, hold to add more hexes, and publish your changes as a post when you are done.

## What's here

| Path | What it is |
| --- | --- |
| `src/app.html` | The whole app: markup, styles and script in one file. |
| `tests/*.spec.js` | Regression tests that drive the app like a player on a phone. |
| `tests/support/serve.js` | Serves the app inside the same minimal page skeleton the claude.ai viewer adds. |
| `tests/support/mock-claude.js` | A stand-in for the claude.ai runtime: an in-memory shared store and a signed-in player. |
| `.github/workflows/tests.yml` | Runs the tests on every push, in phone-sized Chromium and WebKit (Safari's engine). |

## Where it runs today

`src/app.html` is published as a claude.ai Artifact. Shared state (posts, peoples, custom lands, the current age) lives in that Artifact's database, which needs players to be signed in to Claude. Moving to a standalone site means swapping that storage for another backend (for example Firebase) and adding a no-account way to pick a player name. The `window.claude.use("db")` and `use("user")` calls are the only places that touch it.

Without the claude.ai runtime the app still opens and works, keeping changes on the current device only.

## Running the tests

```sh
npm install
npx playwright install chromium webkit   # first time only
npm test                                  # both engines
npm run test:chromium                     # Chromium only
```

`npm run serve` serves the app at http://localhost:4173 for trying it in a browser.

## How the map is stored

- A **post** is `{ by, at, changes }`, where `changes` maps a hex id (`h<col>_<row>`) to the fields that post set: `t` land, `n` natures, `p` people, `r` river, `m` markers. A field set to `null` or an empty list clears it.
- The current map is every post folded in order, so the later post wins field by field.
- Each player's unpublished draft is kept on their own device.

## Design notes

The full design, including the decisions behind each behavior, is in the Songs of Creation Map design doc.
