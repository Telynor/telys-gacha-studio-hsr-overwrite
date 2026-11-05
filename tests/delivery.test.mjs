import test from "node:test";
import assert from "node:assert/strict";
import {ID} from "../scripts/constants.js";
import {getPullHistory, installDeliveryBeforeReveal} from "../scripts/delivery.js";

const turn = () => new Promise(resolve => setImmediate(resolve));
const gate = () => {let resolve, reject; const promise = new Promise((ok, fail) => {resolve = ok; reject = fail;}); return {promise, resolve, reject};};

function fixture({save, present, payment, chat, update = false, source = true, enabled = true} = {}) {
  const events = [], flags = new Map(), inventory = [], notices = [];
  const banner = {id: "banner-a"}, results = [{item: {uuid: "Item.welt-card", name: "Welt Card", qty: 2}, rarity: {id: "five", stars: 5}}];
  const before = {game: globalThis.game, fromUuid: globalThis.fromUuid, ui: globalThis.ui};
  globalThis.game = {user: {id: "owner"}, settings: {get: (_ns, key) => key === "bannerList" ? [banner] : undefined}};
  globalThis.fromUuid = async () => source ? {toObject: () => ({name: "Welt Card"})} : null;
  globalThis.ui = {notifications: {error: message => notices.push(message), warn: message => notices.push(message)}};
  const actor = {
    getFlag: (_ns, key) => flags.get(key),
    setFlag: async (_ns, key, value) => {flags.set(key, structuredClone(value));},
    async createEmbeddedDocuments(type, items) {
      assert.equal(this, actor); assert.equal(type, "Item"); events.push("saving");
      await save?.(); inventory.push(...items); events.push("saved"); return items;
    },
    async updateEmbeddedDocuments(type, items) {return this.createEmbeddedDocuments(type, items);},
  };
  class Animation {static async play(selected, selectedBanner) {events.push(selectedBanner.preview ? "preview" : "reveal"); await present?.(selected); return selected;}}
  class Roller {
    static async performRoll(_bannerId, _type, recipient) {
      events.push("paid"); await payment?.();
      const selected = await Animation.play(results, banner);
      await this._deliverItems(recipient, selected);
      events.push("chat"); await chat?.(); return true;
    }
    static async _deliverItems(recipient, selected) {
      // The supplied host awaits updates, but starts creates without awaiting.
      const items = selected.map(result => ({uuid: result.item.uuid, qty: result.item.qty}));
      if (update) await recipient.updateEmbeddedDocuments("Item", items).catch(() => {});
      else recipient.createEmbeddedDocuments("Item", items).catch(() => {});
    }
  }
  installDeliveryBeforeReveal(Roller, Animation, {enabled: () => enabled});
  return {actor, banner, results, events, inventory, flags, notices, Animation, Roller, restore() {Object.assign(globalThis, before);}};
}

test("inventory writes complete before playback; dismissing playback never grants a second copy", async () => {
  const saving = gate(), viewing = gate();
  const env = fixture({save: () => saving.promise, present: () => viewing.promise});
  try {
    const pull = env.Roller.performRoll("banner-a", "single", env.actor);
    await turn(); assert.deepEqual(env.events, ["paid", "saving"]); assert.equal(env.inventory.length, 0);
    const pending = getPullHistory(env.actor)[0];
    assert.equal(pending.status, "selected"); assert.deepEqual(pending.rewards, [{uuid: "Item.welt-card", name: "Welt Card", qty: 2, rarityId: "five"}]);
    saving.resolve(); await turn();
    assert.deepEqual(env.events, ["paid", "saving", "saved", "chat", "reveal"]);
    assert.equal(env.inventory.length, 1); assert.equal(getPullHistory(env.actor)[0].status, "delivered");
    viewing.resolve(); assert.equal(await pull, true); assert.equal(env.inventory.length, 1);
    assert.equal(env.events.filter(event => event === "paid").length, 1);
  } finally {saving.resolve(); viewing.resolve(); env.restore();}
});

test("the host's caught inventory error is reported with selected rewards recorded and no reveal", async () => {
  const env = fixture({save: async () => {throw new Error("Item validation failed");}});
  try {
    await assert.rejects(env.Roller.performRoll("banner-a", "multi", env.actor), /Item validation failed/);
    assert.equal(env.inventory.length, 0); assert(!env.events.includes("reveal"));
    const failed = getPullHistory(env.actor)[0];
    assert.equal(failed.status, "delivery-failed"); assert.equal(failed.rollType, "multi"); assert.equal(failed.rewards[0].uuid, "Item.welt-card");
    assert.match(env.notices[0], /recorded/);
  } finally {env.restore();}
});

test("inaccessible reward links are reported instead of being silently skipped", async () => {
  const env = fixture({source: false});
  try {
    await assert.rejects(env.Roller.performRoll("banner-a", "single", env.actor), /Cannot load reward Item/);
    assert.equal(env.inventory.length, 0); assert.equal(getPullHistory(env.actor)[0].status, "delivery-failed");
  } finally {env.restore();}
});

test("stacked inventory updates finish before the reveal too", async () => {
  const saving = gate(), env = fixture({update: true, save: () => saving.promise});
  try {
    const pull = env.Roller.performRoll("banner-a", "single", env.actor);
    await turn(); assert(!env.events.includes("reveal")); saving.resolve(); await pull;
    assert(env.events.indexOf("saved") < env.events.indexOf("reveal"));
  } finally {saving.resolve(); env.restore();}
});

test("a concurrent preview of the same banner is shown without capturing it as a paid pull", async () => {
  const payment = gate(), env = fixture({payment: () => payment.promise});
  try {
    const pull = env.Roller.performRoll("banner-a", "single", env.actor); await turn();
    const preview = [{item: {uuid: "Item.preview"}}];
    assert.equal(await env.Animation.play(preview, {...env.banner, preview: true}), preview);
    assert(env.events.includes("preview")); assert.equal(getPullHistory(env.actor).length, 0);
    payment.resolve(); await pull;
    assert.equal(getPullHistory(env.actor)[0].rewards[0].uuid, "Item.welt-card");
  } finally {payment.resolve(); env.restore();}
});

test("concurrent commits keep their own recipients and do not wait for another pull's playback", async () => {
  const viewing = gate(), env = fixture({present: () => viewing.promise});
  const otherFlags = new Map(), otherInventory = [];
  const other = {getFlag: (_ns, key) => otherFlags.get(key), setFlag: async (_ns, key, value) => otherFlags.set(key, value), createEmbeddedDocuments: async (_type, items) => otherInventory.push(...items)};
  try {
    const first = env.Roller.performRoll("banner-a", "single", env.actor);
    const second = env.Roller.performRoll("banner-a", "single", other);
    await turn(); await turn();
    assert.equal(env.inventory.length, 1); assert.equal(otherInventory.length, 1);
    assert.equal(getPullHistory(env.actor).length, 1); assert.equal(getPullHistory(other).length, 1);
    assert.notEqual(getPullHistory(env.actor)[0].id, getPullHistory(other)[0].id);
    viewing.resolve(); await Promise.all([first, second]);
  } finally {viewing.resolve(); env.restore();}
});

test("a chat failure after saved delivery does not suppress the reveal or grant duplicates", async () => {
  const env = fixture({chat: async () => {throw new Error("Chat unavailable");}}), previous = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await env.Roller.performRoll("banner-a", "single", env.actor), true);
    assert.equal(env.inventory.length, 1); assert(env.events.includes("reveal")); assert.equal(getPullHistory(env.actor)[0].status, "delivered");
  } finally {console.warn = previous; env.restore();}
});

test("a playback failure leaves saved rewards intact and ends the pull", async () => {
  const env = fixture({present: async () => {throw new Error("Video unavailable");}}), previous = console.error;
  console.error = () => {};
  try {
    assert.equal(await env.Roller.performRoll("banner-a", "single", env.actor), true);
    assert.equal(env.inventory.length, 1); assert.match(env.notices[0], /already been saved/);
  } finally {console.error = previous; env.restore();}
});

test("disabling the overwrite retains the original host flow and installation is idempotent", async () => {
  const env = fixture({enabled: false});
  try {
    await env.Roller.performRoll("banner-a", "single", env.actor); await turn();
    assert(env.events.indexOf("reveal") < env.events.indexOf("saved")); assert.equal(getPullHistory(env.actor).length, 0);
    assert.equal(installDeliveryBeforeReveal(env.Roller, env.Animation), false);
  } finally {env.restore();}
});

test("pull history is bounded and returned as a copy", async () => {
  const env = fixture();
  try {
    await env.actor.setFlag(ID, "pullHistory", Array.from({length: 25}, (_, id) => ({id: String(id), status: "delivered"})));
    await env.Roller.performRoll("banner-a", "single", env.actor);
    const history = getPullHistory(env.actor); assert.equal(history.length, 20);
    history.at(-1).status = "changed"; assert.equal(getPullHistory(env.actor).at(-1).status, "delivered");
  } finally {env.restore();}
});
