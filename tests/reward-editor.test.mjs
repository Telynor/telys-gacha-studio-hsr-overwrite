import test from "node:test";
import assert from "node:assert/strict";
import {attachProgrammer, entryFor, installProgrammer} from "../scripts/programmer.js";
import {applyRewardDraft, createRewardDraft, openRewardEditor, rewardEditorHTML} from "../scripts/reward-editor.js";

const reward = () => ({entryId: "welt", uuid: "Item.welt-card", name: "Welt Character Card", qty: 2, reveal: {kind: "character", pathIcon: "legacy-path.png", telysHSR: {actorUuid: "Actor.Welt", snapshot: {name: "Welt", pathName: "Nihility", splashArt: "welt.png"}}}});
const turn = () => new Promise(resolve => setImmediate(resolve));

class Root {
  events = new Map(); markup = "";
  constructor() {
    this.content = {querySelector: () => null};
    Object.defineProperty(this.content, "outerHTML", {set: html => {this.markup = html;}});
  }
  addEventListener(type, callback, options = {}) {
    if (!this.events.has(type)) this.events.set(type, []);
    this.events.get(type).push({callback, options});
  }
  querySelector(selector) {return selector === "[data-tgs-entry-editor]" ? this.content : null;}
  dispatch(type, target, extra = {}) {
    for (const {callback, options} of this.events.get(type) || []) {
      if (!options.signal?.aborted) callback({target, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra});
    }
  }
  input(field, value) {this.dispatch("input", {dataset: {tgsField: field}, value});}
  click(action, data = {}) {
    const button = {dataset: {tgsEditorAction: action, ...data}};
    this.dispatch("click", {closest: selector => selector === "[data-tgs-editor-action]" ? button : null});
  }
  drop(uuid) {
    this.dispatch("drop", {closest: () => ({})}, {dataTransfer: {getData: () => JSON.stringify({type: "Actor", uuid})}});
  }
}

function editor(item = reward()) {
  const other = {...reward(), entryId: "other", uuid: "Item.other-card"};
  const app = {targetBannerId: "banner-a", _currentPoolData: {five: [item, other]}};
  const root = new Root(); let options, resolveDialog, front = 0, calls = 0;
  const dialog = {element: root, bringToFront: () => front++};
  const DialogClass = {wait(config) {
    calls++; options = config; config.render({}, dialog);
    return new Promise(resolve => {resolveDialog = resolve;});
  }};
  const done = openRewardEditor(app, {item, rarityId: "five"}, {DialogClass});
  return {
    app, item, other, root, done, DialogClass, get options() {return options;}, get calls() {return calls;}, get front() {return front;},
    async save() {const result = await options.buttons.find(button => button.action === "save").callback(); options.close(); resolveDialog(result); return done;},
    async cancel() {options.buttons.find(button => button.action === "cancel").callback(); options.close(); resolveDialog(null); return done;},
  };
}

test("Config opens the selected entry from the clicked panel, not another copy of its Item", async () => {
  const item = reward(), other = {...reward(), entryId: "other"}, root = new Root(); let received;
  // Native HTMLFormElements expose indexed form controls, just like the host's
  // top-level <form>. This is not a jQuery wrapper around the application.
  root[0] = new Root();
  const row = {dataset: {entryId: "other"}, closest: () => ({dataset: {rarityId: "five"}})};
  const button = {closest: () => row}, target = {closest: () => button};
  const app = {element: root, _currentPoolData: {five: [item, other]}};
  assert.equal(entryFor(app, button).item, other);
  attachProgrammer(app, {openEditor: (parent, entry) => {received = {parent, entry};}});
  root.dispatch("click", target); await turn();
  assert.equal(received.parent, app); assert.equal(received.entry.item, other);
});

test("the rendered native host form routes Config to the entry editor once per click", async () => {
  const before = globalThis.foundry, root = new Root(), dialogRoot = new Root();
  root[0] = new Root(); dialogRoot[0] = new Root();
  const item = reward(); let options, finish, calls = 0;
  const DialogV2 = {wait(config) {
    calls++; options = config;
    config.render({}, {element: dialogRoot, bringToFront() {}});
    return new Promise(resolve => {finish = resolve;});
  }};
  globalThis.foundry = {applications: {api: {DialogV2}}};
  class Config {
    element = root; targetBannerId = "banner-a"; _currentPoolData = {five: [item]};
    _generateItemHTML() {return '<div class="pool-item-row"></div>';}
    async _onRender() {}
  }
  try {
    installProgrammer(Config);
    const app = new Config();
    await app._onRender(); await app._onRender();
    const row = {dataset: {entryId: item.entryId}, closest: () => ({dataset: {rarityId: "five"}})};
    const button = {closest: () => row}, icon = {closest: () => button};
    root.dispatch("click", icon); await turn();
    assert.equal(calls, 1); assert.equal(root.events.get("click").length, 1);
    assert.equal(root[0].events.has("click"), false);
    assert.equal(options.window.title, "Config — Welt Character Card");
    assert.match(options.content, /Item.welt-card/);
    dialogRoot.input("name", "Edited through the opened dialog");
    await options.buttons.find(button => button.action === "save").callback();
    assert.equal(item.reveal.telysHSR.overrides.name, "Edited through the opened dialog");
    assert.equal(item.uuid, "Item.welt-card");
  } finally {options?.close(); finish?.(null); await turn(); globalThis.foundry = before;}
});

test("a jQuery-wrapped host form still binds Config to the form", async () => {
  const root = new Root(), item = reward(); root[0] = new Root(); let opened;
  const row = {dataset: {entryId: item.entryId}, closest: () => ({dataset: {rarityId: "five"}})};
  const app = {element: {0: root}, _currentPoolData: {five: [item]}};
  attachProgrammer(app, {openEditor: (_app, entry) => {opened = entry.item;}});
  root.dispatch("click", {closest: () => ({closest: () => row})}); await turn();
  assert.equal(opened, item); assert.equal(root[0].events.has("click"), false);
});

test("separate editor identifies the Item and keeps Actor sidebar accessible for drops", async () => {
  const env = editor();
  assert.equal(env.options.modal, false); assert.equal(env.options.position.width, 720);
  assert.deepEqual(env.options.classes, ["tgs-reward-config-window"]);
  assert.equal(env.options.window.title, "Config — Welt Character Card");
  assert.match(env.options.content, /Item.welt-card/); assert.match(env.options.content, /Choose corresponding character/);
  assert.match(env.options.content, /Splash artwork/); assert.doesNotMatch(env.options.content, /<details|<form/);
  const duplicate = openRewardEditor(env.app, {item: env.item, rarityId: "five"}, {DialogClass: env.DialogClass});
  assert.equal(env.calls, 1); assert.equal(env.front, 1);
  await env.cancel(); await duplicate;
});

test("Cancel discards edits; Save updates only this entry's presentation and preserves its reward Item", async () => {
  const env = editor(), before = structuredClone(env.item), otherBefore = structuredClone(env.other);
  env.root.input("name", "Custom Welt"); env.root.input("splashArt", "banner-a/welt.png");
  assert.deepEqual(env.item, before);
  await env.cancel(); assert.deepEqual(env.item, before);
  const saved = editor(env.item);
  saved.root.input("name", "Custom Welt"); saved.root.input("splashArt", "banner-a/welt.png"); saved.root.input("artScale", "125");
  assert.equal(await saved.save(), true);
  assert.equal(saved.item.reveal.telysHSR.overrides.splashArt, "banner-a/welt.png");
  assert.equal(saved.item.reveal.telysHSR.overrides.name, "Custom Welt"); assert.equal(saved.item.reveal.telysHSR.artScale, 125);
  assert.equal(saved.item.uuid, before.uuid); assert.equal(saved.item.name, before.name); assert.equal(saved.item.qty, before.qty);
  assert.equal(saved.item.reveal.pathIcon, before.reveal.pathIcon); assert.equal(saved.item.reveal.kind, "character");
  assert.deepEqual(saved.other, otherBefore);
});

test("Save rejects a removed/replaced entry or a different open banner", async () => {
  const env = editor(), save = env.options.buttons[0].callback, before = structuredClone(env.item);
  env.root.input("name", "Changed"); env.app.targetBannerId = "banner-b";
  await assert.rejects(save(), /banner changed/);
  env.app.targetBannerId = "banner-a"; env.app._currentPoolData.five = [];
  await assert.rejects(save(), /removed or replaced/);
  env.app._currentPoolData.five = [{...env.item, uuid: "Item.replacement"}];
  await assert.rejects(save(), /removed or replaced/); assert.deepEqual(env.item, before);
  await env.cancel();
});

test("Save waits for an Actor drop and preserves the programmed character-card Item", async () => {
  const original = globalThis.fromUuid; let deliverActor;
  globalThis.fromUuid = () => new Promise(resolve => {deliverActor = resolve;});
  const env = editor();
  try {
    env.root.drop("Actor.Himeko"); await turn();
    const saved = env.save();
    deliverActor({documentName: "Actor", uuid: "Actor.Himeko", name: "Himeko", img: "himeko.png"});
    await saved;
    assert.equal(env.item.reveal.telysHSR.actorUuid, "Actor.Himeko"); assert.equal(env.item.reveal.telysHSR.snapshot.name, "Himeko");
    assert.equal(env.item.uuid, "Item.welt-card");
  } finally {await env.cancel(); globalThis.fromUuid = original;}
});

test("an Actor resolving after Cancel cannot change the reward", async () => {
  const original = globalThis.fromUuid; let deliverActor;
  globalThis.fromUuid = () => new Promise(resolve => {deliverActor = resolve;});
  const env = editor(), before = structuredClone(env.item);
  try {
    env.root.drop("Actor.Himeko"); await turn(); await env.cancel();
    deliverActor({documentName: "Actor", uuid: "Actor.Himeko", name: "Himeko"}); await turn();
    assert.deepEqual(env.item, before); assert.equal(env.root.markup, "");
  } finally {globalThis.fromUuid = original;}
});

test("Upload / choose targets the clicked field in this editor and ignores callbacks after close", async () => {
  const original = globalThis.FilePicker; let picker;
  globalThis.FilePicker = class {constructor(options) {picker = options;} render() {}};
  const env = editor();
  try {
    env.root.click("browse", {tgsImageField: "pathIcon"}); await turn();
    assert.equal(picker.type, "image"); picker.callback("new-path.png");
    assert.equal(env.item.reveal.telysHSR.overrides, undefined);
    await env.save(); assert.equal(env.item.reveal.telysHSR.overrides.pathIcon, "new-path.png");
    picker.callback("too-late.png"); assert.equal(env.item.reveal.telysHSR.overrides.pathIcon, "new-path.png");
  } finally {await env.cancel(); globalThis.FilePicker = original;}
});

test("preview uses the edited draft without saving it to the reward entry", async () => {
  const env = editor(), before = structuredClone(env.item); let previewed;
  env.app._previewStarRail = async (item, rarity) => {previewed = {item, rarity};};
  env.root.input("splashArt", "preview-only.png"); env.root.click("preview"); await turn();
  assert.equal(previewed.item.reveal.telysHSR.overrides.splashArt, "preview-only.png");
  assert.equal(previewed.rarity.id, "five"); assert.deepEqual(env.item, before);
  await env.cancel();
});

test("clearing an Actor link affects only the selected entry and only after Save", async () => {
  const env = editor(), other = structuredClone(env.other);
  env.root.click("unlink"); await turn(); assert.equal(env.item.reveal.telysHSR.actorUuid, "Actor.Welt");
  await env.save(); assert.equal(env.item.reveal.telysHSR, undefined); assert.equal(env.item.reveal.kind, "character");
  assert.deepEqual(env.other, other);
});

test("draft commits reject mismatched entries and editor labels escape markup", () => {
  const item = reward(), draft = createRewardDraft(item);
  assert.throws(() => applyRewardDraft({...item, entryId: "another"}, draft), /removed or replaced/);
  assert.doesNotMatch(rewardEditorHTML({...item, name: '<img onerror="bad">'}), /<img onerror/);
});
