import {ID, HOST_ID, clone, setting} from "./constants.js";

const PATCH = Symbol.for(`${ID}.delivery`);
const ANIMATION_PATCH = Symbol.for(`${ID}.animation`);
let sequence = 0;

export function getPullHistory(actor) {
  const history = actor?.getFlag?.(ID, "pullHistory");
  return Array.isArray(history) ? clone(history) : [];
}

async function recordPull(context, status, error) {
  if (!context.presentation || typeof context.actor?.setFlag !== "function") return;
  try {
    const history = getPullHistory(context.actor).filter(entry => entry.id !== context.id);
    history.push({
      id: context.id, at: context.at, userId: globalThis.game?.user?.id || "",
      bannerId: context.bannerId, rollType: context.rollType, status,
      rewards: context.presentation.results.filter(result => !result.error).map(result => ({
        uuid: String(result.item?.uuid || ""), name: String(result.item?.name || "Reward"),
        qty: Number(result.item?.qty) || 1, rarityId: String(result.rarity?.id || ""),
      })),
      ...(error ? {error: String(error.message || error)} : {}),
    });
    await context.actor.setFlag(ID, "pullHistory", history.slice(-20));
    context.recorded = true;
  } catch (error) {
    // A history write must never prevent the inventory delivery itself.
    console.warn(`${ID} | Could not save pull history.`, error);
  }
}

/** Keep the host's payment, RNG, pity, stacking, and delivery methods; defer playback. */
export function installDeliveryBeforeReveal(Roller, AnimationClass, {enabled = () => setting(ID, "enabled", true)} = {}) {
  if (Roller?.[PATCH]) return false;
  if (typeof Roller?.performRoll !== "function" || typeof Roller?._deliverItems !== "function" || typeof AnimationClass?.play !== "function") {
    throw new Error("This Gacha Studio version does not expose the reward delivery APIs.");
  }
  const performRoll = Roller.performRoll, deliver = Roller._deliverItems, present = AnimationClass.play;
  let active = null, commits = Promise.resolve();

  const defer = function(results, banner, ...args) {
    if (!enabled() || !active || banner !== active.banner) return present.call(this, results, banner, ...args);
    active.presentation = {results, banner, args, receiver: this};
    return recordPull(active, "selected").then(() => results);
  };
  if (present[ANIMATION_PATCH]) Object.defineProperty(defer, ANIMATION_PATCH, {value: true});
  AnimationClass.play = defer;

  Roller._deliverItems = async function(actor, results) {
    if (!active || active.actor !== actor) return deliver.call(this, actor, results);
    const context = active, writes = [];
    // Refuse silent partial delivery when a linked reward Item is inaccessible.
    for (const result of results.filter(result => !result.error)) {
      const source = await globalThis.fromUuid?.(result.item?.uuid);
      if (!source || typeof source.toObject !== "function") throw new Error(`Cannot load reward Item: ${result.item?.name || result.item?.uuid || "unknown reward"}. Check the reward link and its permissions.`);
    }
    // The host does not await createEmbeddedDocuments and catches write errors.
    // Observe its original calls, using the real Actor as receiver, and await them.
    const recipient = new Proxy(actor, {get(target, key) {
      const value = Reflect.get(target, key, target);
      if (["createEmbeddedDocuments", "updateEmbeddedDocuments"].includes(key)) return (...args) => {
        let operation;
        try {operation = Promise.resolve(value.apply(target, args));} catch (error) {operation = Promise.reject(error);}
        writes.push(operation); operation.catch(() => {}); return operation;
      };
      return typeof value === "function" ? value.bind(target) : value;
    }});
    let error, result;
    try {result = await deliver.call(this, recipient, results);} catch (caught) {error = caught;}
    const outcomes = await Promise.allSettled(writes);
    const failed = outcomes.find(outcome => outcome.status === "rejected");
    if (error || failed) throw error || failed.reason;
    if (results.some(result => !result.error) && !writes.length) throw new Error("Gacha Studio did not create or update any reward Items.");
    context.delivered = true;
    await recordPull(context, "delivered");
    return result;
  };

  Roller.performRoll = function(bannerId, rollType, actor, ...args) {
    if (!enabled()) return performRoll.call(this, bannerId, rollType, actor, ...args);
    const receiver = this;
    const commit = async () => {
      const context = {
        id: `${Date.now()}-${++sequence}`, at: Date.now(), bannerId, rollType, actor,
        banner: (setting(HOST_ID, "bannerList", [])).find(banner => banner.id === bannerId),
      };
      active = context;
      let value;
      try {value = await performRoll.call(receiver, bannerId, rollType, actor, ...args);}
      catch (error) {
        if (context.delivered) {
          console.warn(`${ID} | Rewards are saved, but the host's completion/chat step failed.`, error);
          value = true;
        } else {
          await recordPull(context, "delivery-failed", error);
          if (context.presentation) globalThis.ui?.notifications?.error(context.recorded
            ? "Gacha rewards could not be saved. The selected rewards are recorded in the recipient Actor's HSR pull history for GM review."
            : "Gacha rewards could not be saved. Ask your GM to review this pull before trying again.");
          throw error;
        }
      } finally {active = null;}
      return {value, context};
    };
    const committed = commits.then(commit, commit);
    commits = committed.then(() => {}, () => {});
    return committed.then(async ({value, context}) => {
      // A closed tab or failed video from this point cannot undo the saved rewards.
      if (context.delivered && context.presentation) {
        const {results, banner, args, receiver} = context.presentation;
        try {await present.call(receiver, results, banner, ...args);}
        catch (error) {
          console.error(`${ID} | Playback failed after rewards were saved.`, error);
          globalThis.ui?.notifications?.warn("The reveal could not finish, but your gacha rewards have already been saved to your inventory.");
        }
      }
      return value;
    });
  };
  Object.defineProperty(Roller, PATCH, {value: true});
  return true;
}
