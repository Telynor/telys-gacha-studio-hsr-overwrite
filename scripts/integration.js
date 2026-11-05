import {ID, HOST_ID, setting} from "./constants.js";
import {resolveVisual} from "./character.js";
import {playSequence} from "./sequence.js";

const PATCH = Symbol.for(`${ID}.animation`);

export function installAnimationOverride(AnimationClass, {renderer = playSequence, resolver = resolveVisual, enabled = () => setting(ID, "enabled", true)} = {}) {
  if (typeof AnimationClass?.play !== "function") throw new Error("Gacha Studio's animation handler could not be found.");
  if (AnimationClass.play[PATCH]) return false;
  const original = AnimationClass.play;
  let pending = Promise.resolve();
  const overwrite = function(results, banner, presentation = {}) {
    if (!enabled()) return original.call(this, results, banner, presentation);
    const run = async () => {
      try {
        const rules = setting(HOST_ID, "systemRules", {});
        const visuals = await Promise.all(results.map(result => resolver(result, banner, {rules})));
        await renderer(results, visuals, banner, {
          rate: setting(ID, "speed", 1.5), opening: setting(ID, "openingVideos", true),
          playSFX: (src, volume) => AnimationClass.playSFX?.(src, volume),
        });
      } catch (error) {
        console.error(`${ID} | Reveal failed; preserving the original reward results.`, error);
        const overlay = globalThis.document?.getElementById("tgs-hsr-overlay");
        if (overlay?._tgsFinish) overlay._tgsFinish(); else overlay?.remove();
      }
      // Exact same results object, Item UUIDs, quantities, rarity, pity, and order.
      return results;
    };
    const next = pending.then(run, run); pending = next.catch(() => {}); return next;
  };
  Object.defineProperty(overwrite, PATCH, {value: true});
  AnimationClass.play = overwrite;
  return true;
}
