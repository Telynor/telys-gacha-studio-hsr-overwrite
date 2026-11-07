import test from "node:test";
import assert from "node:assert/strict";
import {attachArtFraming, framingVisual} from "../scripts/art-framing.js";
import {paintArt, paintIntro} from "../scripts/sequence.js";
import {resolveVisual} from "../scripts/character.js";
import {PORTRAIT_ASPECT, paintPortrait, portraitLayout, portraitStyle} from "../scripts/portrait-layout.js";

const reward = () => ({uuid: "Item.card", name: "Aventurine Card", reveal: {telysHSR: {actorUuid: "Actor.Aventurine", snapshot: {name: "Aventurine", splashArt: "aventurine.webp", pathName: "Preservation"}}}});
const bitmap = src => ({image: {src}, width: 500, height: 1000, boundsWidth: 500, boundsHeight: 1000, cx: 250, cy: 500});
const turn = () => new Promise(resolve => setImmediate(resolve));
function context() {
  const noop = () => {}, calls = [];
  return {calls, globalAlpha: 1, save: noop, restore: noop, clearRect: noop, rotate: noop, fillRect: noop, fillText: noop,
    setTransform(...args) {calls.push({type: "transform", args});}, drawImage(...args) {calls.push({type: "image", args});},
    createLinearGradient: () => ({addColorStop: noop}), measureText: value => ({width: value.length * 8})};
}

test("the default full-height portrait fits the stage instead of enlarging past the head and feet", () => {
  const ctx = context(), image = bitmap("portrait");
  paintArt(ctx, 1600, 900, 650, {kind: "character", artScale: 100}, image, 1);
  const draw = ctx.calls.find(call => call.type === "image").args;
  assert.equal(draw[0], image.image); assert(draw[4] <= 900 * .94 + 1e-9); assert(draw[3] <= 1600 * .94 + 1e-9);
});

test("the five-star lead-in centers the visible Path and the double-size middle star", () => {
  const ctx = context();
  ctx.createRadialGradient = ctx.createLinearGradient;
  const path = {...bitmap("path"), cx: 220, cy: 420};
  const star = {...bitmap("star"), cx: 265, cy: 495};
  paintIntro(ctx, 1280, 720, 800, star, path);
  const draws = ctx.calls.filter(call => call.type === "image").map(call => call.args);
  assert.equal(draws.length, 6);
  assert.deepEqual(ctx.calls.find(call => call.type === "transform").args, [1, 0, 0, 1, 640, 360]);
  for (const [draw, image] of [[draws[0], path], [draws[3], star]]) {
    assert(Math.abs(draw[1] + image.cx * draw[3] / image.width) < 1e-9);
    assert(Math.abs(draw[2] + image.cy * draw[4] / image.height) < 1e-9);
  }
  assert.equal(draws[3][3], draws[1][3] * 2);
});

test("a Light Cone starts enlarged and settles at half the screen height", () => {
  const ctx = context(), image = bitmap("light-cone"), visual = {kind: "lightCone", artScale: 100};
  paintArt(ctx, 1280, 720, 50, visual, image, 1);
  paintArt(ctx, 1280, 720, 650, visual, image, 1);
  const [entry, hold] = ctx.calls.filter(call => call.type === "image").map(call => call.args);
  assert.equal(hold[4], 360);
  assert(entry[4] > hold[4] * 1.5);
  assert.equal(hold[0], image.image);
});

test("saved framing is resolved per reward and moves the production art by viewport percentages", async () => {
  const item = reward(); Object.assign(item.reveal.telysHSR, {artScale: 150, artX: 10, artY: -20});
  const before = structuredClone(item), visual = await resolveVisual({item, rarity: {stars: 5}}, {}, {resolveUuid: async () => null});
  const ctx = context(); paintArt(ctx, 1600, 900, 650, visual, bitmap("portrait"), 1);
  assert.deepEqual(ctx.calls.find(call => call.type === "transform").args, [1, 0, 0, 1, 960, 270]);
  assert.equal(visual.artScale, 150); assert.equal(visual.artX, 10); assert.equal(visual.artY, -20); assert.deepEqual(item, before);
  assert.equal(framingVisual(item).artX, visual.artX); assert.equal(framingVisual(item).artY, visual.artY);
});

function preview(item, {load = async src => src ? bitmap(src) : null, mode = "reveal"} = {}) {
  const keys = ["window", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"], previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map(), events = new Map(); let next = 0;
  const ctx = context(), canvas = {style: {}, width: 0, height: 0, getContext: () => ctx, focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({width: 400, height: 225}),
    addEventListener(type, fn, options) {(events.get(type) || events.set(type, []).get(type)).push({fn, options});}};
  const status = {hidden: false}, wrapper = {style: {setProperty() {}}};
  globalThis.window = {innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, addEventListener() {}};
  globalThis.requestAnimationFrame = fn => {frames.set(++next, fn); return next;}; globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.ResizeObserver = class {observe() {} disconnect() {}};
  const container = {querySelector: selector => selector === "[data-tgs-art-preview]" ? canvas : selector === "[data-tgs-art-frame]" ? wrapper : status};
  const controller = attachArtFraming(container, item, {load, mode, onChange: patch => Object.assign(item.reveal.telysHSR, patch)});
  return {ctx, canvas, status, controller,
    draw() {const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn());},
    dispatch(type, data) {for (const {fn, options} of events.get(type) || []) if (!options.signal?.aborted) fn({preventDefault() {}, stopPropagation() {}, ...data});},
    restore() {controller.destroy(); for (const [key, value] of previous) if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key];},
  };
}

test("dragging, wheel zoom, and keyboard nudging edit the same framing used by the live preview", async () => {
  const item = reward(), env = preview(item);
  try {
    await turn(); env.draw(); assert.equal(env.status.hidden, true);
    env.dispatch("pointerdown", {button: 0, pointerId: 7, clientX: 100, clientY: 50});
    env.dispatch("pointermove", {pointerId: 7, clientX: 140, clientY: 27.5}); env.dispatch("pointerup", {pointerId: 7});
    assert.equal(item.reveal.telysHSR.artX, 10); assert.equal(item.reveal.telysHSR.artY, -10);
    env.dispatch("wheel", {deltaY: -100, deltaMode: 0}); assert(item.reveal.telysHSR.artScale > 100);
    env.dispatch("keydown", {key: "ArrowUp", shiftKey: true}); assert.equal(item.reveal.telysHSR.artY, -15);
    env.draw();
    assert(env.ctx.calls.some(call => call.type === "transform" && call.args[0] === .25 && call.args[4] === 240 && Math.abs(call.args[5] - 78.75) < 1e-9));
    assert.equal(item.uuid, "Item.card"); assert.equal(item.reveal.telysHSR.actorUuid, "Actor.Aventurine");
  } finally {env.restore();}
});

test("closing the art editor cancels late image callbacks and drag handlers", async () => {
  const item = reward(); let finish;
  const loading = new Promise(resolve => {finish = resolve;}), env = preview(item, {load: async () => loading});
  env.controller.destroy(); finish(bitmap("late")); await turn(); env.draw();
  env.dispatch("pointerdown", {button: 0, pointerId: 1, clientX: 0, clientY: 0});
  env.dispatch("pointermove", {pointerId: 1, clientX: 100, clientY: 100});
  assert.equal(item.reveal.telysHSR.artX, undefined); assert.equal(env.ctx.calls.length, 0); env.restore();
});

test("the summary portrait preview and actual card use the same crop, including free panning", async () => {
  const item = reward(), config = item.reveal.telysHSR;
  Object.assign(config, {artScale: 180, artX: 15, artY: -20, portraitScale: 125, portraitX: -10, portraitY: -40});
  config.snapshot.portrait = "aventurine-portrait.webp";
  const visual = await resolveVisual({item, rarity: {stars: 5}}, {}, {resolveUuid: async () => null});
  const image = bitmap(visual.cardArt), layout = portraitLayout(PORTRAIT_ASPECT * 100, 100, image, visual);
  assert.equal(layout.y, -40); assert.equal(layout.height, 475);
  const style = Object.fromEntries(portraitStyle(visual, image).split(";").filter(Boolean).map(part => part.split(":")));
  const width = PORTRAIT_ASPECT * 400;
  const ctx = context(); paintPortrait(ctx, width, 400, visual, image);
  const draw = ctx.calls.find(call => call.type === "image").args;
  assert.equal(draw[1] / width * 100, Number.parseFloat(style.left)); assert.equal(draw[2] / 400 * 100, Number.parseFloat(style.top));
  assert.equal(draw[3] / width * 100, Number.parseFloat(style.width)); assert.equal(draw[4] / 400 * 100, Number.parseFloat(style.height));
  assert.equal(framingVisual(item, "portrait").art, visual.cardArt);
  const env = preview(item, {mode: "portrait"});
  try {
    await turn(); env.draw();
    env.dispatch("pointerdown", {button: 0, pointerId: 1, clientX: 100, clientY: 100});
    env.dispatch("pointermove", {pointerId: 1, clientX: 140, clientY: 122.5}); env.dispatch("pointerup", {pointerId: 1});
    assert.equal(config.portraitX, 0); assert.equal(config.portraitY, -30);
    env.dispatch("wheel", {deltaY: -100, deltaMode: 0}); assert(config.portraitScale > 125);
    assert.deepEqual([config.artScale, config.artX, config.artY], [180, 15, -20]);
  } finally {env.restore();}
});
