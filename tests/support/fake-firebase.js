// Stands in for the Firebase Realtime Database's REST API: the live stream
// (EventSource on /posts.json) and adding a post (PUT /posts/<id>.json).
// It enforces the same rules as database.rules.json: anyone may read and add,
// nobody may overwrite. Tests drive it through window.__fakeFirebase.
(() => {
  const ROOT = "https://test-map.firebaseio.com";
  window.MAP_CONFIG = { databaseURL: ROOT };
  const posts = {};
  const streams = new Set();
  let clock = 1_000_000;

  class FakeEventSource {
    constructor(url) {
      this.url = url; this.handlers = {}; this.onerror = null;
      streams.add(this);
      setTimeout(() => this.emit("put", { path: "/", data: Object.keys(posts).length ? JSON.parse(JSON.stringify(posts)) : null }), 0);
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    emit(type, payload) { for (const fn of this.handlers[type] || []) fn({ data: JSON.stringify(payload) }); }
    close() { streams.delete(this); }
  }
  window.EventSource = FakeEventSource;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith(ROOT)) return realFetch(url, opts);
    const m = u.slice(ROOT.length).match(/^\/posts\/([^/]+)\.json$/);
    if (!m || opts.method !== "PUT") return new Response("not supported by the fake", { status: 400 });
    const id = decodeURIComponent(m[1]);
    if (posts[id]) return new Response(JSON.stringify({ error: "Permission denied" }), { status: 401 });
    const body = JSON.parse(opts.body);
    if (!body.by || !body.at) return new Response(JSON.stringify({ error: "Permission denied" }), { status: 401 });
    if (body.at && body.at[".sv"] === "timestamp") body.at = ++clock;
    // like Firebase, drop empty objects, nulls and empty arrays
    const prune = v => {
      if (Array.isArray(v)) { const a = v.map(prune).filter(x => x !== undefined); return a.length ? a : undefined; }
      if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== undefined) o[k] = p; } return Object.keys(o).length ? o : undefined; }
      return v === null ? undefined : v;
    };
    posts[id] = prune(body);
    for (const s of streams) s.emit("put", { path: "/" + id, data: posts[id] });
    window.__fakeFirebase.writes.push({ id, body: posts[id] });
    return new Response(JSON.stringify(posts[id]), { status: 200 });
  };

  window.__fakeFirebase = {
    writes: [],
    posts: () => JSON.parse(JSON.stringify(posts)),
    // pretend another player published
    add: (id, post) => { posts[id] = { at: ++clock, ...post }; for (const s of streams) s.emit("put", { path: "/" + id, data: posts[id] }); },
    drop: () => { for (const s of streams) s.onerror && s.onerror(new Event("error")); }
  };
})();
