import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function worker(fetch = async () => new Response("online")) {
  const handlers = {};
  const cached = [];
  const deleted = [];
  const cache = {
    addAll: async (urls) => cached.push(...urls),
    match: async (url) => url === "/offline.html" ? new Response("offline") : undefined,
  };
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://gala.test" },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    caches: {
      open: async () => cache,
      keys: async () => ["vedem-pwa-v0", "vedem-pwa-v1", "other-app"],
      delete: async (key) => deleted.push(key),
    },
    fetch, URL, Response,
  });
  return { handlers, cached, deleted };
}

function navigate(handlers, path) {
  let response;
  handlers.fetch({
    request: { url: `https://gala.test${path}`, method: "GET", mode: "navigate" },
    respondWith: (promise) => { response = promise; },
  });
  return response;
}

test("seule la page de secours est précachée", async () => {
  const { handlers, cached } = worker();
  let pending;
  handlers.install({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(cached, ["/offline.html"]);
});

test("la mise à jour supprime uniquement les anciens caches de cette PWA", async () => {
  const { handlers, deleted } = worker();
  let pending;
  handlers.activate({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, ["vedem-pwa-v0"]);
});

test("API, mutations et ressources externes ne sont pas interceptées", () => {
  const { handlers } = worker();
  for (const request of [
    { url: "https://gala.test/api/orders", method: "GET", mode: "cors" },
    { url: "https://gala.test/api/orders", method: "POST", mode: "navigate" },
    { url: "https://api.test/tickets", method: "GET", mode: "cors" },
    { url: "https://external.test/", method: "GET", mode: "navigate" },
  ]) {
    handlers.fetch({ request, respondWith: () => assert.fail("Requête interceptée") });
  }
});

test("les pages privées restent réseau uniquement, sans mise en cache", async () => {
  const { handlers, cached } = worker();
  for (const path of ["/mes-tickets", "/success?order=private", "/admin/dashboard"]) {
    assert.equal(await (await navigate(handlers, path)).text(), "online");
  }
  assert.deepEqual(cached, []);
});

test("une navigation hors connexion reçoit la page de secours", async () => {
  const { handlers } = worker(async () => { throw new TypeError("Offline"); });
  assert.equal(await (await navigate(handlers, "/tickets")).text(), "offline");
});

test("une erreur HTTP serveur est conservée", async () => {
  const { handlers } = worker(async () => new Response("Indisponible", { status: 503 }));
  assert.equal((await navigate(handlers, "/tickets")).status, 503);
});
