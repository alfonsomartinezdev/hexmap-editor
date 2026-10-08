// Serves the app the way the claude.ai viewer does: src/app.html is page *content*,
// wrapped at publish time in a minimal document skeleton. The tests load it through
// this wrapper so they see the same page players see.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const APP = path.join(__dirname, "..", "..", "src", "app.html");

const skeleton = body => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.4 system-ui,sans-serif;background:#fafafa}
img{max-width:100%}
[hidden]{display:none!important}
</style></head><body>${body}</body></html>`;

http.createServer((req, res) => {
  if (req.url === "/" || req.url.startsWith("/?")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(skeleton(fs.readFileSync(APP, "utf8")));
    return;
  }
  res.writeHead(404); res.end("not found");
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
