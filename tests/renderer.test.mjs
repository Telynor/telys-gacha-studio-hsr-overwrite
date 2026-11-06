import test from "node:test";
import assert from "node:assert/strict";
import {playSequence as renderSequence} from "../scripts/sequence.js";
import {VideoMemoryCache} from "../scripts/video-cache.js";

const playSequence = (results, visuals, banner, options) => renderSequence(results, visuals, banner, {videoCache: testVideoCache, ...options});

class Element {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase(); this.children = []; this.events = {}; this.map = {}; this.attrs = {}; this.dataset = {};
    this.hidden = false; this.isConnected = true; this.textContent = ""; this.style = {setProperty(key, value) {this[key] = value;}};
  }
  set innerHTML(html) {
    this.markup = html;
    for (const match of html.matchAll(/<([\w-]+)\b([^>]*?\bclass="([^"]+)"[^>]*)>/g)) {
      const node = match[1] === "canvas" ? new Canvas() : match[1] === "video" ? new Media("video") : new Element(match[1]);
      node.hidden = /\bhidden\b/.test(match[2]);
      for (const name of match[3].split(/\s+/)) this.map['.' + name] = node;
    }
  }
  get innerHTML() {return this.markup || "";}
  querySelector(selector) {assert(this.map[selector], `Unknown renderer element: ${selector}`); return this.map[selector];}
  append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
  remove() {this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
  setAttribute(key, value) {this.attrs[key] = String(value);}
  removeAttribute(key) {delete this.attrs[key];}
  getBoundingClientRect() {return {width: 736, height: 414};}
  focus() {}
  addEventListener(type, fn, options = {}) {(this.events[type] ||= []).push({fn, options});}
  dispatch(type, detail = {}) {
    const event = {target: this, stopPropagation() {}, preventDefault() {}, ...detail};
    for (const listener of [...this.events[type] || []]) if (!listener.options.signal?.aborted) listener.fn(event);
  }
}
const noop = () => {};
class Canvas extends Element {
  constructor() {super("canvas"); this.width = 736; this.height = 414; this.gradients = [];}
  getContext() {return this.context ||= {
    save: noop, restore: noop, setTransform: noop, clearRect: noop, fillRect: noop, drawImage: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, arc: noop, rotate: noop, strokeRect: noop, fillText: noop,
    createLinearGradient: () => ({addColorStop: noop}), createRadialGradient: () => {
      const stops = []; this.gradients.push(stops); return {addColorStop: (offset, color) => stops.push({offset, color})};
    },
    measureText: text => ({width: String(text).length * 8}), getImageData: () => ({data: new Uint8ClampedArray(this.width * this.height * 4).fill(255)}), putImageData: noop,
    globalAlpha: 1,
  };}
}
class Media extends Element {
  constructor(tag = "audio") {super(tag); this.readyState = 2; this.currentTime = 0; this.loads = 0;}
  play() {return Promise.resolve();} pause() {} load() {this.loads++; this.currentTime = 0;}
}
let testVideoCache;
function browser(reduced = false) {
  testVideoCache = {acquire: async (src, {onProgress}) => {onProgress?.({loaded: 1, total: 1}); return {url: `blob:buffered/${src}`, release() {}};}};
  const prior = new Map();
  const set = (key, value) => {prior.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});};
  const frames = new Map(); let next = 0, now = 0;
  const body = new Element("body"); body.style.overflow = "auto";
  const document = {body, activeElement: new Element("button"), createElement: tag => tag === "canvas" ? new Canvas() : new Element(tag)};
  set("document", document); set("window", {devicePixelRatio: 1, addEventListener() {}});
  set("Image", class {constructor() {this.width = this.naturalWidth = 32; this.height = this.naturalHeight = 32;} set src(value) {this._src = value; queueMicrotask(() => this.onload?.());} get src() {return this._src;}});
  set("Audio", Media); set("ResizeObserver", class {constructor(callback) {this.callback = callback;} observe() {this.callback();} disconnect() {}});
  set("matchMedia", () => ({matches: reduced}));
  set("requestAnimationFrame", callback => {frames.set(++next, callback); return next;}); set("cancelAnimationFrame", id => frames.delete(id));
  return {
    body,
    pendingFrames: () => frames.size,
    overlay: () => body.children.find(node => node.id === "tgs-hsr-overlay"),
    tick(ms = 100) {now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));},
    restore() {for (const [key, descriptor] of prior) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];},
  };
}
async function mounted(env) {for (let i = 0; i < 100 && !env.overlay(); i++) await new Promise(resolve => setImmediate(resolve)); assert(env.overlay()); return env.overlay();}
function hold(env, root) {for (let i = 0; i < 60 && root.querySelector(".tgs-hint").hidden; i++) env.tick(); assert.equal(root.querySelector(".tgs-hint").hidden, false);}
const visual = (stars, index = 0) => ({stars, kind: stars === 5 ? "character" : "lightCone", name: `Reward ${index}`, art: `image-${index}.png`, cardArt: `card-${index}.png`, pathIcon: "nihility.png", pathName: "Nihility", elementName: stars === 5 ? "Imaginary" : "", elementIcon: stars === 5 ? "imaginary.png" : "", artScale: 100});

test("the actual renderer holds and closes single rewards without a summary", async () => {
  const env = browser();
  try {
    for (const stars of [3, 4, 5]) {
      const results = [{item: {uuid: `Item.card${stars}`}, rarity: {stars}}];
      let resolved = false; const done = playSequence(results, [visual(stars)], {}).then(value => {resolved = true; return value;});
      const root = await mounted(env);
      assert.equal(root.querySelector(".tgs-skip-ten").hidden, true);
      root.dispatch("click"); assert.equal(resolved, false);
      hold(env, root); const label = root.querySelector(".tgs-announcement").textContent;
      env.tick(1e6); root.querySelector(".tgs-aura").dispatch("ended");
      assert.equal(root.querySelector(".tgs-announcement").textContent, label); assert.equal(resolved, false);
      assert.equal(root.querySelector(".tgs-summary").hidden, true);
      root.dispatch("click"); assert.equal(await done, results); assert.equal(env.overlay(), undefined);
      assert.equal(env.body.style.overflow, "auto");
    }
  } finally {env.restore();}
});
test("the actual renderer shows ten rewards in order, then three rows of 3–4–3", async () => {
  const env = browser();
  try {
    const order = [3, 3, 4, 3, 3, 5, 3, 3, 3, 3];
    const results = order.map((stars, index) => ({item: {uuid: `Item.card${index}`}, rarity: {stars}}));
    const visuals = order.map(visual); let resolved = false;
    const done = playSequence(results, visuals, {}).then(value => {resolved = true; return value;});
    const root = await mounted(env);
    for (let index = 0; index < 10; index++) {
      hold(env, root); assert.match(root.querySelector(".tgs-announcement").textContent, new RegExp(`^Reward ${index}\\.`));
      assert.equal(root.querySelector(".tgs-summary").hidden, true); root.dispatch("click");
    }
    assert.equal(resolved, false); assert.equal(root.querySelector(".tgs-summary").hidden, false);
    const rows = root.querySelector(".tgs-summary-rows").children;
    assert.deepEqual(rows.map(row => row.children.length), [3, 4, 3]);
    assert.deepEqual(rows.flatMap(row => row.children).map(card => card.attrs["aria-label"]), visuals.map((v, i) => `Reward ${i + 1}: ${v.name}, ${v.stars} stars`));
    root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});
test("existing opening clips can be skipped into the new reveal without changing rewards", async () => {
  const env = browser();
  try {
    const results = [{item: {uuid: "Item.character"}, rarity: {stars: 5}}];
    const done = playSequence(results, [visual(5)], {animation: {type: "video", videoNormal: "train-normal.mp4", videoSSR: "train-gold.mp4"}});
    const root = await mounted(env), opening = root.querySelector(".tgs-opening");
    assert.equal(opening.hidden, false); assert.equal(opening.src, "blob:buffered/train-gold.mp4");
    root.querySelector(".tgs-skip-opening").dispatch("click"); assert.equal(opening.hidden, true);
    hold(env, root); root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});
test("reduced motion shows a held reward immediately", async () => {
  const env = browser(true);
  try {
    const results = [{item: {uuid: "Item.character"}, rarity: {stars: 5}}], done = playSequence(results, [visual(5)], {});
    const root = await mounted(env); assert.equal(root.querySelector(".tgs-hint").hidden, false);
    root.dispatch("keydown", {key: "Enter", repeat: false}); assert.equal(await done, results);
  } finally {env.restore();}
});

test("a four-star purple flash is drawn while its aura video is still loading", async () => {
  const env = browser();
  try {
    const done = playSequence([{item: {uuid: "Item.four"}}], [visual(4)], {});
    const root = await mounted(env), aura = root.querySelector(".tgs-aura"), frame = root.querySelector(".tgs-frame");
    aura.play = () => new Promise(() => {});
    hold(env, root);
    assert.match(aura.src, /aura-purple\.mp4$/); assert.equal(aura.style.opacity, "0");
    assert(frame.gradients.some(stops => stops.some(stop => /^rgba\(189,133,255,0\.[1-9]/.test(stop.color))), "The purple flash must render before the video starts.");
    root.dispatch("click"); await done;
  } finally {env.restore();}
});

test("consecutive four-star rewards seek their buffered purple aura without reloading it", async () => {
  const env = browser();
  try {
    const done = playSequence([{}, {}], [visual(4, 0), visual(4, 1)], {});
    const root = await mounted(env), aura = root.querySelector(".tgs-aura"), frame = root.querySelector(".tgs-frame");
    hold(env, root); await new Promise(resolve => setImmediate(resolve));
    aura.currentTime = 7; frame.gradients = [];
    root.dispatch("click"); hold(env, root);
    assert.equal(aura.loads, 1); assert(aura.currentTime < 1.5);
    assert(frame.gradients.some(stops => stops.some(stop => /^rgba\(189,133,255,0\.[1-9]/.test(stop.color))));
    root.dispatch("click"); await done;
  } finally {env.restore();}
});

test("an aborted older aura playback cannot hide the next reward's aura", async () => {
  const env = browser();
  try {
    const done = playSequence([{}, {}], [visual(4, 0), visual(3, 1)], {});
    const root = await mounted(env), aura = root.querySelector(".tgs-aura"), pending = [];
    aura.play = () => new Promise((resolve, reject) => pending.push({resolve, reject}));
    hold(env, root); root.dispatch("click"); hold(env, root); assert.equal(pending.length, 2);
    pending[1].resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(aura.style.opacity, "1"); assert.match(aura.src, /aura-blue\.mp4$/);
    pending[0].reject(new Error("Previous load aborted")); await new Promise(resolve => setImmediate(resolve));
    assert.equal(aura.style.opacity, "1"); root.dispatch("click"); await done;
  } finally {env.restore();}
});

test("a throttled frame cannot jump directly past the four-star flash", async () => {
  const env = browser();
  try {
    const done = playSequence([{}], [visual(4)], {});
    const root = await mounted(env), frame = root.querySelector(".tgs-frame");
    env.tick(10); env.tick(5000);
    assert.equal(root.querySelector(".tgs-hint").hidden, true);
    env.tick(75);
    assert(frame.gradients.some(stops => stops.some(stop => /^rgba\(189,133,255,0\.[1-9]/.test(stop.color))));
    hold(env, root); root.dispatch("click"); await done;
  } finally {env.restore();}
});

test("the opening and aura play from fully buffered local URLs, reused across pulls", async () => {
  const env = browser(), calls = [], cache = new VideoMemoryCache({fetcher: async src => {calls.push(src); return new Response(new Uint8Array([1, 2, 3]));}});
  try {
    for (let i = 0; i < 2; i++) {
      const done = playSequence([{}], [visual(3)], {animation: {type: "video", videoNormal: "train.mp4"}}, {videoCache: cache});
      const root = await mounted(env), opening = root.querySelector(".tgs-opening");
      assert.match(opening.src, /^blob:/); opening.dispatch("ended"); hold(env, root);
      assert.match(root.querySelector(".tgs-aura").src, /^blob:/); root.dispatch("click"); await done;
    }
    assert.equal(calls.length, 2); assert.equal(calls.filter(src => src === "train.mp4").length, 1);
  } finally {cache.clear({force: true}); env.restore();}
});

test("skipping a pending video preload continues to the held reward", async () => {
  const env = browser();
  const cache = {acquire: (_src, {signal, onProgress}) => new Promise((_resolve, reject) => {
    onProgress({loaded: 50, total: 100}); signal.addEventListener("abort", () => reject(new DOMException("Skipped", "AbortError")), {once: true});
  })};
  try {
    const results = [{}], done = playSequence(results, [visual(4)], {animation: {type: "video", videoNormal: "slow-train.mp4"}}, {videoCache: cache});
    const preparing = env.body.children.find(node => node.id === "tgs-hsr-preload"); assert(preparing); assert.equal(env.overlay(), undefined);
    assert.match(preparing.querySelector(".tgs-preload-text").textContent, /50%/);
    preparing.querySelector(".tgs-preload-skip").dispatch("click");
    const root = await mounted(env); assert.equal(root.querySelector(".tgs-opening").hidden, true);
    hold(env, root); root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

const tenPull = order => ({results: order.map((stars, index) => ({item: {uuid: `Item.card${index}`, qty: index + 1}, rarity: {stars}})), visuals: order.map(visual)});
function assertFullSummary(root, visuals) {
  assert.equal(root.querySelector(".tgs-summary").hidden, false);
  const rows = root.querySelector(".tgs-summary-rows").children;
  assert.deepEqual(rows.map(row => row.children.length), [3, 4, 3]);
  assert.deepEqual(rows.flatMap(row => row.children).map(card => card.attrs["aria-label"]), visuals.map((v, i) => `Reward ${i + 1}: ${v.name}, ${v.stars} stars`));
  assert.equal(root.querySelector(".tgs-skip-ten").hidden, true);
}

test("Skip cuts the ten-pull opening, keeps the full five-star Path intro and splash, then shows all rewards", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([3, 4, 3, 3, 3, 3, 5, 4, 3, 3]), before = structuredClone(results), sounds = [];
    visuals[6].pathIcon = "preservation.png";
    const done = playSequence(results, visuals, {animation: {type: "video", videoNormal: "train.mp4", videoSSR: "train-gold.mp4"}, audio: {sfxSSR: "five.wav", sfxFlip: "other.wav"}}, {playSFX: src => sounds.push(src)});
    const root = await mounted(env), skip = root.querySelector(".tgs-skip-ten"), opening = root.querySelector(".tgs-opening");
    const draws = []; root.querySelector(".tgs-frame").getContext().drawImage = image => draws.push(image.src);
    assert.equal(skip.hidden, false); assert.equal(root.querySelector(".tgs-skip-opening").hidden, true);
    skip.dispatch("click"); assert.equal(opening.hidden, true); assert.equal(skip.hidden, true);
    opening.dispatch("ended"); opening.dispatch("error"); skip.dispatch("click"); root.dispatch("click");
    env.tick(20); env.tick(200);
    assert.equal(root.querySelector(".tgs-starfield").style.opacity, "0"); assert.equal(root.querySelector(".tgs-hint").hidden, true);
    assert(draws.includes("preservation.png")); assert(draws.some(src => /star\.png$/.test(src))); assert(!draws.includes(visuals[6].art));
    assert.equal(root.querySelector(".tgs-summary").hidden, true);
    hold(env, root); assert.match(root.querySelector(".tgs-announcement").textContent, /^Reward 6\./);
    assert.equal(root.querySelector(".tgs-counter").textContent, "7 / 10"); assert(draws.includes(visuals[6].art));
    assert.equal(root.querySelector(".tgs-hint").textContent, "Click anywhere to view results");
    assert.deepEqual(sounds, ["five.wav"]); root.dispatch("click"); assertFullSummary(root, visuals);
    assert.equal(env.pendingFrames(), 0); root.dispatch("click"); assert.equal(await done, results); assert.deepEqual(results, before);
  } finally {env.restore();}
});

test("Skip during a lower-rarity animation preserves every remaining five-star, including Light Cones", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([4, 3, 5, 3, 4, 3, 5, 3, 3, 5]); visuals[6].kind = "lightCone";
    const done = playSequence(results, visuals, {}), root = await mounted(env), aura = root.querySelector(".tgs-aura");
    let rejectOld;
    aura.play = () => new Promise((_resolve, reject) => {rejectOld = reject;});
    env.tick(20); env.tick(140); assert(rejectOld);
    root.querySelector(".tgs-skip-ten").dispatch("click");
    rejectOld(new Error("Prior aura stopped")); await new Promise(resolve => setImmediate(resolve));
    assert.equal(root.querySelector(".tgs-starfield").style.opacity, "0");
    aura.play = () => Promise.resolve();
    for (const index of [2, 6, 9]) {
      assert.equal(root.querySelector(".tgs-hint").hidden, true); root.dispatch("keydown", {key: "Enter"});
      assert.equal(root.querySelector(".tgs-summary").hidden, true);
      hold(env, root); assert.match(root.querySelector(".tgs-announcement").textContent, new RegExp(`^Reward ${index}\\.`));
      root.dispatch("click");
    }
    assertFullSummary(root, visuals); root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

test("Skip on a ten-pull with no five-star goes straight from the opening to the complete summary", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([3, 4, 3, 3, 3, 3, 4, 3, 3, 3]), sounds = [];
    const done = playSequence(results, visuals, {animation: {type: "video", videoNormal: "train.mp4"}}, {playSFX: src => sounds.push(src)});
    const root = await mounted(env); root.querySelector(".tgs-skip-ten").dispatch("click");
    assertFullSummary(root, visuals); assert.equal(root.querySelector(".tgs-opening").hidden, true);
    assert.equal(env.pendingFrames(), 0); assert.equal(sounds.length, 0);
    root.querySelector(".tgs-opening").dispatch("ended"); env.tick(10000); assertFullSummary(root, visuals);
    root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

test("Skip during a five-star keeps its current lead-in clock and does not replay its sound", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([5, 3, 3, 3, 4, 3, 3, 3, 3, 3]), sounds = [];
    const done = playSequence(results, visuals, {audio: {sfxSSR: "five.wav"}}, {playSFX: src => sounds.push(src)}), root = await mounted(env);
    env.tick(20); env.tick(900); assert.equal(root.querySelector(".tgs-starfield").style.opacity, "0");
    root.querySelector(".tgs-skip-ten").dispatch("click"); env.tick(300);
    assert.equal(root.querySelector(".tgs-starfield").style.opacity, "1"); assert.deepEqual(sounds, ["five.wav"]);
    hold(env, root); root.dispatch("click"); assertFullSummary(root, visuals);
    root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

test("Skip does not replay a five-star already viewed and cancels pending animation frames at the summary", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([5, 4, 3, 3, 3, 3, 4, 3, 3, 3]);
    const done = playSequence(results, visuals, {}), root = await mounted(env);
    hold(env, root); root.dispatch("click"); assert(env.pendingFrames() > 0);
    root.querySelector(".tgs-skip-ten").dispatch("click"); assertFullSummary(root, visuals); assert.equal(env.pendingFrames(), 0);
    env.tick(10000); assertFullSummary(root, visuals);
    root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

test("keyboard activation of Skip cannot advance a reward before the button's native click", async () => {
  const env = browser();
  try {
    const {results, visuals} = tenPull([3, 5, 3, 3, 4, 3, 3, 3, 3, 3]);
    const done = playSequence(results, visuals, {}), root = await mounted(env), skip = root.querySelector(".tgs-skip-ten");
    hold(env, root); root.dispatch("keydown", {key: "Enter", target: skip});
    assert.match(root.querySelector(".tgs-announcement").textContent, /^Reward 0\./);
    skip.dispatch("click"); assert.equal(root.querySelector(".tgs-hint").hidden, true);
    hold(env, root); root.dispatch("click"); assertFullSummary(root, visuals);
    root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});

test("Skip keeps reduced-motion five-star rewards held until clicked", async () => {
  const env = browser(true);
  try {
    const {results, visuals} = tenPull([3, 4, 3, 5, 3, 3, 3, 3, 3, 3]);
    const done = playSequence(results, visuals, {}), root = await mounted(env);
    root.querySelector(".tgs-skip-ten").dispatch("click");
    assert.equal(root.querySelector(".tgs-hint").hidden, false); assert.match(root.querySelector(".tgs-announcement").textContent, /^Reward 3\./);
    assert.equal(root.querySelector(".tgs-summary").hidden, true); assert.equal(env.pendingFrames(), 0);
    root.dispatch("click"); assertFullSummary(root, visuals); root.dispatch("click"); assert.equal(await done, results);
  } finally {env.restore();}
});
