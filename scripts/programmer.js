import {ID, HOST_ID, REVEAL_KEY, clamp, escapeHTML, safeImage, setting} from "./constants.js";
import {actorFromDrop, characterConfig, linkCharacter, unlinkCharacter} from "./character.js";

const PATCH = Symbol.for(`${ID}.programmer`);
const attached = new WeakSet();
const versions = new WeakMap();

export function programmerHTML(item) {
  const config = characterConfig(item), imported = config.snapshot || {}, overrides = config.overrides || {};
  const value = field => escapeHTML(overrides[field] || imported[field] || "");
  const imageField = (field, label) => `<label class="tgs-wide">${label}<span class="tgs-input-row"><input type="text" data-tgs-field="${field}" value="${value(field)}" placeholder="Image file path"><button type="button" data-tgs-action="browse" data-tgs-image-field="${field}" aria-label="Upload or choose ${label.toLowerCase()}"><i class="fas fa-folder-open" aria-hidden="true"></i> Upload / choose</button></span></label>`;
  return `<details class="tgs-reward-settings" data-tgs-settings>
    <summary>HSR character reveal</summary>
    <div class="tgs-settings-body">
      <div class="tgs-wide tgs-character-actions"><button type="button" data-tgs-action="choose">Choose corresponding character</button><button type="button" data-tgs-action="refresh" ${config.actorUuid ? "" : "disabled"}>Refresh from actor</button><button type="button" data-tgs-action="unlink" ${config.actorUuid ? "" : "disabled"}>Clear link</button></div>
      <div class="tgs-actor-drop tgs-wide" data-tgs-actor-drop ${config.actorUuid ? "" : "hidden"}>
        <strong>${escapeHTML(imported.name || "Drop an Actor here")}</strong>
        <span>Drag a character from Actors or an Actor compendium.</span>
        <input type="text" readonly aria-label="Corresponding character UUID" value="${escapeHTML(config.actorUuid || "")}">
      </div>
      <label>Name<input type="text" data-tgs-field="name" value="${value("name")}"></label>
      <label>Path<input type="text" data-tgs-field="pathName" value="${value("pathName")}"></label>
      <label>Element<input type="text" data-tgs-field="elementName" value="${value("elementName")}"></label>
      ${imageField("pathIcon", "Path icon")}${imageField("elementIcon", "Element icon")}${imageField("splashArt", "Splash artwork")}
      <label>Art scale (%)<input type="number" data-tgs-field="artScale" min="25" max="300" step="5" value="${Number(config.artScale) || 100}"></label>
      <div class="tgs-wide tgs-character-actions"><button type="button" data-tgs-action="actor-art">Use actor artwork</button><button type="button" data-tgs-action="preview">Preview this reward</button></div>
      <p class="tgs-wide tgs-reward-note">Awarded item: <strong>${escapeHTML(item.name || "Reward item")}</strong>. Save the banner to keep this reward's character link and artwork.</p>
    </div>
  </details>`;
}

function entryFor(app, target) {
  const row = target?.closest?.(".pool-item-row"), section = row?.closest(".pool-section");
  const rarityId = section?.dataset.rarityId;
  const item = app._currentPoolData?.[rarityId]?.find(entry => String(entry.entryId) === String(row?.dataset.entryId));
  return item ? {item, row, rarityId} : null;
}
function repaint(row, item) {
  const panel = row.querySelector("[data-tgs-settings]");
  if (!panel) return;
  panel.outerHTML = programmerHTML(item);
  row.querySelector("[data-tgs-settings]").open = true;
}
function changeField(item, field, value) {
  item.reveal ||= {}; item.reveal[REVEAL_KEY] ||= {};
  const config = item.reveal[REVEAL_KEY];
  if (field === "artScale") config.artScale = clamp(value, 25, 300);
  else if (["name", "pathName", "pathIcon", "elementName", "elementIcon", "splashArt"].includes(field)) {
    config.overrides ||= {};
    config.overrides[field] = String(value || "").trim();
  }
}
function notify(error) { console.error(`${ID} | Character programmer`, error); globalThis.ui?.notifications?.warn(error.message || String(error)); }

async function browseImage(item, row, field) {
  const Picker = globalThis.foundry?.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
  if (!Picker) throw new Error("Foundry's image browser is unavailable.");
  const config = characterConfig(item);
  const picker = new Picker({type: "image", current: safeImage(config.overrides?.[field] || config.snapshot?.[field]), callback: path => {changeField(item, field, path); repaint(row, item);}});
  await picker.render({force: true});
}

export function attachProgrammer(app, {preview} = {}) {
  const root = app.element?.[0] || app.element;
  if (!root || attached.has(root) || globalThis.game?.user?.isGM === false) return;
  attached.add(root);
  const update = event => {
    const field = event.target?.dataset?.tgsField;
    if (!field) return;
    const entry = entryFor(app, event.target);
    if (entry) changeField(entry.item, field, event.target.value);
  };
  root.addEventListener("input", update);
  root.addEventListener("change", update);
  root.addEventListener("dragover", event => {
    const zone = event.target?.closest?.("[data-tgs-actor-drop]");
    if (zone) {event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = "link";}
  }, true);
  root.addEventListener("drop", event => {
    if (!event.target?.closest?.("[data-tgs-actor-drop]")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const entry = entryFor(app, event.target);
    if (!entry) return;
    const version = (versions.get(entry.item) || 0) + 1; versions.set(entry.item, version);
    void (async () => {
      const Editor = globalThis.foundry?.applications?.ux?.TextEditor?.implementation;
      const data = Editor?.getDragEventData ? Editor.getDragEventData(event) : JSON.parse(event.dataTransfer.getData("text/plain"));
      const actor = await actorFromDrop(data);
      if (versions.get(entry.item) !== version) return;
      linkCharacter(entry.item, actor); repaint(entry.row, entry.item);
    })().catch(notify);
  }, true);
  root.addEventListener("click", event => {
    const button = event.target?.closest?.("[data-tgs-action]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const entry = entryFor(app, button);
    if (!entry) return;
    void (async () => {
      const {item, row, rarityId} = entry, config = characterConfig(item);
      switch (button.dataset.tgsAction) {
        case "choose": {
          const zone = row.querySelector("[data-tgs-actor-drop]");
          zone.hidden = false; zone.querySelector("input")?.focus(); break;
        }
        case "refresh": {
          if (!config.actorUuid) return;
          const actor = await globalThis.fromUuid(config.actorUuid);
          linkCharacter(item, actor); repaint(row, item); break;
        }
        case "unlink": versions.set(item, (versions.get(item) || 0) + 1); unlinkCharacter(item); repaint(row, item); break;
        case "browse": await browseImage(item, row, button.dataset.tgsImageField); break;
        case "actor-art": if (config.overrides) delete config.overrides.splashArt; repaint(row, item); break;
        case "preview": {
          const rules = setting(HOST_ID, "systemRules", {}), rarity = (rules.rarities || []).find(value => value.id === rarityId) || {id: rarityId};
          if (app._previewStarRail) await app._previewStarRail(item, rarity);
          else await preview?.([{item, rarity}], app.targetBannerId);
          break;
        }
      }
    })().catch(notify);
  });
}

export function installProgrammer(ConfigClass, options) {
  const proto = ConfigClass?.prototype;
  if (!proto || typeof proto._generateItemHTML !== "function") throw new Error("This Gacha Studio version does not expose the reward programmer.");
  if (proto[PATCH]) return false;
  const generate = proto._generateItemHTML, render = proto._onRender;
  proto._generateItemHTML = function(item) {
    const html = generate.call(this, item), end = html.lastIndexOf("</div>");
    return end < 0 ? html + programmerHTML(item) : html.slice(0, end) + programmerHTML(item) + html.slice(end);
  };
  proto._onRender = async function(...args) { const result = await render?.apply(this, args); attachProgrammer(this, options); return result; };
  Object.defineProperty(proto, PATCH, {value: true});
  return true;
}
