import {ID, COLORS, asset, clamp, smooth, ease, escapeHTML} from "./constants.js";
import {loadAsset, drawAnchored} from "./assets.js";
import {newSequence, seekSequence, advanceSequence, backgroundAt, readyAt, hasSummary} from "./model.js";
import {videoCache as browserVideoCache} from "./video-cache.js";
import {auraSource, prepareSequenceVideos} from "./video-preload.js";
import {portraitStyle} from "./portrait-layout.js";

const fitted = (context, value, max) => {
  const letters = Array.from(String(value || ""));
  if (context.measureText(letters.join("")).width <= max) return letters.join("");
  while (letters.length && context.measureText(letters.join("") + "…").width > max) letters.pop();
  return letters.join("") + "…";
};

export function paintIntro(context, width, height, time, star, path, dpr = 1) {
  const unit = Math.max(1, Math.min(width / 736, height / 414));
  const exit = smooth((time - 1220) / 380), shrink = 1 - exit * .075;
  context.fillStyle = "#000"; context.fillRect(0, 0, width, height);
  context.save(); context.globalAlpha = (1 - exit) * smooth(time / 180);
  const blue = context.createRadialGradient(width / 2, height * .8, 0, width / 2, height * .8, Math.max(width * .25, height * .6));
  blue.addColorStop(0, "rgba(34,57,126,.2)"); blue.addColorStop(.55, "rgba(15,31,76,.1)"); blue.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = blue; context.fillRect(0, 0, width, height); context.restore();
  // Icon and stars share one origin. Each bitmap is anchored to its visible bounds.
  context.save(); context.setTransform(dpr * shrink, 0, 0, dpr * shrink, width / 2 * dpr, height / 2 * dpr); context.globalAlpha = 1 - exit;
  if (path) {
    const fit = Math.max(110 * unit, Math.min(185 * unit, width * .25)) / Math.max(path.boundsWidth, path.boundsHeight);
    drawAnchored(context, path, 0, (1 - ease(time / 1050)) * 144 * unit, fit, smooth(time / 240) * .82);
  }
  if (star) {
    const starts = [0, 210, 560, 210, 0], durations = [400, 400, 490, 400, 400];
    const gap = Math.min(width * .58, 310 * unit) / 4, small = width <= 380 ? 30 : 40 * unit;
    for (let i = 0; i < 5; i++) drawAnchored(context, star, (i - 2) * gap,
      (1 - ease((time - starts[i]) / durations[i])) * 96 * unit,
      small * (i === 2 ? 2 : 1) / star.width, smooth((time - starts[i]) / 150));
  }
  context.restore();
}

export function paintRing(context, width, height, age, stars, dpr = 1) {
  if (age <= 0 || age >= 1200) return;
  const p = clamp(age / 1200), unit = Math.max(1, Math.min(width / 736, height / 414));
  const r0 = Math.min(width * .27, height * .36) * .55;
  const radius = r0 + (Math.hypot(width / 2, height / 2) + 128 * unit - r0) * p;
  const color = COLORS[stars] || COLORS[3];
  context.save(); context.setTransform(dpr, 0, 0, dpr, width / 2 * dpr, height / 2 * dpr); context.globalAlpha = smooth(age / 100);
  context.strokeStyle = `rgba(${color.join(',')},.5)`; context.shadowColor = `rgb(${color.join(',')})`; context.shadowBlur = 25 * unit; context.lineWidth = 3 * unit;
  for (let i = 0; i < 12; i++) {const angle = i * Math.PI / 6; context.beginPath(); context.moveTo(0, 0); context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); context.stroke();}
  context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.lineWidth = 8 * unit; context.stroke();
  context.lineWidth = 2 * unit; context.strokeStyle = "rgba(255,247,224,.9)"; context.stroke(); context.restore();
}

export function paintRarityFlash(context, width, height, age, stars, dpr = 1) {
  if (age <= 0 || age >= 420) return;
  const color = COLORS[stars] || COLORS[3];
  const opacity = smooth(age / 55) * (1 - smooth((age - 75) / 345)) * .68;
  context.save(); context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const flash = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) * .6);
  flash.addColorStop(0, `rgba(${color.join(',')},${opacity})`);
  flash.addColorStop(.35, `rgba(${color.join(',')},${opacity * .6})`);
  flash.addColorStop(1, `rgba(${color.join(',')},0)`);
  context.fillStyle = flash; context.fillRect(0, 0, width, height); context.restore();
}

export function paintNameplate(context, width, height, time, visual, images, star) {
  const opacity = smooth((time - backgroundAt(visual.stars)) / 360);
  if (opacity <= 0) return;
  const size = Math.max(.66, Math.min(1.2, width / 1024)), left = width <= 420 ? 16 : width * .08;
  const body = height * .5, iconBox = 56 * size, textX = left + iconBox + 12 * size, barWidth = Math.min(width * .49, 520);
  context.save(); context.globalAlpha *= opacity; context.textAlign = "left"; context.textBaseline = "alphabetic";
  const band = context.createLinearGradient(0, 0, barWidth, 0);
  band.addColorStop(0, "rgba(3,6,15,.76)"); band.addColorStop(.55, "rgba(3,6,15,.72)"); band.addColorStop(1, "rgba(3,6,15,0)");
  context.fillStyle = band; context.fillRect(0, body - 3 * size, barWidth, 81 * size);
  const category = visual.kind === "character" ? "Character" : visual.kind === "lightCone" ? "Light Cone" : "Item";
  const badgeTop = body - 29 * size;
  context.font = `500 ${18 * size}px Arial, sans-serif`;
  const badgeWidth = context.measureText(category).width + 15 * size;
  context.fillStyle = "#e5e8e9"; context.fillRect(textX, badgeTop, badgeWidth, 24 * size);
  context.fillStyle = "#202832"; context.fillText(category, textX + 6 * size, badgeTop + 18 * size);
  const main = visual.kind === "character" ? images.element : images.path;
  if (main) drawAnchored(context, main, left + iconBox / 2, body + 43 * size, 56 * size / Math.max(main.boundsWidth, main.boundsHeight));
  const maxName = Math.max(90, Math.min(width * .47, 500) - textX - 12);
  let fontSize = 34 * size; context.font = `500 ${fontSize}px Arial, sans-serif`;
  while (context.measureText(visual.name).width > maxName && fontSize > 16) {fontSize -= .5; context.font = `500 ${fontSize}px Arial, sans-serif`;}
  context.fillStyle = "#f4f5f7"; context.shadowColor = "rgba(0,0,0,.7)"; context.shadowBlur = 2;
  context.fillText(fitted(context, visual.name, maxName), textX, body + 36 * size); context.shadowBlur = 0;
  if (star) for (let i = 0; i < visual.stars; i++) drawAnchored(context, star, textX + (9 + i * 20) * size, body + 62 * size, 18 * size / star.width);
  if (visual.pathName) {
    const top = body + 86 * size, max = Math.max(72, width - textX - 18), padding = (images.path ? 43 : 18) * size;
    context.font = `400 ${18 * size}px Arial, sans-serif`;
    const label = fitted(context, visual.pathName, max - padding), box = Math.min(max, context.measureText(label).width + padding);
    context.fillStyle = "rgba(4,8,15,.88)"; context.fillRect(textX, top, box, 27 * size);
    if (images.path) drawAnchored(context, images.path, textX + 15 * size, top + 13.5 * size, 22 * size / Math.max(images.path.boundsWidth, images.path.boundsHeight));
    context.fillStyle = "#e8eaf0"; context.fillText(label, textX + (images.path ? 32 : 8) * size, top + 20 * size);
  }
  context.restore();
}

export function paintArt(context, width, height, age, visual, image, dpr) {
  if (!image) return;
  const fit = Math.min(width * .94 / image.boundsWidth, height * (visual.kind === "character" ? .94 : .86) / image.boundsHeight);
  const scale = fit * (.96 + .04 * ease(age / 650)) * (visual.artScale || 100) / 100;
  const x = width * (.5 + (Number(visual.artX) || 0) / 100), y = height * (.5 + (Number(visual.artY) || 0) / 100);
  context.save(); context.setTransform(dpr, 0, 0, dpr, x * dpr, y * dpr); context.globalAlpha = smooth(age / 360);
  if (visual.kind === "lightCone") context.rotate(.085);
  drawAnchored(context, image, 0, 0, scale); context.restore();
}

/** Production receives the host's already-selected results, in their original order. */
export async function playSequence(results, visuals, banner = {}, {rate = 1.5, opening = true, playSFX = () => {}, videoCache = browserVideoCache} = {}) {
  if (!results.length) return results;
  const speed = Math.max(.5, Math.min(3, Number(rate) || 1.5));
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const imagePreparation = Promise.all([loadAsset(asset("star.png"), "star"), ...visuals.map(async visual => {
    const [artwork, path, element, card] = await Promise.all([loadAsset(visual.art), loadAsset(visual.pathIcon, "icon"), loadAsset(visual.elementIcon, "icon"), results.length === 10 && visual.kind === "character" ? loadAsset(visual.cardArt || visual.art) : null]);
    return {art: artwork, path, element, card};
  })]);
  imagePreparation.catch(() => {});
  const videos = await prepareSequenceVideos(banner, visuals, {opening, reduced, cache: videoCache});
  try {
    const [star, ...images] = await imagePreparation;
    return await new Promise(resolve => {
      const priorFocus = document.activeElement, previousOverflow = document.body.style.overflow;
      const overlay = document.createElement("div"); overlay.id = "tgs-hsr-overlay"; overlay.className = "tgs-hsr-overlay";
      overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", "Warp reward reveal"); overlay.tabIndex = -1;
      overlay.innerHTML = `<img class="tgs-starfield" src="${asset("starfield.png")}" alt=""><video class="tgs-aura" muted playsinline preload="auto" aria-hidden="true"></video><video class="tgs-opening" playsinline preload="auto" hidden></video><canvas class="tgs-frame" aria-hidden="true"></canvas><span class="tgs-counter"></span><span class="tgs-hint" hidden>Click anywhere to continue</span><span class="tgs-announcement" aria-live="polite"></span><button type="button" class="tgs-skip-opening" hidden>Skip opening</button><div class="tgs-summary" hidden><h2>Warp Result</h2><div class="tgs-summary-rows"></div><button type="button" class="tgs-close-summary" aria-label="Close warp results">×</button></div>`;
      document.body.append(overlay); document.body.style.overflow = "hidden";
      const frame = overlay.querySelector(".tgs-frame"), context = frame.getContext("2d"), field = overlay.querySelector(".tgs-starfield");
      const aura = overlay.querySelector(".tgs-aura"), openingVideo = overlay.querySelector(".tgs-opening"), skip = overlay.querySelector(".tgs-skip-opening");
      const counter = overlay.querySelector(".tgs-counter"), hint = overlay.querySelector(".tgs-hint"), announcement = overlay.querySelector(".tgs-announcement");
      const summary = overlay.querySelector(".tgs-summary"), rows = overlay.querySelector(".tgs-summary-rows");
      const controller = new AbortController(), state = newSequence(visuals);
      let width = 736, height = 414, dpr = 1, raf = 0, started = null, bgStarted = false, auraFailed = false, auraVersion = 0, finished = false, openingNow = false, bgm;
      const current = () => visuals[state.index];
      const sound = src => {if (src) try {playSFX(src, .7);} catch { /* Audio never blocks delivery. */ }};
      const finish = () => {
        if (finished) return; finished = true; auraVersion++; controller.abort(); cancelAnimationFrame(raf); observer?.disconnect();
        for (const media of [aura, openingVideo, bgm].filter(Boolean)) {media.pause(); media.removeAttribute("src"); media.load?.();}
        overlay.remove(); document.body.style.overflow = previousOverflow;
        if (priorFocus?.isConnected) priorFocus.focus?.();
        resolve(results);
      };
      overlay._tgsFinish = finish;
      function draw() {
        context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
        if (finished || state.phase === "summary" || openingNow) return;
        const visual = current(); if (!visual) return;
        if (state.time < backgroundAt(visual.stars)) {if (visual.stars === 5) paintIntro(context, width, height, state.time, star, images[state.index].path, dpr); return;}
        const age = state.time - backgroundAt(visual.stars);
        if (auraFailed) paintRing(context, width, height, age, visual.stars, dpr);
        if (!reduced) paintRarityFlash(context, width, height, age, visual.stars, dpr);
        paintArt(context, width, height, age, visual, images[state.index].art, dpr);
        paintNameplate(context, width, height, state.time, visual, images[state.index], star);
      }
      const resize = () => {
        const rect = overlay.getBoundingClientRect(); if (!rect.width || !rect.height) return;
        width = rect.width; height = rect.height; dpr = Math.max(1, window.devicePixelRatio || 1);
        frame.width = Math.round(width * dpr); frame.height = Math.round(height * dpr);
        rows.style.setProperty("--tgs-grid-width", `${Math.min(width * .85, (height - 66) / .66)}px`); draw();
      };
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
      observer?.observe(overlay); window.addEventListener("resize", resize, {signal: controller.signal}); resize();
      function startAura(visual) {
        const version = ++auraVersion;
        bgStarted = true; auraFailed = true; aura.style.opacity = "0";
        try {
          const src = videos.source(auraSource(visual.stars));
          if (!src) return; // The procedural pulse remains available if a download was skipped.
          if (aura.src !== src) {aura.src = src; aura.load?.();}
          aura.currentTime = 0; aura.playbackRate = speed;
          Promise.resolve(aura.play()).then(() => {
            if (finished || version !== auraVersion || current() !== visual) return;
            // The Canvas flash/ring covers video startup; a late clip joins that clock.
            aura.currentTime = Math.max(0, (state.time - backgroundAt(visual.stars)) / 1000);
            auraFailed = false; aura.style.opacity = "1"; draw();
          }).catch(() => {
            if (finished || version !== auraVersion || current() !== visual) return;
            auraFailed = true; aura.style.opacity = "0"; draw();
          });
        }
        catch {auraFailed = true; aura.style.opacity = "0";}
      }
      function renderAt(time) {
        const visual = current(); if (!visual || finished) return;
        seekSequence(state, time, visual.stars);
        const revealed = state.phase !== "intro";
        field.style.opacity = revealed ? "1" : "0";
        if (revealed && !bgStarted) startAura(visual);
        if (!revealed) aura.style.opacity = "0";
        hint.hidden = state.phase !== "holding"; counter.hidden = !revealed;
        counter.textContent = state.count === 1 ? "" : `${state.index + 1} / ${state.count}`;
        draw();
        if (state.phase === "holding") {
          announcement.textContent = `${visual.name}. ${visual.stars}-star ${visual.kind === "character" ? "Character" : visual.kind === "lightCone" ? "Light Cone" : "reward"}. ${visual.elementName || ""}. ${visual.pathName || ""}. ${state.count === 1 ? "Click anywhere to close." : "Click anywhere to continue."}`;
          hint.textContent = state.count === 1 ? "Click anywhere to close" : "Click anywhere to continue";
        }
      }
      function startReward() {
        cancelAnimationFrame(raf); auraVersion++; aura.pause(); aura.style.opacity = "0"; bgStarted = false; started = null;
        const visual = current();
        if (!visual) return finish();
        overlay.style.setProperty("--tgs-reward-color", `rgb(${(COLORS[visual.stars] || COLORS[3]).join(',')})`);
        announcement.textContent = ""; hint.hidden = true; counter.hidden = true;
        sound(visual.stars === 5 ? banner.audio?.sfxSSR : banner.audio?.sfxFlip);
        if (reduced) {state.time = readyAt(visual.stars); bgStarted = true; auraFailed = true; renderAt(state.time); return;}
        renderAt(0);
        const tick = now => {
          if (finished) return;
          try {
            started ??= now;
            let time = (now - started) * speed;
            // A throttled frame must not jump over the entire rarity flash.
            if (!bgStarted && time > backgroundAt(visual.stars) + 100) {time = backgroundAt(visual.stars); started = now - time / speed;}
            renderAt(time);
            if (state.phase !== "holding") raf = requestAnimationFrame(tick);
          } catch (error) {console.error(`${ID} | Animation frame failed`, error); finish();}
        };
        raf = requestAnimationFrame(tick);
      }
      function showSummary() {
        if (!hasSummary(state)) return finish();
        aura.pause(); aura.style.opacity = "0"; field.style.opacity = "1"; hint.hidden = true; counter.hidden = true;
        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, frame.width, frame.height);
        const line = [3, 4, 3].map(() => {const row = document.createElement("div"); row.className = "tgs-result-row"; rows.append(row); return row;});
        visuals.forEach((visual, index) => {
          const card = document.createElement("div"); card.className = `tgs-result-card${visual.kind === "character" ? " tgs-character-card" : ""}`;
          card.dataset.stars = String(visual.stars); card.style.setProperty("--tgs-card-color", `rgb(${(COLORS[visual.stars] || COLORS[3]).join(',')})`); card.style.setProperty("--tgs-card-delay", `${index * 30}ms`);
          card.setAttribute("aria-label", `Reward ${index + 1}: ${visual.name}, ${visual.stars} stars`);
          card.innerHTML = `<img class="tgs-result-art" src="${escapeHTML(visual.cardArt || visual.art)}" ${visual.kind === "character" ? `style="${portraitStyle(visual, images[index].card)}"` : ""} alt="">${visual.pathIcon && visual.kind !== "character" ? `<img class="tgs-result-path" src="${escapeHTML(visual.pathIcon)}" alt="">` : ""}<span class="tgs-result-rarity">${visual.stars ? `${visual.stars}★` : "—"}</span><span class="tgs-result-name">${escapeHTML(visual.name)}</span>`;
          line[index < 3 ? 0 : index < 7 ? 1 : 2].append(card);
        });
        summary.hidden = false; announcement.textContent = "Ten-pull complete. Ten rewards are shown. Click anywhere to close.";
      }
      const advance = () => {
        if (finished || openingNow) return;
        if (state.phase === "summary") return finish();
        if (!advanceSequence(state)) return;
        try {if (state.phase === "complete") finish(); else if (state.phase === "summary") showSummary(); else startReward();}
        catch (error) {console.error(`${ID} | Reveal transition failed`, error); finish();}
      };
      overlay.addEventListener("click", advance, {signal: controller.signal});
      overlay.querySelector(".tgs-close-summary").addEventListener("click", event => {event.stopPropagation(); finish();}, {signal: controller.signal});
      overlay.addEventListener("keydown", event => {
        if (["Enter", " ", "Escape"].includes(event.key) && !event.repeat) {event.preventDefault(); if (openingNow) finishOpening(); else advance();}
      }, {signal: controller.signal});
      aura.addEventListener("error", () => {auraFailed = true; aura.style.opacity = "0"; draw();}, {signal: controller.signal});
      aura.addEventListener("ended", () => {aura.style.opacity = "0";}, {signal: controller.signal});
      let openingFinished = false;
      function finishOpening() {
        if (openingFinished || finished) return; openingFinished = true; openingNow = false;
        openingVideo.pause(); openingVideo.hidden = true; skip.hidden = true;
        if (banner.audio?.bgmAnim) {bgm = new Audio(banner.audio.bgmAnim); bgm.loop = true; bgm.volume = .35; bgm.play()?.catch(() => {});}
        startReward();
      }
      skip.addEventListener("click", event => {event.stopPropagation(); finishOpening();}, {signal: controller.signal});
      openingVideo.addEventListener("ended", finishOpening, {signal: controller.signal}); openingVideo.addEventListener("error", finishOpening, {signal: controller.signal});
      const openingSrc = videos.opening;
      overlay.focus();
      if (openingSrc && !reduced) {openingNow = true; openingVideo.hidden = false; skip.hidden = false; openingVideo.src = openingSrc; openingVideo.load?.(); openingVideo.play()?.catch(finishOpening);}
      else finishOpening();
    });
  } finally {videos.release();}
}
