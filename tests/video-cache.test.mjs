import test from "node:test";
import assert from "node:assert/strict";
import {VideoMemoryCache} from "../scripts/video-cache.js";
import {warmBannerVideos, installVideoPreloader} from "../scripts/video-preload.js";

const gate = () => {let resolve; const promise = new Promise(ok => {resolve = ok;}); return {promise, resolve};};

test("preloading preserves all bytes in a browser-local Blob URL before playback", async () => {
  const cache = new VideoMemoryCache({fetcher: async () => new Response(new Uint8Array([4, 3, 2, 1]), {headers: {"content-length": "4", "content-type": "video/mp4"}})});
  const progress = [], lease = await cache.acquire("train.mp4", {onProgress: value => progress.push(value)});
  try {
    assert.match(lease.url, /^blob:/); assert.deepEqual([...new Uint8Array(await (await fetch(lease.url)).arrayBuffer())], [4, 3, 2, 1]);
    assert.equal(lease.bytes, 4); assert.deepEqual(progress.at(-1), {loaded: 4, total: 4});
  } finally {lease.release(); cache.clear();}
});

test("warmup and concurrent playback requests share one download and one retained copy", async () => {
  const download = gate(); let calls = 0;
  const cache = new VideoMemoryCache({fetcher: async () => {calls++; await download.promise; return new Response(new Uint8Array(8));}});
  const warm = cache.warm("train.mp4"), a = cache.acquire("train.mp4"), b = cache.acquire("train.mp4");
  download.resolve(); const [first, second] = await Promise.all([a, b]);
  try {
    assert.equal(calls, 1); assert.equal(first.url, second.url); assert.equal(await warm, first.url); assert.equal(cache.stats().bytes, 8);
  } finally {first.release(); second.release(); cache.clear();}
});

test("cache eviction keeps active video URLs alive until the last playback releases them", async () => {
  let next = 0;
  const revoked = [], urls = {createObjectURL: () => `blob:video-${++next}`, revokeObjectURL: url => revoked.push(url)};
  const cache = new VideoMemoryCache({maxBytes: 4, urls, fetcher: async () => new Response(new Uint8Array(4))});
  const first = await cache.acquire("one.mp4"), second = await cache.acquire("two.mp4");
  assert(!revoked.includes(first.url)); assert(!revoked.includes(second.url));
  first.release(); assert(revoked.includes(first.url)); assert(!revoked.includes(second.url)); assert.equal(cache.stats().bytes, 4);
  second.release(); cache.clear(); assert(revoked.includes(second.url));
});

test("skipping one waiter does not abort a shared download or leak its playback pin", async () => {
  const download = gate(), controller = new AbortController();
  const cache = new VideoMemoryCache({fetcher: async () => {await download.promise; return new Response(new Uint8Array(3));}});
  const skipped = cache.acquire("train.mp4", {signal: controller.signal}), retained = cache.acquire("train.mp4");
  controller.abort(); await assert.rejects(skipped, {name: "AbortError"}); download.resolve();
  const lease = await retained; lease.release(); cache.clear(); assert.equal(cache.stats().bytes, 0);
});

test("announced and unannounced oversized videos are rejected within the configured budget", async () => {
  for (const headers of [{"content-length": "8"}, {}]) {
    const cache = new VideoMemoryCache({maxBytes: 4, fetcher: async () => new Response(new Uint8Array(8), {headers})});
    await assert.rejects(cache.acquire("huge.mp4"), /memory limit/); assert.equal(cache.stats().bytes, 0);
  }
});

test("an unsuccessful download can be retried instead of caching a failed URL", async () => {
  let calls = 0;
  const cache = new VideoMemoryCache({fetcher: async () => ++calls === 1 ? new Response(null, {status: 404}) : new Response(new Uint8Array([1]))});
  await assert.rejects(cache.acquire("train.mp4"), /404/);
  const lease = await cache.acquire("train.mp4"); assert.equal(calls, 2); lease.release(); cache.clear();
});

test("queued playback downloads take priority over speculative warmup", async () => {
  const first = gate(), order = [];
  const cache = new VideoMemoryCache({concurrency: 1, fetcher: async src => {order.push(src); if (src === "warming.mp4") await first.promise; return new Response(new Uint8Array([1]));}});
  const warm = cache.warm("warming.mp4"), unused = cache.warm("other-banner.mp4"), requested = cache.acquire("selected.mp4");
  first.resolve(); const lease = await requested; await Promise.all([warm, unused]);
  assert.deepEqual(order, ["warming.mp4", "selected.mp4", "other-banner.mp4"]); lease.release(); cache.clear();
});

test("banner rendering warms only that banner's opening variants and the small aura clips", async () => {
  const calls = [], hooks = {on(name, callback) {assert.equal(name, "renderGachaBannerApp"); this.callback = callback;}};
  const banner = {animation: {type: "video", videoNormal: "normal.mp4", videoSSR: "gold.mp4"}};
  await warmBannerVideos(banner, {cache: {warm: async src => calls.push(src)}});
  assert.equal(calls.length, 5); assert(calls.includes("normal.mp4")); assert(calls.includes("gold.mp4"));
  installVideoPreloader(hooks); assert.equal(typeof hooks.callback, "function");
});

test("playback waits for the final video chunk before a local URL becomes available", async () => {
  let stream, ready = false;
  const cache = new VideoMemoryCache({fetcher: async () => new Response(new ReadableStream({start(controller) {stream = controller; controller.enqueue(new Uint8Array([1, 2]));}}))});
  const pending = cache.acquire("slow.mp4").then(lease => {ready = true; return lease;});
  await new Promise(resolve => setImmediate(resolve)); assert.equal(ready, false);
  stream.enqueue(new Uint8Array([3, 4])); stream.close(); const lease = await pending;
  try {assert.deepEqual([...new Uint8Array(await (await fetch(lease.url)).arrayBuffer())], [1, 2, 3, 4]);}
  finally {lease.release(); cache.clear();}
});

test("a stalled video download times out and frees its playback pin", async () => {
  const cache = new VideoMemoryCache({timeout: 20, fetcher: (_src, {signal}) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), {once: true}))});
  await assert.rejects(cache.acquire("stalled.mp4"), {name: "AbortError"});
  assert.equal(cache.stats().entries, 0); assert.equal(cache.stats().bytes, 0);
});
