import test from "node:test";
import assert from "node:assert/strict";
import {installAnimationOverride} from "../scripts/integration.js";
import {installProgrammer, programmerHTML} from "../scripts/programmer.js";

test("overwrite returns the same selected results and never changes their Item UUIDs or order", async () => {
  let originalCalls = 0, capture;
  class Host {static play() {originalCalls++;} static playSFX() {}}
  const results = [3, 4, 3, 5, 3, 3, 3, 3, 3, 3].map((stars, index) => ({item: {uuid: `Item.card${index}`, qty: 1}, rarity: {stars}}));
  const before = structuredClone(results);
  installAnimationOverride(Host, {enabled: () => true, resolver: async result => ({stars: result.rarity.stars}), renderer: async (selected, visuals) => {capture = {selected, visuals};}});
  assert.equal(await Host.play(results, {}), results); assert.equal(capture.selected, results);
  assert.deepEqual(capture.visuals.map(v => v.stars), before.map(r => r.rarity.stars));
  assert.deepEqual(results, before); assert.equal(originalCalls, 0);
  assert.equal(installAnimationOverride(Host), false);
});
test("disabling the overwrite delegates to the host animation", async () => {
  const selected = []; class Host {static play(results) {assert.equal(results, selected); return "host";}}
  installAnimationOverride(Host, {enabled: () => false}); assert.equal(await Host.play(selected, {}), "host");
});
test("an animation failure still returns all original rewards for host delivery", async () => {
  const selected = [{item: {uuid: "Item.character-card"}, rarity: {stars: 5}}];
  class Host {static play() {throw new Error("Must not enter legacy cards");}}
  const previous = console.error; console.error = () => {};
  try {
    installAnimationOverride(Host, {enabled: () => true, resolver: async () => ({}), renderer: async () => {throw new Error("Broken artwork");}});
    assert.equal(await Host.play(selected, {}), selected);
  } finally {console.error = previous;}
});
test("simultaneous pulls present in sequence rather than replacing each other's rewards", async () => {
  let finishFirst; const events = [];
  class Host {static play() {}}
  installAnimationOverride(Host, {enabled: () => true, resolver: async r => r, renderer: async results => {events.push(results[0]); if (results[0] === 1) await new Promise(resolve => {finishFirst = resolve;});}});
  const first = Host.play([1], {}), second = Host.play([2], {});
  while (!finishFirst) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, [1]); finishFirst(); await Promise.all([first, second]); assert.deepEqual(events, [1, 2]);
});
test("reward programmer extends existing rows without replacing the awarded Item", () => {
  class Config { _generateItemHTML(item) {return `<div class="pool-item-row" data-uuid="${item.uuid}"><span>${item.name}</span></div>`;} }
  const item = {name: "Welt Card", uuid: "Item.welt-card"}, before = structuredClone(item);
  installProgrammer(Config); const html = new Config()._generateItemHTML(item);
  assert.match(html, /Choose corresponding character/); assert.match(html, /data-tgs-actor-drop/); assert.match(html, /Splash artwork/);
  assert.match(html, /data-uuid="Item.welt-card"/); assert.deepEqual(item, before); assert.equal(installProgrammer(Config), false);
  assert.doesNotMatch(programmerHTML({name: '<img onerror="bad">'}), /<img onerror/);
});
