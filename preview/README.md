# Preview map

`showcase.js` builds the map used in the Claude preview, so changes can be checked by eye:

- every default land, side by side and as a checkerboard (all coastline pairs)
- natures 1–4 and markers 1–6 (with labels) on the land blocks
- rivers: east–west, both diagonals, north–south, tightest turns, a full turn,
  a fork with a tributary, a lone river hex, a river hex with a marker, rivers
  through several lands, into a lake, and a long river to the sea
- two peoples' borders, overlapping
- custom lands with the other pens
- posts from four players over three weekly turns (for Show)

`node preview/showcase.js <out-dir>` writes one JSON file per post.
