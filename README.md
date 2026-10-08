# Songs of Creation map

A shared hex map for the *Songs of Creation* play-by-post game.

Live at https://alfonsomartinezdev.github.io/hexmap-editor/

Posts are stored in a Firebase Realtime Database (`site.config.json`). There are no accounts: anyone with the link can read the map and add posts, and players type a name the first time they publish. Posts can't be edited or deleted; the rules are in `database.rules.json` (paste them into the Firebase console's Rules tab).

## How the map is stored

- A **post** is `{ by, name, at, changes }` (plus optional `types`, `peoples` and `world` for new lands, new peoples and the age), where `changes` maps a hex id (`h<col>_<row>`) to the fields that post set: `t` land, `n` natures, `p` people, `r` river, `m` markers. A field set to `false` (or `null` / an empty list) clears it; Firebase drops nulls, so the app sends `false`.
- The current map is every post folded in order, so the later post wins field by field.
- Each player's unpublished draft is kept on their own device.
