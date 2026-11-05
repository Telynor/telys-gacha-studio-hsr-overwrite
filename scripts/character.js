import {ACTOR_MODULE_ID, ID, REVEAL_KEY, safeImage, setting, clone} from "./constants.js";

function flag(document, namespace, key) {
  try { return document?.getFlag?.(namespace, key) ?? document?.flags?.[namespace]?.[key] ?? {}; }
  catch { return {}; }
}
const entries = value => (Array.isArray(value) ? value : Object.values(value || {})).filter(Boolean);
function definition(value, definitions) {
  if (value && typeof value === "object") return value;
  const key = String(value || "").trim().toLowerCase();
  return definitions.find(entry => String(entry.id || "").toLowerCase() === key || String(entry.name || "").toLowerCase() === key)
    || {id: String(value || ""), name: String(value || ""), icon: ""};
}
export function actorDefinitions() {
  return {paths: entries(setting(ACTOR_MODULE_ID, "paths", [])), elements: entries(setting(ACTOR_MODULE_ID, "elements", []))};
}

/** Read once when programming the reward; never modify the source Actor. */
export function readCharacter(actor, {paths, elements, api} = {}) {
  if (!actor || actor.documentName !== "Actor") throw new Error("Drop an Actor to choose the corresponding character.");
  const definitions = actorDefinitions();
  paths ??= definitions.paths; elements ??= definitions.elements;
  api ??= globalThis.game?.modules?.get(ACTOR_MODULE_ID)?.api;
  let config = flag(actor, ACTOR_MODULE_ID, "ultimate");
  try { config = api?.getConfig?.(actor) || config; } catch { /* Stored flags remain available. */ }
  const custom = flag(actor, ID, "presentation");
  const system = actor.system || {};
  const path = definition(config.pathId || custom.path || system.details?.path || system.path, paths);
  const element = definition(config.elementId || custom.element || system.details?.element || system.element, elements);
  return {
    actorUuid: String(actor.uuid || ""),
    name: String(actor.name || "Character"),
    pathName: String(custom.pathName || path.name || ""),
    pathIcon: safeImage(custom.pathIcon || config.pathIcon || path.icon),
    elementName: String(custom.elementName || element.name || ""),
    elementIcon: safeImage(custom.elementIcon || config.elementIcon || element.icon),
    splashArt: safeImage(custom.splashArt || config.splashImage || system.splashArt || actor.img),
    portrait: safeImage(actor.img),
  };
}

export function characterConfig(entry) { return entry?.reveal?.[REVEAL_KEY] || {}; }
export function linkCharacter(entry, actor, options) {
  const snapshot = readCharacter(actor, options);
  entry.reveal ||= {};
  const previous = characterConfig(entry);
  entry.reveal[REVEAL_KEY] = {...previous, actorUuid: snapshot.actorUuid, snapshot: clone(snapshot)};
  return entry.reveal[REVEAL_KEY];
}

/** The Actor UUID is presentation metadata. entry.uuid always remains the awarded Item. */
export function unlinkCharacter(entry) {
  if (entry?.reveal) delete entry.reveal[REVEAL_KEY];
}

export async function actorFromDrop(data, {resolveUuid = globalThis.fromUuid, ActorClass = globalThis.Actor} = {}) {
  if (data?.type !== "Actor") throw new Error("Choose corresponding character accepts Actor drops.");
  let actor;
  if (ActorClass?.implementation?.fromDropData) actor = await ActorClass.implementation.fromDropData(data);
  else if (ActorClass?.fromDropData) actor = await ActorClass.fromDropData(data);
  else if (data.uuid) actor = await resolveUuid?.(data.uuid);
  else if (data.id) actor = globalThis.game?.actors?.get(data.id);
  if (actor?.documentName !== "Actor") throw new Error("The dropped character could not be found.");
  return actor;
}

export function resolveStars(result, rules = {}) {
  const rarity = result.rarity || {};
  const explicit = Number(rarity.stars);
  if ([3, 4, 5].includes(explicit)) return explicit;
  const label = `${rarity.name || ""} ${rarity.id || ""}`;
  const match = label.match(/([345])\s*(?:[- ]?stars?|\*|★|⭐|estrellas?)/i);
  if (match) return Number(match[1]);
  if (/\b(?:SSR|legendary|legendario)\b/i.test(label)) return 5;
  if (/\b(?:SR|epic|épico)\b/i.test(label)) return 4;
  if (rarity.id && rarity.id === rules.promoRarityId) return 5;
  if (rarity.id && rarity.id === rules.tenPullRarityId) return 4;
  const ranked = [...(rules.rarities || [])].sort((a, b) => Number(a.prob) - Number(b.prob));
  const position = ranked.findIndex(entry => entry.id === rarity.id);
  if (position >= 0) return position === 0 ? 5 : position === 1 ? 4 : 3;
  const legacy = Number(result.item?.reveal?.stars);
  return [3, 4, 5].includes(legacy) ? legacy : 3;
}

/** Build a separate visual record; do not rename, replace, sort, or reroll rewards. */
export async function resolveVisual(result, banner = {}, {rules = {}, resolveUuid = globalThis.fromUuid, definitions} = {}) {
  const item = result.item || {}, legacy = item.reveal || {}, config = characterConfig(item);
  if (result.error) return {error: true, stars: 0, name: String(result.msg || "Reward unavailable"), kind: "other", art: "icons/svg/hazard.svg"};
  let snapshot = config.snapshot || {};
  if (config.actorUuid && !snapshot.name) {
    try { snapshot = readCharacter(await resolveUuid?.(config.actorUuid), definitions); }
    catch { /* Saved/legacy metadata below remains usable without Actor permission. */ }
  }
  let doc;
  try { if (item.uuid) doc = await resolveUuid?.(item.uuid); } catch { /* Use the reward-table record. */ }
  const lightCone = flag(doc, ACTOR_MODULE_ID, "lightCone");
  const character = Boolean(config.actorUuid || snapshot.actorUuid || legacy.kind === "character" || item.documentName === "Actor");
  const kind = character ? "character" : legacy.kind === "lightCone" || lightCone.enabled || /light[ -]?cone/i.test(`${item.name || ""} ${item.type || ""}`) ? "lightCone" : "other";
  const pathDefinitions = definitions?.paths ?? actorDefinitions().paths;
  const conePath = definition(lightCone.pathId, pathDefinitions);
  const overrides = config.overrides || {};
  const featured = (banner.rateUps || []).find(entry => String(entry.name || "").toLowerCase().trim() === String(item.name || "").toLowerCase().trim());
  const art = safeImage(overrides.splashArt || snapshot.splashArt || legacy.splashArt || lightCone.image || featured?.img || doc?.img || item.img, "icons/svg/item-bag.svg");
  return {
    stars: resolveStars(result, rules), kind,
    name: String(overrides.name || snapshot.name || item.name || "Reward"),
    pathName: String(overrides.pathName || snapshot.pathName || legacy.pathName || conePath.name || ""),
    pathIcon: safeImage(overrides.pathIcon || snapshot.pathIcon || legacy.pathIcon || conePath.icon),
    elementName: character ? String(overrides.elementName || snapshot.elementName || legacy.elementName || "") : "",
    elementIcon: character ? safeImage(overrides.elementIcon || snapshot.elementIcon || legacy.elementIcon) : "",
    art,
    cardArt: safeImage(config.cardArt || legacy.cardArt || snapshot.portrait || art, art),
    artScale: Math.max(25, Math.min(300, Number(config.artScale) || 100)),
    rewardItemUuid: String(item.uuid || ""),
  };
}
