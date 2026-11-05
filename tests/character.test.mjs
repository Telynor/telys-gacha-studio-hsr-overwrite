import test from "node:test";
import assert from "node:assert/strict";
import {readCharacter, linkCharacter, unlinkCharacter, resolveStars, resolveVisual, actorFromDrop} from "../scripts/character.js";
import {ID, ACTOR_MODULE_ID} from "../scripts/constants.js";

const definitions = {paths: [{id: "nihility", name: "Nihility", icon: "paths/nihility.png"}, {id: "erudition", name: "Erudition", icon: "paths/erudition.png"}], elements: [{id: "imaginary", name: "Imaginary", icon: "elements/imaginary.png"}, {id: "fire", name: "Fire", icon: "elements/fire.png"}]};
const actor = (name, pathId, elementId) => ({documentName: "Actor", uuid: `Actor.${name}`, name, img: `portrait/${name}.png`, getFlag: namespace => namespace === ACTOR_MODULE_ID ? {pathId, elementId, splashImage: `splash/${name}.png`} : {}});
const reward = () => ({entryId: "entry-a", uuid: "Item.welt-character-card", name: "Welt Character Card", qty: 1, reveal: {}});

test("Welt and Himeko import their own saved Path, element, name, and splash", () => {
  const welt = readCharacter(actor("Welt", "nihility", "imaginary"), definitions);
  const himeko = readCharacter(actor("Himeko", "erudition", "fire"), definitions);
  assert.equal(welt.pathIcon, "paths/nihility.png"); assert.equal(welt.pathName, "Nihility");
  assert.equal(welt.elementName, "Imaginary"); assert.equal(welt.splashArt, "splash/Welt.png");
  assert.equal(himeko.pathIcon, "paths/erudition.png"); assert.equal(himeko.elementName, "Fire");
  assert.equal(himeko.splashArt, "splash/Himeko.png");
});
test("per-banner actor links and art overrides never replace the character-card Item UUID", async () => {
  const first = reward(), second = reward();
  linkCharacter(first, actor("Welt", "nihility", "imaginary"), definitions);
  linkCharacter(second, actor("Welt", "nihility", "imaginary"), definitions);
  first.reveal.telysHSR.overrides = {splashArt: "banner-a/welt.png"};
  const before = structuredClone(first);
  const a = await resolveVisual({item: first, rarity: {name: "5★"}}, {}, {resolveUuid: async () => {throw new Error("GM-only Actor");}});
  const b = await resolveVisual({item: second, rarity: {name: "5★"}}, {}, {resolveUuid: async () => null});
  assert.equal(a.art, "banner-a/welt.png"); assert.equal(b.art, "splash/Welt.png");
  assert.equal(a.name, "Welt"); assert.equal(a.rewardItemUuid, "Item.welt-character-card");
  assert.deepEqual(first, before); assert.equal(second.reveal.telysHSR.overrides, undefined);
  unlinkCharacter(first); assert.equal(first.uuid, "Item.welt-character-card");
  assert.equal(second.reveal.telysHSR.actorUuid, "Actor.Welt");
});
test("saved presentation works when players cannot load the source Actor", async () => {
  const item = reward(); linkCharacter(item, actor("Welt", "nihility", "imaginary"), definitions);
  const result = {item, rarity: {stars: 5}, isPromoHit: false, won5050: false};
  const visual = await resolveVisual(result, {}, {resolveUuid: async () => null});
  assert.equal(visual.stars, 5); assert.equal(visual.name, "Welt"); assert.equal(visual.kind, "character");
  assert.equal(visual.elementIcon, "elements/imaginary.png"); assert.equal(visual.pathIcon, "paths/nihility.png");
});
test("the actual pull rarity wins over legacy visual overrides and 50/50 flags", () => {
  assert.equal(resolveStars({rarity: {stars: 3}, item: {reveal: {stars: 5}}, isPromoHit: true}), 3);
  assert.equal(resolveStars({rarity: {name: "4-star"}, won5050: true}), 4);
  assert.equal(resolveStars({rarity: {id: "ssr"}, isPromoHit: false}, {promoRarityId: "ssr"}), 5);
});
test("Light Cones use the linked Item image and Path", async () => {
  const doc = {img: "items/void.png", getFlag: namespace => namespace === ACTOR_MODULE_ID ? {enabled: true, pathId: "nihility", image: "cones/void.png"} : {}};
  const result = {item: {uuid: "Item.void", name: "Void"}, rarity: {stars: 3}};
  const visual = await resolveVisual(result, {}, {resolveUuid: async () => doc, definitions});
  assert.equal(visual.kind, "lightCone"); assert.equal(visual.art, "cones/void.png"); assert.equal(visual.pathName, "Nihility");
  assert.equal(visual.elementName, ""); assert.equal(visual.rewardItemUuid, "Item.void");
});
test("Actor drop accepts world and compendium UUIDs and rejects Items", async () => {
  const welt = actor("Welt", "nihility", "imaginary");
  for (const uuid of ["Actor.Welt", "Compendium.campaign.characters.Actor.Welt"]) {
    assert.equal(await actorFromDrop({type: "Actor", uuid}, {ActorClass: null, resolveUuid: async () => welt}), welt);
  }
  await assert.rejects(actorFromDrop({type: "Item", uuid: "Item.card"}), /Actor/);
});
test("unknown Path icons are omitted instead of substituting another character's icon", () => {
  const unknown = readCharacter(actor("Custom", "custom-path", "custom-element"), definitions);
  assert.equal(unknown.pathName, "custom-path"); assert.equal(unknown.pathIcon, "");
});
