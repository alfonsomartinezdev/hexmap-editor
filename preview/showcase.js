// A preview map that shows everything at once, to check changes by eye:
// every default land (and every pair meeting), rivers in every direction / turn / fork / mouth,
// natures 1–4, markers 1–6 with labels, two peoples' borders, custom lands with each pen, and posts
// from several players across turns so Show has something to filter.
const nb = (c, r) => { const odd = r & 1; return [[c+1,r],[c+odd,r+1],[c-1+odd,r+1],[c-1,r],[c-1+odd,r-1],[c+odd,r-1]]; };
const LANDS = ["desert","forest","hills","mountains","grassland","sea","swamp"];
const ch = {}, set = (c, r, v) => { if (c < 0 || r < 0 || c > 31 || r > 52) return; ch[`h${c}_${r}`] = Object.assign(ch[`h${c}_${r}`] || {}, v); };
const get = (c, r) => ch[`h${c}_${r}`];

// 1. rows 1–8: a block of each land, side by side, so every neighbour pair has a coastline
LANDS.forEach((t, i) => { for (let c = 1 + i*4; c < 5 + i*4; c++) for (let r = 1; r <= 8; r++) set(c, r, {t}); });
// and rows 9–12: the same lands as a checkerboard of pairs, so each land meets several others
for (let c = 1; c <= 28; c++) for (let r = 9; r <= 12; r++) set(c, r, {t: LANDS[(c + r*3) % 7]});
// natures 1–4 and markers on the land blocks
const NAT = ["Burning","Deep","Wild","Veiled","Frozen","Teeming","Still"];
LANDS.forEach((t, i) => {
  const c = 2 + i*4;
  set(c, 3, {n: NAT.slice(0, 1 + (i % 4))});
  set(c+1, 6, {m: Array.from({length: 1 + (i % 6)}, (_, k) => ({id:`m${i}${k}`, k: ["city","army","legend","wonder","tri","flag"][k], color: ["#c8323c","#3d9be0","#e6c440","#8e4fc8","#1fa39a","#e0912f"][k], ...(k === 0 ? {label: ["Vgd","2nd host","Old Keep","Mire","Spire","Ford","Gate"][i]} : {})}))});
});

// 2. rows 14–35: grassland with rivers of every kind
for (let c = 1; c <= 30; c++) for (let r = 14; r <= 35; r++) set(c, r, {t: "grassland"});
const walk = (c, r, dirs) => { set(c, r, {r: true}); for (const d of dirs){ [c, r] = nb(c, r)[d]; set(c, r, {r: true}); } };
walk(2, 15, [0,0,0,0,0,0]);                          // straight east–west
walk(2, 17, [1,1,1,1,1,1]);                          // straight south-east diagonal
walk(17, 15, [2,2,2,2,2,2]);                         // straight south-west diagonal
walk(22, 15, [1,2,1,2,1,2,1,2]);                     // north–south
walk(2, 25, [0,1,0,1,0,1,0]);                        // tightest turns
walk(12, 24, [0,0,1,1,2,2,3,3]);                     // turning through every direction
walk(27, 16, [2,1,2,1,2,1,2,1,2]);                   // a main river…
{ let c = 30, r = 18; for (let i = 0; i < 12; i++){ set(c, r, {r: true}); const [nc, nr] = nb(c, r)[2]; const hit = get(nc, nr) && get(nc, nr).r; [c, r] = [nc, nr]; if (hit) break; } }   // …with a tributary
set(8, 31, {r: true});                               // a lone river hex
set(6, 34, {r: true, n: ["Deep"], m: [{id:"rv1", k:"city", color:"#c8323c", label:"Delta"}]});   // a river hex with natures and a marker

// 3. rows 36–44: rivers through other lands, into a lake, and peoples
for (let c = 1; c <= 30; c++) for (let r = 36; r <= 44; r++) set(c, r, {t: LANDS[Math.floor(c / 5) % 7] === "sea" ? "forest" : LANDS[Math.floor(c / 5) % 7]});
for (const [c, r] of [[14,39],[15,39],[14,40],[15,40],[16,40]]) set(c, r, {t: "lake", r: false});
walk(4, 36, [1,2,1,0,0,0,0,0,1]);                    // across several lands, into the lake
for (let c = 20; c <= 26; c++) for (let r = 37; r <= 41; r++) set(c, r, {p: "pa"});
for (let c = 24; c <= 29; c++) for (let r = 40; r <= 44; r++) set(c, r, {p: "pb"});

// 4. rows 45–52: the coast and the sea; rivers run into it
for (let c = 0; c <= 31; c++) for (let r = 47; r <= 52; r++) set(c, r, {t: "sea"});
for (let c = 1; c <= 30; c++) for (const r of [45, 46]) set(c, r, {t: c % 6 < 3 ? "grassland" : "desert"});
walk(22, 23, [2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1]);   // a long river to the sea
// custom lands, one per remaining pen, on row 45
const CUSTOM = [["c1","Salt flat","#e3edf3","rows"],["c2","Ashland","#4b4f58","dots"],["c3","Bloomfield","#b5677a","vertical"],["c4","Ice","#b8c4ba","bricks"],["c5","Moor","#6e5a8f","back"]];
CUSTOM.forEach(([id], i) => { set(2 + i*2, 45, {t: "x-" + id}); set(3 + i*2, 45, {t: "x-" + id}); });

// split into posts by different players over three weeks, so Show and turns have something to show
const ids = Object.keys(ch), players = [["u_c","Cal"],["u_b","Bea"],["u_d","Dev"],["u_e","Eli"]];
const weeks = [new Date("2026-10-05T10:00:00-07:00").getTime(), new Date("2026-10-13T10:00:00-07:00").getTime(), new Date("2026-10-20T10:00:00-07:00").getTime()];
const posts = {};
const chunk = Math.ceil(ids.length / 8);
for (let i = 0; i < 8; i++){
  const part = Object.fromEntries(ids.slice(i*chunk, (i+1)*chunk).map(k => [k, ch[k]]));
  const [by, name] = players[i % 4];
  posts["s" + i] = { by, name, at: weeks[Math.min(2, Math.floor(i / 3))] + i*3600e3, changes: part };
}
posts.s0.types = Object.fromEntries(CUSTOM.map(([id, name, color, pen]) => [id, {kind:"land", name, color, pen}]));
posts.s0.peoples = { pa: {name:"Goblins", color:"#c8323c"}, pb: {name:"Elves", color:"#4b56c8"} };
const fs = require("fs"), dir = process.argv[2];
fs.mkdirSync(dir, {recursive: true});
for (const [k, v] of Object.entries(posts)) fs.writeFileSync(`${dir}/${k}.json`, JSON.stringify(v));
console.log(Object.keys(posts).join(","));
