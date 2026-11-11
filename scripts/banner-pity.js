import {ID, HOST_ID, setting} from "./constants.js";

const PATCH = Symbol.for(`${ID}.pity`);
export const classes = () => setting(ID, "bannerClasses", {});
export const banners = () => setting(HOST_ID, "bannerList", []);
export const classification = value => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);

export function sharedPityKey(key, groups = classes()) {
  const match = /^banners\.([^.]+)$/.exec(key);
  const name = match && Object.hasOwn(groups, match[1]) && classification(groups[match[1]]);
  if (!name) return key;
  const group = Array.from(name.toLowerCase(), char => char.codePointAt(0).toString(16)).join("-");
  return `hsrPityGroups.group-${group}`;
}

export function installSharedPity(ActorClass) {
  const proto = ActorClass?.prototype;
  if (!proto || proto[PATCH]) return;
  const {getFlag, setFlag} = proto;
  if (typeof getFlag !== "function" || typeof setFlag !== "function") {
    throw new Error("Actor flag access is required for shared banner pity.");
  }
  proto.getFlag = function(scope, key) {
    if (scope !== HOST_ID || !key.startsWith("banners.")) return getFlag.call(this, scope, key);
    const groups = classes();
    const shared = sharedPityKey(key, groups);
    const current = getFlag.call(this, scope, shared);
    if (shared === key || current != null) return current;
    // Before the first shared write, use the earliest configured banner with legacy progress.
    for (const banner of banners()) {
      const legacyKey = `banners.${banner.id}`;
      if (sharedPityKey(legacyKey, groups) !== shared) continue;
      const legacy = getFlag.call(this, scope, legacyKey);
      if (legacy && Object.keys(legacy).length) return legacy;
    }
    return undefined;
  };
  proto.setFlag = function(scope, key, value) {
    return setFlag.call(this, scope, scope === HOST_ID ? sharedPityKey(key) : key, value);
  };
  Object.defineProperty(proto, PATCH, {value: true});
}

const count = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

export function readPity(actor, bannerId) {
  const state = actor.getFlag(HOST_ID, `banners.${bannerId}`);
  return {
    pityCount: count(state?.pityCount ?? actor.getFlag(HOST_ID, "pityCount")),
    tenPityCount: count(state?.tenPityCount ?? actor.getFlag(HOST_ID, "tenPityCount")),
    guaranteedRateUp: Boolean(state?.guaranteedRateUp ?? actor.getFlag(HOST_ID, "guaranteedRateUp"))
  };
}

export async function setPlayerPity(playerId, bannerId, values) {
  if (!game.user.isGM) throw new Error("Only a GM can edit pity.");
  const actor = game.users.get(playerId)?.character;
  if (!actor || !banners().some(banner => banner.id === bannerId)) {
    throw new Error("Select a player with an assigned character and a saved banner.");
  }
  for (const value of [values.pityCount, values.tenPityCount]) {
    if (value === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0) {
      throw new Error("Pity counts must be nonnegative whole numbers.");
    }
  }
  return actor.setFlag(HOST_ID, `banners.${bannerId}`, {
    ...actor.getFlag(HOST_ID, `banners.${bannerId}`),
    pityCount: count(values.pityCount),
    tenPityCount: count(values.tenPityCount),
    guaranteedRateUp: Boolean(values.guaranteedRateUp)
  });
}
