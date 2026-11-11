import {test} from "node:test";
import assert from "node:assert/strict";
import {ID, HOST_ID} from "../scripts/constants.js";
import {installSharedPity, readPity, setPlayerPity} from "../scripts/banner-pity.js";
import {importBannerPool} from "../scripts/banner-settings.js";

const settings = {
  [ID]: {bannerClasses: {old: "Character Banner", next: " character banner ", cone: "Light Cone Banner"}},
  [HOST_ID]: {bannerList: [{id: "old"}, {id: "next"}, {id: "cone"}], systemRules: {rarities: [{id: "five"}, {id: "four"}]}}
};

class Actor {
  constructor() { this.flags = new Map(); }
  getFlag(scope, key) { return this.flags.get(`${scope}:${key}`); }
  async setFlag(scope, key, value) { this.flags.set(`${scope}:${key}`, value); }
}

globalThis.game = {settings: {get: (scope, key) => settings[scope]?.[key]}, user: {isGM: true}};

test("shared records inherit existing banner pity and preserve the guarantee across banner rotation", async () => {
  const actor = new Actor(), other = new Actor();
  const saved = {pityCount: 67, tenPityCount: 4, guaranteedRateUp: true};
  await actor.setFlag(HOST_ID, "banners.old", saved);
  installSharedPity(Actor);
  assert.deepEqual(readPity(actor, "old"), saved);
  assert.deepEqual(readPity(actor, "next"), saved);
  await actor.setFlag(HOST_ID, "banners.old", {...saved, pityCount: 68});
  assert.deepEqual(readPity(actor, "next"), {...saved, pityCount: 68});
  assert.equal(readPity(actor, "cone").pityCount, 0);
  assert.equal(readPity(other, "next").guaranteedRateUp, false);
  game.users = new Map([["player", {character: actor}]]);
  await setPlayerPity("player", "next", {pityCount: "12", tenPityCount: "2", guaranteedRateUp: false});
  assert.deepEqual(readPity(actor, "old"), {pityCount: 12, tenPityCount: 2, guaranteedRateUp: false});
  game.user.isGM = false;
  await assert.rejects(setPlayerPity("player", "next", saved), /Only a GM/);
});

test("pool import replaces every tier in the draft and keeps reward metadata independent", () => {
  const source = {isActive: false, pool: {five: [{uuid: "Item.1", isRateUp: true, qty: 2, reveal: {zoom: 2}}], four: []}};
  const app = {_currentPoolData: {four: [{uuid: "Item.2"}]}, _refreshPoolView() {}};
  importBannerPool(app, source);
  assert.deepEqual(app._currentPoolData, source.pool);
  app._currentPoolData.five[0].reveal.zoom = 1;
  assert.equal(source.pool.five[0].reveal.zoom, 2);
  assert.throws(() => importBannerPool(app, {pool: {missing: [{}]}}), /Restore these global rarity tiers/);
  assert.equal(app._currentPoolData.five[0].reveal.zoom, 1);
});
