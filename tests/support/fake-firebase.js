// Stands in for the Firebase Realtime Database's REST API: live streams (EventSource on
// <path>.json), reading (GET) and writing (PUT). It enforces the same rules as
// database.rules.json: posts can be added but never overwritten, and /current (which
// map is live) can be set by anyone. Tests drive it through window.__fakeFirebase.
// window.__fakeFirebaseOld = true simulates a database still on the old rules (no /current).
(() => {
  const ROOT = "https://test-map.firebaseio.com";
  window.MAP_CONFIG = { databaseURL: ROOT };
  const tree = {};
  const streams = new Set();
  let clock = 1_000_000;
  const old = () => !!window.__fakeFirebaseOld;
  const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
  const parts = p => p.split("/").filter(Boolean);
  const get = p => { let o = tree; for (const k of parts(p)) { if (!o || typeof o !== "object") return null; o = o[k]; } return o === undefined ? null : o; };
  const set = (p, v) => { const ks = parts(p); let o = tree; for (const k of ks.slice(0, -1)) o = o[k] = (o[k] && typeof o[k] === "object") ? o[k] : {}; o[ks.at(-1)] = v; };
  const live = () => get("/current") && get("/current").map;
  const postsAt = () => live() ? `/maps/${live()}/posts` : "/posts";
  // tell every stream at or above a changed path
  const changed = p => {
    for (const s of streams) {
      if (p === s.path) s.emit("put", { path: "/", data: clone(get(p)) });
      else if (p.startsWith(s.path + "/")) s.emit("put", { path: p.slice(s.path.length), data: clone(get(p)) });
    }
  };

  class FakeEventSource {
    constructor(url) {
      this.url = url; this.path = String(url).slice(ROOT.length).replace(/\.json$/, "") || "/";
      this.handlers = {}; this.onerror = null;
      streams.add(this);
      setTimeout(() => this.emit("put", { path: "/", data: clone(get(this.path)) }), 0);
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    emit(type, payload) { for (const fn of this.handlers[type] || []) fn({ data: JSON.stringify(payload) }); }
    close() { streams.delete(this); }
  }
  window.EventSource = FakeEventSource;

  const deny = () => new Response(JSON.stringify({ error: "Permission denied" }), { status: 401 });
  // like Firebase, drop empty objects, nulls and empty arrays
  const prune = v => {
    if (Array.isArray(v)) { const a = v.map(prune).filter(x => x !== undefined); return a.length ? a : undefined; }
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== undefined) o[k] = p; } return Object.keys(o).length ? o : undefined; }
    return v === null ? undefined : v;
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith(ROOT)) return realFetch(url, opts);
    const path = decodeURIComponent(u.slice(ROOT.length).replace(/\.json$/, ""));
    const method = opts.method || "GET";
    const isPost = /^\/posts\/[^/]+$/.test(path) || (!old() && /^\/maps\/[^/]+\/posts\/[^/]+$/.test(path));
    const isCurrent = !old() && path === "/current";
    if (method === "GET") return (isCurrent || path === "/posts") ? new Response(JSON.stringify(clone(get(path)))) : deny();
    if (method !== "PUT" || !(isPost || isCurrent)) return deny();
    if (isPost && get(path)) return deny();
    const body = JSON.parse(opts.body);
    if (!body.at || (isPost && !body.by) || (isCurrent && !body.map)) return deny();
    if (body.at && body.at[".sv"] === "timestamp") body.at = ++clock;
    const v = prune(body);
    set(path, v); changed(path);
    if (isPost) window.__fakeFirebase.writes.push({ id: path.split("/").pop(), path, body: clone(v) });
    else window.__fakeFirebase.current.push(clone(v));
    return new Response(JSON.stringify(v), { status: 200 });
  };

  window.__fakeFirebase = {
    writes: [], current: [],
    posts: () => clone(get(postsAt())) || {},
    // pretend another player published, on whichever map is live
    add: (id, post) => { const p = `${postsAt()}/${id}`; set(p, { at: ++clock, ...post }); changed(p); },
    // pretend another player cleared the map
    switchTo: (map, firstPost) => { if (firstPost) set(`/maps/${map}/posts/${firstPost.id}`, { at: ++clock, ...firstPost }); set("/current", { map, at: ++clock }); changed("/current"); },
    drop: () => { for (const s of streams) s.onerror && s.onerror(new Event("error")); }
  };
})();
