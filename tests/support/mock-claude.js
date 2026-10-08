// A stand-in for the claude.ai viewer's runtime (window.claude), injected before the
// app loads. It gives the app an in-memory shared store and a signed-in player, so
// tests can publish posts and pretend to be other players.
//
// Options come from window.__mockOptions (set by the test before this runs):
//   { userId, canWrite, names }
(() => {
  const opts = Object.assign({ userId: "u_me", canWrite: true, names: { u_me: "Ash", u_other: "Rowan" } }, window.__mockOptions || {});
  const docs = new Map();          // "collection/id" -> data
  const listeners = new Set();     // { kind:"col"|"doc", path, next }

  const clone = v => JSON.parse(JSON.stringify(v));
  const snapDoc = path => {
    const has = docs.has(path), data = has ? clone(docs.get(path)) : undefined;
    return { id: path.split("/").pop(), exists: has, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const snapCol = col => {
    const list = [...docs.keys()].filter(k => k.startsWith(col + "/") && k.split("/").length === col.split("/").length + 1).sort().map(snapDoc);
    return { docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = path => {
    for (const l of listeners) {
      if (l.kind === "doc" && l.path === path) l.next(snapDoc(path));
      if (l.kind === "col" && path.startsWith(l.path + "/")) l.next(snapCol(l.path));
    }
  };
  const tick = fn => new Promise(r => setTimeout(() => r(fn()), 0));

  const docRef = path => ({
    id: path.split("/").pop(), path,
    get: () => tick(() => snapDoc(path)),
    set: data => {
      if (!opts.canWrite) return Promise.reject({ code: "invalid_argument", message: "read only" });
      return tick(() => { docs.set(path, clone(data)); notify(path); });
    },
    update: data => tick(() => { docs.set(path, Object.assign(clone(docs.get(path) || {}), clone(data))); notify(path); }),
    delete: () => tick(() => { docs.delete(path); notify(path); }),
    onSnapshot: (next) => { const l = { kind: "doc", path, next }; listeners.add(l); setTimeout(() => next(snapDoc(path)), 0); return () => listeners.delete(l); }
  });
  const colRef = path => ({
    path,
    doc: id => docRef(path + "/" + (id || Math.random().toString(36).slice(2))),
    get: () => tick(() => snapCol(path)),
    onSnapshot: (next) => { const l = { kind: "col", path, next }; listeners.add(l); setTimeout(() => next(snapCol(path)), 0); return () => listeners.delete(l); }
  });

  const db = Object.freeze({ doc: docRef, collection: colRef });
  const user = Object.freeze({
    id: async () => opts.userId,
    can: async () => opts.canWrite,
    isOwner: () => true, canEdit: () => opts.canWrite,
    profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: opts.names[i] || "" }]))
  });

  window.claude = Object.freeze({ use: async name => (name === "db" ? db : name === "user" ? user : null) });

  // test-side handle: read what the app wrote, or write as another player
  window.__mockStore = {
    all: () => Object.fromEntries([...docs].map(([k, v]) => [k, clone(v)])),
    put: (path, data) => { docs.set(path, clone(data)); notify(path); }
  };
})();
