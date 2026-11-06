import {ID, asset, setting} from "./constants.js";
import {videoCache} from "./video-cache.js";

export const auraSource = stars => asset(`aura-${stars === 5 ? "gold" : stars === 4 ? "purple" : "blue"}.mp4`);
export function openingSource(banner, visuals, opening = true) {
  const animation = banner.animation || {};
  return opening && animation.type === "video" ? (visuals.some(visual => visual.stars === 5) ? animation.videoSSR || animation.videoNormal : animation.videoNormal) || "" : "";
}

export function warmBannerVideos(banner, {cache = videoCache} = {}) {
  if (!setting(ID, "enabled", true) || !setting(ID, "preloadVideos", true) || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return Promise.resolve([]);
  const animation = banner?.animation || {};
  const sources = [3, 4, 5].map(auraSource);
  if (setting(ID, "openingVideos", true) && animation.type === "video") sources.push(animation.videoNormal, animation.videoSSR);
  return Promise.allSettled([...new Set(sources.filter(Boolean))].map(src => cache.warm(src)));
}

export function installVideoPreloader(hooks = globalThis.Hooks) {
  if (!hooks?.on) return;
  hooks.on("renderGachaBannerApp", (_app, _html, context) => {
    if (!context?.current || context.isEmpty) return;
    void warmBannerVideos(context.current).catch(error => console.warn(`${ID} | Banner video preload`, error));
  });
  globalThis.window?.addEventListener?.("pagehide", event => {if (!event.persisted) videoCache.clear({force: true});});
}

/** Finish complete downloads before any video is assigned a browser-local URL. */
export async function prepareSequenceVideos(banner, visuals, {opening = true, reduced = false, cache = videoCache, preload = setting(ID, "preloadVideos", true)} = {}) {
  const selectedOpening = reduced ? "" : openingSource(banner, visuals, opening);
  const sources = reduced ? [] : [...new Set([selectedOpening, ...visuals.map(visual => auraSource(visual.stars))].filter(Boolean))];
  const local = new Map(), leases = [];
  const release = () => {for (const lease of leases.splice(0)) lease.release();};
  if (!preload) return {opening: selectedOpening, source: src => src, release};
  if (!sources.length) return {opening: "", source: () => "", release};

  const controller = new AbortController(), progress = new Map();
  const status = document.createElement("div"); status.id = "tgs-hsr-preload";
  status.setAttribute("role", "dialog"); status.setAttribute("aria-modal", "true"); status.setAttribute("aria-label", "Preparing warp video");
  status.innerHTML = '<div class="tgs-preload-content"><p class="tgs-preload-text" role="status" aria-live="polite">Preparing warp video…</p><button type="button" class="tgs-preload-skip">Skip video</button></div>';
  const text = status.querySelector(".tgs-preload-text"), skip = status.querySelector(".tgs-preload-skip");
  const update = (src, value) => {
    progress.set(src, value);
    const values = [...progress.values()], loaded = values.reduce((sum, value) => sum + value.loaded, 0);
    const known = values.length === sources.length && values.every(value => value.total > 0);
    text.textContent = known ? `Preparing warp video… ${Math.min(100, Math.round(loaded / values.reduce((sum, value) => sum + value.total, 0) * 100))}%` : `Preparing warp video… ${(loaded / 1024 / 1024).toFixed(1)} MB`;
  };
  const skipVideos = () => controller.abort();
  skip.addEventListener("click", skipVideos);
  status.addEventListener("keydown", event => {if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); skipVideos();}});
  document.body.append(status); skip.focus?.();
  try {
    const outcomes = await Promise.allSettled(sources.map(async src => {
      const lease = await cache.acquire(src, {signal: controller.signal, onProgress: value => update(src, value)});
      leases.push(lease); local.set(src, lease.url);
    }));
    if (controller.signal.aborted) {release(); local.clear();}
    else {
      for (let index = 0; index < outcomes.length; index++) if (outcomes[index].status === "rejected") console.warn(`${ID} | Could not buffer video ${sources[index]}`, outcomes[index].reason);
      if (selectedOpening && !local.has(selectedOpening)) globalThis.ui?.notifications?.warn("The opening video could not be preloaded. Continuing with the reward reveal.");
    }
    return {opening: local.get(selectedOpening) || "", source: src => local.get(src) || "", release};
  } catch (error) {release(); throw error;}
  finally {status.remove();}
}
