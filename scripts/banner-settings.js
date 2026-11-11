import {ID, HOST_ID, appElement, clone, escapeHTML, setting} from "./constants.js";
import {banners, classes, classification, readPity, setPlayerPity} from "./banner-pity.js";

const PATCH = Symbol.for(`${ID}.banner-settings`);
const option = (value, label, selected) =>
  `<option value="${escapeHTML(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(label)}</option>`;
const title = banner => String(banner.title || banner.id).replace(/<[^>]*>/g, "");

export function importBannerPool(app, source) {
  const tiers = setting(HOST_ID, "systemRules", {}).rarities ?? [];
  const known = new Set(tiers.map(tier => tier.id));
  const missing = Object.entries(source.pool ?? {}).filter(([id, rewards]) => rewards.length && !known.has(id));
  if (missing.length) throw new Error(`Restore these global rarity tiers before importing: ${missing.map(([id]) => id).join(", ")}.`);
  app._currentPoolData = clone(source.pool ?? {});
  app._refreshPoolView();
}

const notifyError = error => ui.notifications.error(error.message || String(error));

function attachSettings(app) {
  if (!game.user.isGM || app.editMode !== "banner") return;
  const root = appElement(app);
  const general = root?.querySelector('.tab-pane[data-tab="general"]');
  const pool = root?.querySelector('#dynamic-pool-container');
  if (!general || !pool || root.querySelector('[data-tgs-pity-class]')) return;

  const all = banners();
  const current = app.targetBannerId || root.querySelector('[name="bannerId"]')?.value;
  const groups = classes();
  const names = [...new Set(Object.values(groups).map(classification).filter(Boolean))];
  const listId = `${app.id}-pity-classes`;
  general.insertAdjacentHTML("afterbegin", `<fieldset class="tgs-banner-settings">
    <legend>Carryover pity</legend>
    <label>Banner classification <input type="text" maxlength="100" data-tgs-pity-class list="${escapeHTML(listId)}" value="${escapeHTML(groups[current] || "")}"></label>
    <datalist id="${escapeHTML(listId)}">${names.map(name => option(name, name)).join("")}</datalist>
    <small>Enter a new classification or reuse one. Banners with the same classification share pity and the featured guarantee per character. Leave blank for separate pity.</small>
  </fieldset>`);

  const defaultId = setting(ID, "defaultBanner", "");
  const sources = all.filter(banner => banner.id !== current);
  const choices = list => list.map(banner =>
    option(banner.id, `${title(banner)}${banner.isActive === false ? " (inactive)" : ""}`, defaultId)).join("");
  pool.insertAdjacentHTML("beforebegin", `<fieldset class="tgs-banner-settings">
    <legend>Reward pool template</legend>
    <label>Copy rewards and tiers from <select data-tgs-pool-source>${option("", "Select a banner")}${choices(sources)}</select></label>
    <button type="button" data-tgs-import-pool>Replace reward pool</button>
    <label>Default banner for new pools <select data-tgs-default-banner>${option("", "None", defaultId)}${choices(all)}</select></label>
    <small>The default fills new banner pools. Import replaces this draft’s pool. Save Banner to apply it.</small>
  </fieldset>`);
  root.querySelector('[data-tgs-import-pool]').onclick = () => {
    const source = sources.find(banner => banner.id === root.querySelector('[data-tgs-pool-source]').value);
    if (!source) return;
    try { importBannerPool(app, source); }
    catch (error) { notifyError(error); }
  };
  root.querySelector('[data-tgs-default-banner]').onchange = async event => {
    try { await game.settings.set(ID, "defaultBanner", event.target.value); }
    catch (error) { event.target.value = setting(ID, "defaultBanner", ""); notifyError(error); }
  };
  if (!app.targetBannerId && !app._tgsDefaultPoolApplied) {
    app._tgsDefaultPoolApplied = true;
    const source = sources.find(banner => banner.id === defaultId);
    if (source && !Object.values(app._currentPoolData ?? {}).some(items => items.length)) {
      try { importBannerPool(app, source); }
      catch (error) { notifyError(error); }
    }
  }

  const players = game.users.filter(user => !user.isGM && user.character);
  if (!all.some(banner => banner.id === current) || !players.length) return;
  general.insertAdjacentHTML("beforeend", `<fieldset class="tgs-banner-settings" data-tgs-pity-editor>
    <legend>Adjust player pity for this banner</legend>
    <label>Player <select data-tgs-player>${players.map(user => option(user.id, `${user.name} · ${user.character.name}`)).join("")}</select></label>
    <label>Featured rarity pity <input data-tgs-pity type="number" min="0" step="1"></label>
    <label>Ten-pull pity <input data-tgs-ten-pity type="number" min="0" step="1"></label>
    <label><input data-tgs-guarantee type="checkbox"> Next featured-rarity hit guaranteed</label>
    <button type="button" data-tgs-save-pity>Save player pity</button>
    <small>Uses the banner’s saved classification.</small>
  </fieldset>`);
  const player = root.querySelector('[data-tgs-player]');
  const pity = root.querySelector('[data-tgs-pity]');
  const ten = root.querySelector('[data-tgs-ten-pity]');
  const guaranteed = root.querySelector('[data-tgs-guarantee]');
  const show = () => {
    const state = readPity(game.users.get(player.value).character, current);
    pity.value = state.pityCount;
    ten.value = state.tenPityCount;
    guaranteed.checked = state.guaranteedRateUp;
  };
  player.onchange = show;
  show();
  const save = root.querySelector('[data-tgs-save-pity]');
  save.onclick = async () => {
    save.disabled = true;
    try {
      await setPlayerPity(player.value, current, {
        pityCount: pity.value, tenPityCount: ten.value, guaranteedRateUp: guaranteed.checked
      });
      ui.notifications.info("Player pity saved.");
    } catch (error) { notifyError(error); }
    finally { save.disabled = false; }
  };
}

export function installBannerSettings(ConfigClass) {
  const proto = ConfigClass.prototype;
  if (proto[PATCH]) return;
  const {_onRender: render, _performSave: save} = proto;
  if (typeof save !== "function" || typeof proto._refreshPoolView !== "function") {
    throw new Error("This Gacha Studio version does not expose banner save and pool editing.");
  }
  proto._onRender = async function(...args) {
    const result = await render.apply(this, args);
    attachSettings(this);
    return result;
  };
  proto._performSave = async function(...args) {
    const root = appElement(this);
    const field = root?.querySelector('[data-tgs-pity-class]');
    if (!game.user.isGM || !field) return save.apply(this, args);
    const idField = root.querySelector('[name="bannerId"]');
    const id = this.targetBannerId || idField?.value || `bn_${foundry.utils.randomID()}`;
    if (!this.targetBannerId && !idField) throw new Error("Missing banner ID field.");
    if (idField) idField.value = id;
    const name = classification(field.value);
    const result = await save.apply(this, args);
    if (!banners().some(banner => banner.id === id)) return result;
    const updated = {...classes()};
    if (name) Object.defineProperty(updated, id, {value: name, enumerable: true, configurable: true, writable: true});
    else delete updated[id];
    await game.settings.set(ID, "bannerClasses", updated);
    return result;
  };
  Object.defineProperty(proto, PATCH, {value: true});
}
