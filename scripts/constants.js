export const ID = "telys-gacha-studio-hsr-overwrite";
export const HOST_ID = "gacha-banner";
export const ACTOR_MODULE_ID = "telys-star-rail-ultimates";
export const REVEAL_KEY = "telysHSR";
export const COLORS = Object.freeze({3: [112, 179, 255], 4: [189, 133, 255], 5: [244, 207, 125]});
export const asset = path => `modules/${ID}/assets/${path}`;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
export const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
export const ease = value => 1 - Math.pow(1 - clamp(value), 3);
export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
}
export function safeImage(value, fallback = "") {
  const text = String(value ?? "").trim();
  return !text || /[\u0000-\u001f<>]/.test(text) || /^(?:javascript|vbscript|data|blob):/i.test(text) ? fallback : text;
}
export function setting(namespace, key, fallback) {
  try { return globalThis.game?.settings?.get(namespace, key) ?? fallback; } catch { return fallback; }
}
export function clone(value) { return globalThis.foundry?.utils?.deepClone?.(value) ?? structuredClone(value); }

/** A native HTMLFormElement is indexed too: [0] is its first form control. */
export function appElement(app) {
  const element = app?.element;
  return typeof element?.addEventListener === "function" ? element : element?.[0] ?? element;
}
