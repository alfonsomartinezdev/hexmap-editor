// src/app.html is page *content*. Hosts wrap it in a minimal document skeleton:
// the claude.ai viewer does this at publish time, and build.js / the test server
// do the same here, so every copy of the app runs in the same page.
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "src", "app.html");

const CONFIG = path.join(__dirname, "..", "site.config.json");

const wrap = (body, config) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e121d">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.4 system-ui,sans-serif;background:#fafafa}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${config ? `<script>window.MAP_CONFIG = ${JSON.stringify(config)};</script>\n` : ""}${body}
</body>
</html>
`;

// withConfig: include site.config.json (the shared database). The site does; tests don't.
module.exports = {
  page: ({ withConfig = false } = {}) => wrap(fs.readFileSync(APP, "utf8"), withConfig ? JSON.parse(fs.readFileSync(CONFIG, "utf8")) : null)
};
