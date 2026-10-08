# Songs of Creation map

A shared hex map for the *Songs of Creation* play-by-post game.

Live at https://alfonsomartinezdev.github.io/hexmap-editor/ (preview: nothing is saved or shared yet).

## How the map is stored

- A **post** is `{ by, at, changes }`, where `changes` maps a hex id (`h<col>_<row>`) to the fields that post set: `t` land, `n` natures, `p` people, `r` river, `m` markers. A field set to `null` or an empty list clears it.
- The current map is every post folded in order, so the later post wins field by field.
- Each player's unpublished draft is kept on their own device.
