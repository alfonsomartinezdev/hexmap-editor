// Builds the static site for GitHub Pages: dist/index.html.
const fs = require("fs");
const path = require("path");
const { page } = require("./page");

const out = path.join(__dirname, "..", "dist");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), page({ withConfig: true }));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("built dist/index.html");
