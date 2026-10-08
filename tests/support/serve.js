// Serves the app at http://localhost:4173 in the same page the site uses (scripts/page.js).
const http = require("http");
const { page } = require("../../scripts/page");

const PORT = Number(process.env.PORT || 4173);

http.createServer((req, res) => {
  if (req.url === "/" || req.url.startsWith("/?") || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(page());
    return;
  }
  res.writeHead(404); res.end("not found");
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
