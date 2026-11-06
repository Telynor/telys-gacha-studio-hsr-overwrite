import {ID, HOST_ID, REVEAL_KEY, appElement, clamp, clone, escapeHTML, safeImage, setting} from "./constants.js";
import {actorFromDrop, characterConfig, linkCharacter, resolveStars, unlinkCharacter} from "./character.js";
import {attachArtFraming} from "./art-framing.js";

const activeEditors = new WeakMap();
const editableFields = ["name", "pathName", "elementName", "pathIcon", "elementIcon", "splashArt"];
const framingFields = ["artScale", "artX", "artY", "portraitScale", "portraitX", "portraitY"];

export function rewardEditorHTML(item, {dropOpen = Boolean(characterConfig(item).actorUuid), framingMode = "portrait"} = {}) {
  const config = characterConfig(item), imported = config.snapshot || {}, overrides = config.overrides || {};
  const value = field => escapeHTML(overrides[field] || imported[field] || item.reveal?.[field] || "");
  const imageField = (field, label) => `<label class="tgs-editor-image-field">${label}<div class="tgs-editor-input-row"><input type="text" data-tgs-field="${field}" value="${value(field)}" placeholder="Image file path"><button type="button" data-tgs-editor-action="browse" data-tgs-image-field="${field}"><i class="fas fa-folder-open" aria-hidden="true"></i> Upload / choose</button></div></label>`;
  const character = Boolean(config.actorUuid || imported.actorUuid || item.reveal?.kind === "character");
  const prefix = character && framingMode === "portrait" ? "portrait" : "art";
  const scale = clamp(Number(config[`${prefix}Scale`]) || 100, 25, 300);
  const scaleField = `<label>Zoom (%)<input type="number" data-tgs-field="${prefix}Scale" min="25" max="300" step="1" value="${scale}"></label>`;
  const framing = character ? `<section class="tgs-editor-section" aria-label="Character art framing"><h3>Character art framing</h3>
      <label>Adjust<select data-tgs-framing-mode><option value="portrait" ${framingMode === "portrait" ? "selected" : ""}>10-pull portrait</option><option value="reveal" ${framingMode === "reveal" ? "selected" : ""}>Reveal splash art</option></select></label>
      <div class="tgs-art-preview-frame" data-tgs-art-frame><canvas class="tgs-art-preview" data-tgs-art-preview tabindex="0" role="img" aria-label="Character art preview. Drag to move the art, scroll to zoom, or use the arrow keys."></canvas><span class="tgs-art-status" data-tgs-art-status>Loading artwork…</span>${framingMode === "portrait" ? `<span class="tgs-art-preview-caption" data-tgs-art-caption>${escapeHTML(overrides.name || imported.name || item.name)}</span>` : ""}</div>
      <p class="tgs-editor-note">Drag the art to reposition it. Scroll to zoom. ${framingMode === "portrait" ? "This portrait appears on the 10-pull summary card. Reveal splash art has separate framing." : "The reveal frame matches this browser's screen shape; its labels stay fixed."}</p>
      <div class="tgs-editor-fields">${scaleField}<label>Horizontal offset (%)<input type="number" data-tgs-field="${prefix}X" min="-200" max="200" step="0.1" value="${clamp(config[`${prefix}X`], -200, 200)}"></label><label>Vertical offset (%)<input type="number" data-tgs-field="${prefix}Y" min="-200" max="200" step="0.1" value="${clamp(config[`${prefix}Y`], -200, 200)}"></label></div>
      <label>Zoom<input type="range" data-tgs-field="${prefix}Scale" min="25" max="300" step="1" value="${scale}"></label>
      <div class="tgs-editor-actions"><button type="button" data-tgs-editor-action="reset-framing">${framingMode === "portrait" ? "Reset portrait framing" : "Fit whole artwork"}</button></div>
    </section>` : scaleField;
  return `<div class="tgs-entry-editor" data-tgs-entry-editor>
    <header class="tgs-editor-item"><img src="${escapeHTML(safeImage(item.img, "icons/svg/item-bag.svg"))}" alt=""><div><span>Reward item</span><strong>${escapeHTML(item.name || "Reward item")}</strong><code>${escapeHTML(item.uuid || "")}</code></div></header>
    <section class="tgs-editor-section" aria-label="Corresponding character">
      <h3>Corresponding character</h3>
      <div class="tgs-editor-actions"><button type="button" data-tgs-editor-action="choose">Choose corresponding character</button><button type="button" data-tgs-editor-action="refresh" ${config.actorUuid ? "" : "disabled"}>Refresh from actor</button><button type="button" data-tgs-editor-action="unlink" ${config.actorUuid ? "" : "disabled"}>Clear link</button></div>
      <div class="tgs-editor-actor-drop" data-tgs-actor-drop ${dropOpen ? "" : "hidden"}>
        <strong>${escapeHTML(imported.name || "Drop an Actor here")}</strong><span>Drag a character from Actors or an Actor compendium.</span>
        <input type="text" readonly aria-label="Corresponding character UUID" value="${escapeHTML(config.actorUuid || "")}">
      </div>
      <div class="tgs-editor-fields"><label>Name<input type="text" data-tgs-field="name" value="${value("name")}"></label><label>Path<input type="text" data-tgs-field="pathName" value="${value("pathName")}"></label><label>Element<input type="text" data-tgs-field="elementName" value="${value("elementName")}"></label></div>
    </section>
    <section class="tgs-editor-section" aria-label="Artwork and icons"><h3>Artwork and icons</h3>
      ${imageField("splashArt", "Splash artwork")}${imageField("pathIcon", "Path icon")}${imageField("elementIcon", "Element icon")}
      <div class="tgs-editor-art-tools"><button type="button" data-tgs-editor-action="actor-art">Use actor artwork</button><button type="button" data-tgs-editor-action="preview"><i class="fas fa-play" aria-hidden="true"></i> Preview this reward</button></div>
    </section>
    ${framing}
    <p class="tgs-editor-note">Save changes to apply these settings to this reward entry, then save the banner. The configured reward Item is still what the player receives.</p>
  </div>`;
}

export function createRewardDraft(item) {
  return {entryId: String(item.entryId || ""), itemUuid: String(item.uuid || ""), data: clone(item)};
}

/** Only this entry's presentation is committed; never replace its awarded Item. */
export function applyRewardDraft(item, draft) {
  if (!item || String(item.entryId || "") !== draft.entryId || String(item.uuid || "") !== draft.itemUuid) {
    throw new Error("This reward entry was removed or replaced. Close Config and reopen the current entry.");
  }
  const config = draft.data.reveal?.[REVEAL_KEY];
  if (config) {item.reveal ||= {}; item.reveal[REVEAL_KEY] = clone(config);}
  else if (item.reveal) delete item.reveal[REVEAL_KEY];
  return item;
}

function changeField(item, field, value) {
  if (!framingFields.includes(field) && !editableFields.includes(field)) return;
  item.reveal ||= {}; item.reveal[REVEAL_KEY] ||= {};
  const config = item.reveal[REVEAL_KEY];
  if (framingFields.includes(field)) config[field] = field.endsWith("Scale") ? clamp(value, 25, 300) : clamp(value, -200, 200);
  else {config.overrides ||= {}; config.overrides[field] = String(value || "").trim();}
}

function notify(error) {
  console.error(`${ID} | Reward editor`, error);
  globalThis.ui?.notifications?.warn(error.message || String(error));
}

export async function openRewardEditor(app, {item, rarityId}, {preview, DialogClass = globalThis.foundry?.applications?.api?.DialogV2} = {}) {
  if (!DialogClass?.wait) throw new Error("Foundry's configuration window is unavailable.");
  let editors = activeEditors.get(app);
  if (!editors) {editors = new Map(); activeEditors.set(app, editors);}
  const bannerId = app.targetBannerId, key = `${bannerId}:${rarityId}:${item.entryId}`;
  const existing = editors.get(key);
  if (existing) {existing.dialog?.bringToFront(); return existing.promise;}

  const draft = createRewardDraft(item), controller = new AbortController(), pending = new Set();
  const record = {}; editors.set(key, record);
  let root, framing, closed = false, dropOpen = Boolean(characterConfig(item).actorUuid), version = 0, framingMode = "portrait";
  const content = () => root?.querySelector("[data-tgs-entry-editor]");
  const syncFraming = except => {
    const config = characterConfig(draft.data);
    for (const input of content()?.querySelectorAll?.("[data-tgs-field]") || []) {
      const field = input.dataset.tgsField;
      if (input !== except && framingFields.includes(field)) input.value = String(Math.round((Number(config[field]) || (field.endsWith("Scale") ? 100 : 0)) * 100) / 100);
    }
  };
  const mountFraming = () => {
    framing?.destroy();
    const rules = setting(HOST_ID, "systemRules", {}), rarity = (rules.rarities || []).find(value => value.id === rarityId) || {id: rarityId};
    framing = attachArtFraming(content(), draft.data, {mode: framingMode, stars: resolveStars({item: draft.data, rarity}, rules), onChange: patch => {
      for (const [field, value] of Object.entries(patch)) changeField(draft.data, field, value);
      syncFraming();
    }});
  };
  const repaint = () => {const node = content(); if (!closed && node) {node.outerHTML = rewardEditorHTML(draft.data, {dropOpen, framingMode}); mountFraming();}};
  const run = action => {
    const task = Promise.resolve().then(action).catch(notify).finally(() => pending.delete(task));
    pending.add(task); return task;
  };
  const importActor = async data => {
    const request = ++version, actor = await actorFromDrop(data);
    if (closed || request !== version) return;
    linkCharacter(draft.data, actor); dropOpen = true; repaint();
  };
  const render = (_event, dialog) => {
    record.dialog = dialog;
    const element = appElement(dialog);
    if (!element || element === root) return;
    root = element;
    const options = {signal: controller.signal};
    const update = event => {
      if (!closed && event.target?.dataset?.tgsFramingMode !== undefined) {
        if (event.type !== "input") {framingMode = event.target.value === "reveal" ? "reveal" : "portrait"; repaint();} return;
      }
      if (closed || !event.target?.dataset?.tgsField) return;
      changeField(draft.data, event.target.dataset.tgsField, event.target.value);
      syncFraming(event.type === "input" ? event.target : null); framing?.refresh();
    };
    root.addEventListener("input", update, options);
    root.addEventListener("change", update, options);
    root.addEventListener("dragover", event => {
      if (!event.target?.closest?.("[data-tgs-actor-drop]")) return;
      event.preventDefault(); event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "link";
    }, {...options, capture: true});
    root.addEventListener("drop", event => {
      if (!event.target?.closest?.("[data-tgs-actor-drop]")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void run(() => {
        const Editor = globalThis.foundry?.applications?.ux?.TextEditor?.implementation;
        const data = Editor?.getDragEventData ? Editor.getDragEventData(event) : JSON.parse(event.dataTransfer.getData("text/plain"));
        return importActor(data);
      });
    }, {...options, capture: true});
    root.addEventListener("click", event => {
      const button = event.target?.closest?.("[data-tgs-editor-action]");
      if (!button || closed) return;
      event.preventDefault(); event.stopPropagation();
      void run(async () => {
        const config = characterConfig(draft.data);
        switch (button.dataset.tgsEditorAction) {
          case "choose": {
            dropOpen = true;
            const zone = content()?.querySelector("[data-tgs-actor-drop]");
            if (zone) {zone.hidden = false; zone.querySelector("input")?.focus();}
            break;
          }
          case "refresh": if (config.actorUuid) await importActor({type: "Actor", uuid: config.actorUuid}); break;
          case "unlink": version++; unlinkCharacter(draft.data); dropOpen = true; repaint(); break;
          case "actor-art": if (config.overrides) delete config.overrides.splashArt; repaint(); break;
          case "reset-framing": {
            const prefix = framingMode === "portrait" ? "portrait" : "art";
            for (const [field, value] of Object.entries({[`${prefix}Scale`]: 100, [`${prefix}X`]: 0, [`${prefix}Y`]: 0})) changeField(draft.data, field, value);
            syncFraming(); framing?.refresh(); break;
          }
          case "browse": {
            const Picker = globalThis.foundry?.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;
            if (!Picker) throw new Error("Foundry's image browser is unavailable.");
            const field = button.dataset.tgsImageField;
            if (!["splashArt", "pathIcon", "elementIcon"].includes(field)) return;
            const picker = new Picker({type: "image", current: safeImage(config.overrides?.[field] || config.snapshot?.[field]), callback: path => {
              if (!closed) {changeField(draft.data, field, path); repaint();}
            }});
            await picker.render({force: true}); break;
          }
          case "preview": {
            const rules = setting(HOST_ID, "systemRules", {}), rarity = (rules.rarities || []).find(value => value.id === rarityId) || {id: rarityId};
            if (app._previewStarRail) await app._previewStarRail(draft.data, rarity);
            else await preview?.([{item: draft.data, rarity}], bannerId);
            break;
          }
        }
      });
    }, options);
    mountFraming();
  };
  const save = async () => {
    while (pending.size) await Promise.all([...pending]);
    if (closed) return null;
    if (app.targetBannerId !== bannerId) throw new Error("The open banner changed. Reopen Config for the reward you want to edit.");
    const current = app._currentPoolData?.[rarityId]?.find(entry => String(entry.entryId) === draft.entryId);
    applyRewardDraft(current, draft);
    return true;
  };
  const cleanup = () => {closed = true; version++; framing?.destroy(); controller.abort(); if (editors.get(key) === record) editors.delete(key);};
  try {
    record.promise = DialogClass.wait({
      window: {title: `Config — ${item.name || "Reward item"}`, resizable: true},
      position: {width: 720}, classes: ["tgs-reward-config-window"], modal: false, rejectClose: false,
      content: rewardEditorHTML(draft.data, {dropOpen, framingMode}), render,
      buttons: [
        {action: "save", label: "Save changes", icon: "fas fa-check", default: true, callback: save},
        {action: "cancel", label: "Cancel", callback: () => null},
      ],
      close: cleanup,
    });
    return await record.promise;
  } finally {cleanup();}
}
