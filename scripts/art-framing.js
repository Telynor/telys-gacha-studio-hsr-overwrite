import {asset, clamp, safeImage} from "./constants.js";
import {characterConfig} from "./character.js";
import {loadAsset} from "./assets.js";
import {paintArt, paintNameplate} from "./sequence.js";
import {readyAt} from "./model.js";
import {paintPortrait} from "./portrait-layout.js";

export function framingVisual(item, mode = "reveal") {
  const config = characterConfig(item), saved = config.snapshot || {}, overrides = config.overrides || {}, legacy = item.reveal || {};
  const value = key => overrides[key] || saved[key] || legacy[key] || "";
  const portrait = mode === "portrait", prefix = portrait ? "portrait" : "art";
  const scale = clamp(Number(config[`${prefix}Scale`]) || 100, 25, 300), x = clamp(config[`${prefix}X`], -200, 200), y = clamp(config[`${prefix}Y`], -200, 200);
  return {
    kind: "character", stars: 5, name: value("name") || item.name || "Character",
    art: safeImage(portrait ? config.cardArt || legacy.cardArt || saved.portrait || value("splashArt") || item.img : value("splashArt") || item.img), pathIcon: safeImage(value("pathIcon")), elementIcon: safeImage(value("elementIcon")),
    pathName: value("pathName"), elementName: value("elementName"),
    artScale: scale, artX: x, artY: y, portraitScale: scale, portraitX: x, portraitY: y,
  };
}

/** The editor and the pull share paintArt, including alpha-bound anchoring and fit. */
export function attachArtFraming(container, item, {onChange = () => {}, load = loadAsset, stars = 5, mode = "reveal"} = {}) {
  const canvas = container?.querySelector?.("[data-tgs-art-preview]");
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context) return {refresh() {}, destroy() {}};
  const wrapper = container.querySelector("[data-tgs-art-frame]"), status = container.querySelector("[data-tgs-art-status]"), caption = container.querySelector("[data-tgs-art-caption]");
  const controller = new AbortController(), options = {signal: controller.signal};
  let destroyed = false, frame = 0, timer, request = 0, images = {}, key = "", drag = null;
  const visualNow = () => framingVisual(item, mode);
  const draw = () => {
    frame = 0; if (destroyed) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, Math.max(1, globalThis.window?.devicePixelRatio || 1));
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, rect.width, rect.height);
    const width = mode === "portrait" ? rect.width : globalThis.window?.innerWidth || rect.width;
    const height = mode === "portrait" ? rect.height : globalThis.window?.innerHeight || rect.height;
    const scale = dpr * rect.width / width, visual = {...visualNow(), stars};
    if (caption && mode === "portrait") caption.textContent = visual.name;
    if (mode === "portrait") {paintPortrait(context, width, height, visual, images.art, scale); return;}
    paintArt(context, width, height, 650, visual, images.art, scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    paintNameplate(context, width, height, readyAt(stars), visual, images, images.star);
  };
  const schedule = () => {if (!destroyed && !frame) frame = requestAnimationFrame(draw);};
  const refresh = ({immediate = false} = {}) => {
    if (destroyed) return;
    const visual = visualNow(), next = JSON.stringify([visual.art, visual.pathIcon, visual.elementIcon]);
    if (next === key) {schedule(); return;}
    key = next; const version = ++request; clearTimeout(timer);
    if (status) {status.hidden = false; status.textContent = visual.art ? "Loading artwork…" : "Choose splash artwork to frame this character.";}
    const fetchImages = async () => {
      const [art, path, element, star] = await Promise.all([load(visual.art), load(visual.pathIcon, "icon"), load(visual.elementIcon, "icon"), load(asset("star.png"), "star")]);
      if (destroyed || version !== request) return;
      images = {art, path, element, star};
      if (status) {status.hidden = Boolean(art); if (!art) status.textContent = "Artwork could not be loaded. Choose another image path.";}
      schedule();
    };
    if (immediate) void fetchImages(); else timer = setTimeout(() => void fetchImages(), 180);
  };
  const change = patch => {onChange(mode === "portrait" ? Object.fromEntries(Object.entries(patch).map(([key, value]) => [key.replace(/^art/, "portrait"), value])) : patch); schedule();};
  const setAspect = () => {
    const ratio = mode === "portrait" ? 1.75 : (globalThis.window?.innerWidth || 16) / (globalThis.window?.innerHeight || 9);
    wrapper?.style?.setProperty("--tgs-art-preview-ratio", String(ratio)); schedule();
  };
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); canvas.focus?.();
    const visual = visualNow();
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, artX: visual.artX, artY: visual.artY};
    try {canvas.setPointerCapture?.(event.pointerId);} catch { /* Pointer capture is optional. */ }
    canvas.style.cursor = "grabbing";
  }, options);
  canvas.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    change({artX: clamp(drag.artX + (event.clientX - drag.x) / rect.width * 100, -200, 200), artY: clamp(drag.artY + (event.clientY - drag.y) / rect.height * 100, -200, 200)});
  }, options);
  const stopDrag = () => {drag = null; canvas.style.cursor = "grab";};
  canvas.addEventListener("pointerup", stopDrag, options); canvas.addEventListener("pointercancel", stopDrag, options);
  canvas.addEventListener("lostpointercapture", stopDrag, options);
  canvas.addEventListener("wheel", event => {
    event.preventDefault(); event.stopPropagation();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1);
    change({artScale: clamp(Math.round(visualNow().artScale * Math.exp(-delta * .0015)), 25, 300)});
  }, {...options, passive: false});
  canvas.addEventListener("keydown", event => {
    const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}, direction = directions[event.key];
    if (!direction) return;
    event.preventDefault(); event.stopPropagation();
    const visual = visualNow(), step = event.shiftKey ? 5 : 1;
    change({artX: clamp(visual.artX + direction[0] * step, -200, 200), artY: clamp(visual.artY + direction[1] * step, -200, 200)});
  }, options);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(canvas); globalThis.window?.addEventListener?.("resize", setAspect, options);
  setAspect(); refresh({immediate: true});
  return {refresh, destroy() {destroyed = true; request++; clearTimeout(timer); cancelAnimationFrame(frame); controller.abort(); observer?.disconnect();}};
}
