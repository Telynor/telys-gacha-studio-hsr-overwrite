import {ID, appElement, escapeHTML} from "./constants.js";
import {openRewardEditor} from "./reward-editor.js";

const PATCH = Symbol.for(`${ID}.programmer`);
const attached = new WeakSet();

export function programmerHTML(item) {
  return `<div class="tgs-entry-config-footer"><button type="button" class="tgs-entry-config-button" data-tgs-config aria-label="Configure ${escapeHTML(item.name || "reward")}"><i class="fas fa-cog" aria-hidden="true"></i> Config</button></div>`;
}

export function entryFor(app, target) {
  const row = target?.closest?.(".pool-item-row"), section = row?.closest(".pool-section");
  const rarityId = section?.dataset.rarityId;
  const item = app._currentPoolData?.[rarityId]?.find(entry => String(entry.entryId) === String(row?.dataset.entryId));
  return item ? {item, row, rarityId} : null;
}

export function attachProgrammer(app, {preview, openEditor = openRewardEditor} = {}) {
  const root = appElement(app);
  if (!root || attached.has(root) || globalThis.game?.user?.isGM === false) return;
  attached.add(root);
  root.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-tgs-config]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const entry = entryFor(app, button);
    if (!entry) return;
    void Promise.resolve().then(() => openEditor(app, entry, {preview})).catch(error => {
      console.error(`${ID} | Reward editor`, error);
      globalThis.ui?.notifications?.warn(error.message || String(error));
    });
  });
}

export function installProgrammer(ConfigClass, options) {
  const proto = ConfigClass?.prototype;
  if (!proto || typeof proto._generateItemHTML !== "function") throw new Error("This Gacha Studio version does not expose the reward programmer.");
  if (proto[PATCH]) return false;
  const generate = proto._generateItemHTML, render = proto._onRender;
  proto._generateItemHTML = function(item) {
    const original = generate.call(this, item);
    const pattern = /class=(["'])([^"']*\bpool-item-row\b[^"']*)\1/;
    if (!pattern.test(original) || original.lastIndexOf("</div>") < 0) return original;
    const html = original.replace(pattern, (_, quote, classes) => `class=${quote}${classes} tgs-entry-configurable${quote}`);
    const closing = html.lastIndexOf("</div>");
    return html.slice(0, closing) + programmerHTML(item) + html.slice(closing);
  };
  proto._onRender = async function(...args) { const result = await render?.apply(this, args); attachProgrammer(this, options); return result; };
  Object.defineProperty(proto, PATCH, {value: true});
  return true;
}
